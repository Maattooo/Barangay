import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { logAuditEvent, computeJsonDiff } from '../services/audit.service';
import { CertificateTemplate } from '../types/templates';

const router = Router();

// All template endpoints require authentication
router.use(authenticate);

/**
 * GET /api/templates
 * Lists all certificate templates ordered by id ASC. Accessible to all staff roles.
 */
router.get('/', (_req: Request, res: Response): void => {
  const templates = db.prepare(`
    SELECT id, template_code, template_name, title_header, body_html,
           show_officials_sidebar, default_fee, requires_blotter_check,
           is_active, updated_by, updated_at
    FROM certificate_templates
    ORDER BY id ASC
  `).all() as CertificateTemplate[];

  res.status(200).json(templates);
});

/**
 * GET /api/templates/:id
 * Retrieves a single certificate template by ID or template_code.
 */
router.get('/:id', (req: Request, res: Response): void => {
  const param = req.params.id;
  const isNumeric = /^\d+$/.test(param);

  let template: CertificateTemplate | undefined;

  if (isNumeric) {
    template = db.prepare(`
      SELECT id, template_code, template_name, title_header, body_html,
             show_officials_sidebar, default_fee, requires_blotter_check,
             is_active, updated_by, updated_at
      FROM certificate_templates
      WHERE id = ?
    `).get(Number(param)) as CertificateTemplate | undefined;
  }

  if (!template) {
    template = db.prepare(`
      SELECT id, template_code, template_name, title_header, body_html,
             show_officials_sidebar, default_fee, requires_blotter_check,
             is_active, updated_by, updated_at
      FROM certificate_templates
      WHERE template_code = ?
    `).get(param) as CertificateTemplate | undefined;
  }

  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.status(200).json(template);
});

/**
 * PUT /api/templates/:id
 * Updates certificate template text, sidebar visibility, or default fee inside an atomic transaction.
 * Suppresses no-op updates when no fields change. Restricted strictly to Admin.
 */
router.put('/:id', requireRole('Admin'), (req: Request, res: Response): void => {
  const param = req.params.id;
  const isNumeric = /^\d+$/.test(param);

  let existing: CertificateTemplate | undefined;

  if (isNumeric) {
    existing = db.prepare(`
      SELECT id, template_code, template_name, title_header, body_html,
             show_officials_sidebar, default_fee, requires_blotter_check,
             is_active, updated_by, updated_at
      FROM certificate_templates
      WHERE id = ?
    `).get(Number(param)) as CertificateTemplate | undefined;
  }

  if (!existing) {
    existing = db.prepare(`
      SELECT id, template_code, template_name, title_header, body_html,
             show_officials_sidebar, default_fee, requires_blotter_check,
             is_active, updated_by, updated_at
      FROM certificate_templates
      WHERE template_code = ?
    `).get(param) as CertificateTemplate | undefined;
  }

  if (!existing) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const {
    title_header,
    body_html,
    show_officials_sidebar,
    default_fee,
    is_active
  } = req.body || {};

  if (default_fee !== undefined) {
    const feeNum = Number(default_fee);
    if (isNaN(feeNum) || feeNum < 0) {
      res.status(400).json({ error: 'default_fee must be a non-negative number' });
      return;
    }
  }

  if (show_officials_sidebar !== undefined) {
    const sidebarNum = Number(show_officials_sidebar);
    if (sidebarNum !== 0 && sidebarNum !== 1) {
      res.status(400).json({ error: 'show_officials_sidebar must be 0 or 1' });
      return;
    }
  }

  if (title_header !== undefined && typeof title_header !== 'string') {
    res.status(400).json({ error: 'title_header must be a string' });
    return;
  }

  if (body_html !== undefined && typeof body_html !== 'string') {
    res.status(400).json({ error: 'body_html must be a string' });
    return;
  }

  const updatedTitleHeader = title_header !== undefined ? title_header : existing.title_header;
  const updatedBodyHtml = body_html !== undefined ? body_html : existing.body_html;
  const updatedSidebar = show_officials_sidebar !== undefined ? Number(show_officials_sidebar) : existing.show_officials_sidebar;
  const updatedDefaultFee = default_fee !== undefined ? Number(default_fee) : existing.default_fee;
  const updatedIsActive = is_active !== undefined ? (Number(is_active) ? 1 : 0) : existing.is_active;

  const candidateUpdated: CertificateTemplate = {
    ...existing,
    title_header: updatedTitleHeader,
    body_html: updatedBodyHtml,
    show_officials_sidebar: updatedSidebar,
    default_fee: updatedDefaultFee,
    is_active: updatedIsActive
  };

  // Suppress no-op updates: return 200 immediately without writing to DB or audit_logs
  const diff = computeJsonDiff(existing, candidateUpdated);
  if (diff.changedKeys.length === 0) {
    res.status(200).json(existing);
    return;
  }

  try {
    let updatedTemplate: CertificateTemplate;

    const updateTemplateTx = db.transaction(() => {
      db.prepare(`
        UPDATE certificate_templates
        SET title_header = @title_header,
            body_html = @body_html,
            show_officials_sidebar = @show_officials_sidebar,
            default_fee = @default_fee,
            is_active = @is_active,
            updated_by = @updated_by,
            updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `).run({
        id: existing.id,
        title_header: candidateUpdated.title_header,
        body_html: candidateUpdated.body_html,
        show_officials_sidebar: candidateUpdated.show_officials_sidebar,
        default_fee: candidateUpdated.default_fee,
        is_active: candidateUpdated.is_active,
        updated_by: req.user!.id
      });

      updatedTemplate = db.prepare(`
        SELECT id, template_code, template_name, title_header, body_html,
               show_officials_sidebar, default_fee, requires_blotter_check,
               is_active, updated_by, updated_at
        FROM certificate_templates
        WHERE id = ?
      `).get(existing.id) as CertificateTemplate;

      // Log UPDATE audit event synchronously inside transaction
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'template',
        entityId: existing.id,
        summaryText: `Updated template: ${updatedTemplate.template_name} (${updatedTemplate.template_code})`,
        oldData: existing,
        newData: updatedTemplate,
        clientIp: req.clientIp
      });
    });

    updateTemplateTx();
    res.status(200).json(updatedTemplate!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template', details: (error as Error).message });
  }
});

/**
 * POST /api/templates
 * Creates a new certificate template. Restricted strictly to Admin.
 */
router.post('/', requireRole('Admin'), (req: Request, res: Response): void => {
  const {
    template_code,
    template_name,
    title_header,
    body_html,
    show_officials_sidebar = 1,
    default_fee = 50.0,
    requires_blotter_check = 0,
    is_active = 1
  } = req.body || {};

  if (!template_code || typeof template_code !== 'string') {
    res.status(400).json({ error: 'template_code is required and must be a string' });
    return;
  }
  if (!template_name || typeof template_name !== 'string') {
    res.status(400).json({ error: 'template_name is required and must be a string' });
    return;
  }
  if (!title_header || typeof title_header !== 'string') {
    res.status(400).json({ error: 'title_header is required and must be a string' });
    return;
  }
  if (!body_html || typeof body_html !== 'string') {
    res.status(400).json({ error: 'body_html is required and must be a string' });
    return;
  }

  const cleanCode = template_code.trim().toUpperCase();
  const existing = db.prepare('SELECT id FROM certificate_templates WHERE template_code = ?').get(cleanCode);
  if (existing) {
    res.status(409).json({ error: 'A template with this template_code already exists' });
    return;
  }

  try {
    let createdTemplate: CertificateTemplate;

    const createTemplateTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO certificate_templates (
          template_code, template_name, title_header, body_html,
          show_officials_sidebar, default_fee, requires_blotter_check,
          is_active, updated_by, updated_at
        ) VALUES (
          @template_code, @template_name, @title_header, @body_html,
          @show_officials_sidebar, @default_fee, @requires_blotter_check,
          @is_active, @updated_by, datetime('now', 'localtime')
        )
      `).run({
        template_code: cleanCode,
        template_name: template_name.trim(),
        title_header: title_header.trim().toUpperCase(),
        body_html: body_html.trim(),
        show_officials_sidebar: Number(show_officials_sidebar) ? 1 : 0,
        default_fee: Math.max(0, Number(default_fee) || 0),
        requires_blotter_check: Number(requires_blotter_check) ? 1 : 0,
        is_active: Number(is_active) ? 1 : 0,
        updated_by: req.user!.id
      });

      createdTemplate = db.prepare(`
        SELECT id, template_code, template_name, title_header, body_html,
               show_officials_sidebar, default_fee, requires_blotter_check,
               is_active, updated_by, updated_at
        FROM certificate_templates
        WHERE id = ?
      `).get(result.lastInsertRowid) as CertificateTemplate;

      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'template',
        entityId: createdTemplate.id,
        summaryText: `Created template: ${createdTemplate.template_name} (${createdTemplate.template_code})`,
        newData: createdTemplate,
        clientIp: req.clientIp
      });
    });

    createTemplateTx();
    res.status(201).json(createdTemplate!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template', details: (error as Error).message });
  }
});

export default router;
