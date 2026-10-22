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

// All system endpoints require authentication
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
