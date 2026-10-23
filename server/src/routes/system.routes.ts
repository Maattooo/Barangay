import os from 'os';
import fs from 'fs';
import { Router, Request, Response } from 'express';
import { db, DEFAULT_DB_PATH } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { logAuditEvent } from '../services/audit.service';
import { createBackup } from '../services/backup.service';
import { getSystemSettings } from '../services/template.service';

const router = Router();

/**
 * GET /api/system/public-meta
 * Returns public branding metadata (Barangay name, municipality, province)
 * Accessible without authentication for the login screen and public branding.
 */
router.get('/public-meta', (_req: Request, res: Response): void => {
  const settings = getSystemSettings();
  res.status(200).json({
    barangay_name: settings.barangay_name || 'Barangay San Jose',
    municipality_name: settings.municipality_name || 'Antipolo City',
    province_name: settings.province_name || 'Rizal',
    region_name: settings.region_name || 'Region IV-A (CALABARZON)'
  });
});

// All subsequent system endpoints require authentication
router.use(authenticate);

/**
 * GET /api/system/info
 * Returns host LAN IPv4 addresses, database file size in bytes, and system settings metadata.
 * Accessible to all authenticated staff roles (Admin, Clerk, Treasurer, Lupon).
 */
router.get('/info', (_req: Request, res: Response): void => {
  const nets = os.networkInterfaces();
  const lan_ips: string[] = [];

  for (const name of Object.keys(nets)) {
    const netList = nets[name];
    if (netList) {
      for (const net of netList) {
        const isIpv4 = net.family === 'IPv4' || (net.family as any) === 4;
        if (isIpv4 && !net.internal) {
          lan_ips.push(net.address);
        }
      }
    }
  }

  // Ensure at least one IPv4 address is reported even in isolated/loopback sandbox environments
  if (lan_ips.length === 0) {
    lan_ips.push('127.0.0.1');
  }

  let db_size_bytes = 0;
  const activeDbPath = (db as any).name || DEFAULT_DB_PATH;
  if (fs.existsSync(activeDbPath)) {
    try {
      db_size_bytes = fs.statSync(activeDbPath).size;
    } catch {
      db_size_bytes = 0;
    }
  } else if (fs.existsSync(DEFAULT_DB_PATH)) {
    try {
      db_size_bytes = fs.statSync(DEFAULT_DB_PATH).size;
    } catch {
      db_size_bytes = 0;
    }
  }

  const settings = getSystemSettings();

  res.status(200).json({
    lan_ips,
    db_size_bytes,
    settings
  });
});

/**
 * PUT /api/system/settings
 * Updates key-value pairs in the system_settings table.
 * Restricted strictly to Admin.
 */
router.put('/settings', requireRole('Admin'), (req: Request, res: Response): void => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== 'object') {
      res.status(400).json({ error: 'Settings payload must be a key-value object' });
      return;
    }

    const upsertStmt = db.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateTransaction = db.transaction((entries: [string, any][]) => {
      for (const [key, val] of entries) {
        if (typeof key === 'string' && val !== undefined && val !== null) {
          const stringVal = typeof val === 'string' ? val : JSON.stringify(val);
          upsertStmt.run(key, stringVal);
        }
      }

      // Automatically sync updated seal URLs into all certificate and blotter templates
      if (newSettings.barangay_logo_url !== undefined || newSettings.city_logo_url !== undefined) {
        try {
          const certTemplates = db.prepare('SELECT id, header_config_json FROM certificate_templates').all() as { id: number; header_config_json: string }[];
          const updateCertStmt = db.prepare('UPDATE certificate_templates SET header_config_json = ? WHERE id = ?');
          for (const t of certTemplates) {
            let cfg: any = {};
            try { cfg = JSON.parse(t.header_config_json || '{}'); } catch {}
            if (newSettings.barangay_logo_url !== undefined) cfg.barangayLogoUrl = newSettings.barangay_logo_url;
            if (newSettings.city_logo_url !== undefined) cfg.cityLogoUrl = newSettings.city_logo_url;
            updateCertStmt.run(JSON.stringify(cfg), t.id);
          }
        } catch {}

        try {
          const blotterTemplates = db.prepare('SELECT id, header_config_json FROM blotter_templates').all() as { id: number; header_config_json: string }[];
          const updateBlotterStmt = db.prepare('UPDATE blotter_templates SET header_config_json = ? WHERE id = ?');
          for (const bt of blotterTemplates) {
            let cfg: any = {};
            try { cfg = JSON.parse(bt.header_config_json || '{}'); } catch {}
            if (newSettings.barangay_logo_url !== undefined) cfg.barangayLogoUrl = newSettings.barangay_logo_url;
            if (newSettings.city_logo_url !== undefined) cfg.cityLogoUrl = newSettings.city_logo_url;
            updateBlotterStmt.run(JSON.stringify(cfg), bt.id);
          }
        } catch {}
      }
    });

    updateTransaction(Object.entries(newSettings));

    // Log UPDATE audit event
    logAuditEvent({
      userId: req.user!.id,
      username: req.user!.username,
      userRole: req.user!.role,
      action: 'UPDATE',
      entityType: 'user',
      entityId: req.user!.id,
      summaryText: 'Updated barangay system settings and territory metadata',
      clientIp: req.clientIp
    });

    const updated = getSystemSettings();
    res.status(200).json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update system settings', details: err.message });
  }
});

/**
 * POST /api/system/backup
 * Creates an SQLite hot snapshot backup and streams the resulting file for download.
 * Attaches explicit stream error handler. Restricted strictly to Admin.
 */
router.post('/backup', requireRole('Admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, filePath } = await createBackup();

    // Log SYSTEM_BACKUP audit event
    logAuditEvent({
      userId: req.user!.id,
      username: req.user!.username,
      userRole: req.user!.role,
      action: 'SYSTEM_BACKUP',
      entityType: 'user',
      entityId: req.user!.id,
      summaryText: `Created database backup: ${filename}`,
      clientIp: req.clientIp
    });

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ error: 'Failed to stream backup file', details: err.message });
      } else {
        res.end();
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Database backup failed', details: (error as Error).message });
    }
  }
});

export default router;
