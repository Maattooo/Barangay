import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { logAuditEvent, computeJsonDiff } from '../services/audit.service';
import { CertificateTemplate, PaperSize, TemplateCategory, HeaderConfig } from '../types/templates';
import {
  generateDocxBuffer,
  parseDocxBuffer,
  saveTemplateDocxToDisk,
  loadTemplateFromDocxOnDisk,
  getTemplatesWordDir
} from '../services/docx.service';
import { DEFAULT_CERTIFICATE_HEADER_HTML, DEFAULT_BLOTTER_HEADER_HTML } from '../services/template.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15 MB max
});

// All template endpoints require authentication
router.use(authenticate);

const TEMPLATE_COLUMNS = `
  id, template_code, template_name, template_category, paper_size,
  header_html, header_config_json, title_header, body_html,
  footer_html, docx_filename, show_officials_sidebar, default_fee,
  requires_blotter_check, is_active, updated_by, updated_at
`;

function findTemplateWithTable(param: string): {
  template: CertificateTemplate;
  table: 'certificate_templates' | 'blotter_templates';
} | null {
  const isNumeric = /^\d+$/.test(param);

  if (isNumeric) {
    const idNum = Number(param);
    const cert = db
      .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM certificate_templates WHERE id = ?`)
      .get(idNum) as CertificateTemplate | undefined;
    if (cert) return { template: cert, table: 'certificate_templates' };

    try {
      const blotter = db
        .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM blotter_templates WHERE id = ?`)
        .get(idNum) as CertificateTemplate | undefined;
      if (blotter) return { template: blotter, table: 'blotter_templates' };
    } catch {
      // blotter_templates might not exist in legacy test DB
    }
  }

  const certByCode = db
    .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM certificate_templates WHERE template_code = ?`)
    .get(param) as CertificateTemplate | undefined;
  if (certByCode) return { template: certByCode, table: 'certificate_templates' };

  try {
    const blotterByCode = db
      .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM blotter_templates WHERE template_code = ?`)
      .get(param) as CertificateTemplate | undefined;
    if (blotterByCode) return { template: blotterByCode, table: 'blotter_templates' };
  } catch {
    // Ignore
  }

  return null;
}

/**
 * GET /api/templates
 * Lists all certificate and blotter templates ordered by id ASC. Accessible to all staff roles.
 * Optional query param: ?category=certificate|blotter
 */
router.get('/', (req: Request, res: Response): void => {
  const categoryFilter = typeof req.query.category === 'string' ? req.query.category.toLowerCase() : '';

  const certTemplates = db
    .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM certificate_templates ORDER BY id ASC`)
    .all() as CertificateTemplate[];

  let blotterTemplates: CertificateTemplate[] = [];
  try {
    blotterTemplates = db
      .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM blotter_templates ORDER BY id ASC`)
      .all() as CertificateTemplate[];
  } catch {
    blotterTemplates = [];
  }

  const combined = [...certTemplates, ...blotterTemplates];

  if (categoryFilter === 'certificate' || categoryFilter === 'blotter') {
    res.status(200).json(combined.filter((t) => (t.template_category || 'certificate') === categoryFilter));
    return;
  }

  res.status(200).json(combined);
});

/**
 * POST /api/templates/sync-header
 * Applies a customized header_html and header_config_json across all templates (or by category).
 * Restricted strictly to Admin.
 */
router.post('/sync-header', requireRole('Admin'), (req: Request, res: Response): void => {
  const { header_html, header_config_json, category } = req.body || {};

  if (typeof header_html !== 'string') {
    res.status(400).json({ error: 'header_html is required and must be a string' });
    return;
  }

  const configStr =
    typeof header_config_json === 'string'
      ? header_config_json
      : header_config_json && typeof header_config_json === 'object'
      ? JSON.stringify(header_config_json)
      : '{}';

  try {
    const syncTx = db.transaction(() => {
      if (!category || category === 'all' || category === 'certificate') {
        db.prepare(`
          UPDATE certificate_templates
          SET header_html = @header_html,
              header_config_json = @header_config_json,
              updated_by = @updated_by,
              updated_at = datetime('now', 'localtime')
        `).run({
          header_html,
          header_config_json: configStr,
          updated_by: req.user!.id
        });
      }

      if (!category || category === 'all' || category === 'blotter') {
        try {
          db.prepare(`
            UPDATE blotter_templates
            SET header_html = @header_html,
                header_config_json = @header_config_json,
                updated_by = @updated_by,
                updated_at = datetime('now', 'localtime')
          `).run({
            header_html,
            header_config_json: configStr,
            updated_by: req.user!.id
          });
        } catch {
          // Ignore if blotter_templates table is absent
        }
      }

      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'template',
        entityId: null,
        summaryText: `Synchronized header structure across ${category || 'all'} templates`,
        newData: { category: category || 'all', header_html, header_config_json: configStr },
        clientIp: req.clientIp
      });
    });

    syncTx();

    const certTemplates = db
      .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM certificate_templates ORDER BY id ASC`)
      .all() as CertificateTemplate[];
    let blotterTemplates: CertificateTemplate[] = [];
    try {
      blotterTemplates = db
        .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM blotter_templates ORDER BY id ASC`)
        .all() as CertificateTemplate[];
    } catch {
      blotterTemplates = [];
    }

    const allTemplates = [...certTemplates, ...blotterTemplates];
    for (const t of allTemplates) {
      try {
        saveTemplateDocxToDisk(t);
      } catch {
        // Non-fatal
      }
    }

    res.status(200).json({
      message: 'Header structure applied across templates successfully',
      updatedCount: allTemplates.length,
      templates: allTemplates
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to synchronize template headers', details: (err as Error).message });
  }
});

/**
 * POST /api/templates/parse-docx
 * Parses an uploaded MS Word (.docx) file and returns extracted header_html, title_header, body_html, paper_size, and {{placeholders}} without saving to DB yet.
 */
router.post('/parse-docx', requireRole('Admin'), upload.single('file'), (req: Request, res: Response): void => {
  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: 'No .docx file uploaded' });
    return;
  }

  try {
    const parsed = parseDocxBuffer(req.file.buffer, req.body?.fallback_title || 'CERTIFICATION');
    res.status(200).json(parsed);
  } catch (err) {
    res.status(400).json({ error: 'Failed to parse MS Word (.docx) file', details: (err as Error).message });
  }
});

/**
 * GET /api/templates/:id
 * Retrieves a single certificate or blotter template by ID or template_code.
 */
router.get('/:id', (req: Request, res: Response): void => {
  const found = findTemplateWithTable(req.params.id);

  if (!found) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  res.status(200).json(found.template);
});

/**
 * GET /api/templates/:id/export-docx
 * Exports a template as an MS Word (.docx) file with {{placeholder}} tags preserved.
 */
router.get('/:id/export-docx', (req: Request, res: Response): void => {
  const found = findTemplateWithTable(req.params.id);

  if (!found) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  try {
    const t = found.template;
    let headerConfig: HeaderConfig = {};
    if (t.header_config_json) {
      try {
        headerConfig = JSON.parse(t.header_config_json);
      } catch {
        headerConfig = {};
      }
    }

    const paperSizeOverride = (req.query.paper_size as PaperSize) || (t.paper_size as PaperSize) || 'a4';

    const docxBuf = generateDocxBuffer({
      templateCode: t.template_code,
      templateName: t.template_name,
      paperSize: paperSizeOverride,
      headerHtml: t.header_html,
      headerConfig,
      titleHeader: t.title_header,
      bodyHtml: t.body_html,
      footerHtml: t.footer_html,
      showOfficialsSidebar: t.show_officials_sidebar
    });

    const filename = `${t.template_code}_TEMPLATE.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(docxBuf);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export .docx template', details: (err as Error).message });
  }
});

/**
 * POST /api/templates/:id/import-docx
 * Uploads an MS Word (.docx) file to feed/update the specified template on disk and in the database.
 */
router.post('/:id/import-docx', requireRole('Admin'), upload.single('file'), (req: Request, res: Response): void => {
  const found = findTemplateWithTable(req.params.id);
  if (!found) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  if (!req.file || !req.file.buffer) {
    res.status(400).json({ error: 'No .docx file uploaded' });
    return;
  }

  try {
    const { template: existing, table } = found;
    const parsed = parseDocxBuffer(req.file.buffer, existing.title_header);

    // Save uploaded .docx directly to data/templates/word/<CODE>.docx
    const wordDir = getTemplatesWordDir();
    const safeCode = existing.template_code.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
    const docxFilename = `${safeCode}.docx`;
    fs.writeFileSync(path.join(wordDir, docxFilename), req.file.buffer);

    const newHeaderHtml = parsed.header_html || existing.header_html || '';
    const newTitleHeader = parsed.title_header || existing.title_header;
    const newBodyHtml = parsed.body_html || existing.body_html;
    const newPaperSize = parsed.paper_size || existing.paper_size || 'a4';

    let updatedTemplate: CertificateTemplate;

    const importTx = db.transaction(() => {
      db.prepare(`
        UPDATE ${table}
        SET header_html = @header_html,
            title_header = @title_header,
            body_html = @body_html,
            paper_size = @paper_size,
            docx_filename = @docx_filename,
            updated_by = @updated_by,
            updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `).run({
        id: existing.id,
        header_html: newHeaderHtml,
        title_header: newTitleHeader,
        body_html: newBodyHtml,
        paper_size: newPaperSize,
        docx_filename: docxFilename,
        updated_by: req.user!.id
      });

      updatedTemplate = db
        .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM ${table} WHERE id = ?`)
        .get(existing.id) as CertificateTemplate;

      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'template',
        entityId: existing.id,
        summaryText: `Imported MS Word (.docx) template into ${updatedTemplate.template_name} (${updatedTemplate.template_code})`,
        oldData: existing as unknown as Record<string, any>,
        newData: updatedTemplate as unknown as Record<string, any>,
        clientIp: req.clientIp
      });
    });

    importTx();

    res.status(200).json({
      template: updatedTemplate!,
      parsed,
      detectedPlaceholders: parsed.detected_placeholders || [],
      importedFromDocx: true,
      message: `Successfully fed ${docxFilename} into ${existing.template_name}`
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to import MS Word (.docx) file', details: (err as Error).message });
  }
});

/**
 * POST /api/templates/:id/reload-docx
 * Reloads a template's structure from its MS Word (.docx) file stored in data/templates/word/<CODE>.docx.
 */
router.post('/:id/reload-docx', requireRole('Admin'), (req: Request, res: Response): void => {
  const found = findTemplateWithTable(req.params.id);
  if (!found) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  try {
    const { template: existing, table } = found;
    const parsed = loadTemplateFromDocxOnDisk(existing.template_code, existing.title_header);
    if (!parsed) {
      res.status(404).json({ error: `No .docx file found on disk for ${existing.template_code}` });
      return;
    }

    let updatedTemplate: CertificateTemplate;
    const reloadTx = db.transaction(() => {
      db.prepare(`
        UPDATE ${table}
        SET header_html = @header_html,
            title_header = @title_header,
            body_html = @body_html,
            paper_size = @paper_size,
            updated_by = @updated_by,
            updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `).run({
        id: existing.id,
        header_html: parsed.header_html || existing.header_html || '',
        title_header: parsed.title_header || existing.title_header,
        body_html: parsed.body_html || existing.body_html,
        paper_size: parsed.paper_size || existing.paper_size || 'a4',
        updated_by: req.user!.id
      });

      updatedTemplate = db
        .prepare(`SELECT ${TEMPLATE_COLUMNS} FROM ${table} WHERE id = ?`)
        .get(existing.id) as CertificateTemplate;
    });

    reloadTx();
    res.status(200).json({
      template: updatedTemplate!,
      detectedPlaceholders: parsed.detected_placeholders || [],
      reloadedFromDisk: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reload template from .docx on disk', details: (err as Error).message });
  }
});

/**
 * PUT /api/templates/:id
 * Updates certificate or blotter template text, header structure, paper size, sidebar visibility, or default fee inside an atomic transaction.
 * Suppresses no-op updates when no fields change. Restricted strictly to Admin.
 */
router.put('/:id', requireRole('Admin'), (req: Request, res: Response): void => {
  const found = findTemplateWithTable(req.params.id);

  if (!found) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const { template: existing, table } = found;

  const {
    template_name,
    template_category,
    paper_size,
    header_html,
    header_config_json,
    title_header,
    body_html,
    footer_html,
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

  if (paper_size !== undefined && !['short', 'a4', 'long'].includes(String(paper_size).toLowerCase())) {
    res.status(400).json({ error: 'paper_size must be short, a4, or long' });
    return;
  }

  if (title_header !== undefined && typeof title_header !== 'string') {
    res.status(400).json({ error: 'title_header must be a string' });
    return;
  }

  if (body_html !== undefined && typeof body_html !== 'string') {
    res.status(400).json({ error: 'body_html must be a string' });
    return;
  }

  const updatedTemplateName = template_name !== undefined ? String(template_name).trim() : existing.template_name;
  const updatedCategory = (template_category !== undefined ? template_category : existing.template_category || 'certificate') as TemplateCategory;
  const updatedPaperSize = (paper_size !== undefined ? String(paper_size).toLowerCase() : existing.paper_size || 'a4') as PaperSize;
  const updatedHeaderHtml = header_html !== undefined ? String(header_html) : (existing.header_html ?? '');
  const updatedHeaderConfigJson =
    header_config_json !== undefined
      ? typeof header_config_json === 'string'
        ? header_config_json
        : JSON.stringify(header_config_json)
      : (existing.header_config_json ?? '{}');
  const updatedTitleHeader = title_header !== undefined ? title_header : existing.title_header;
  const updatedBodyHtml = body_html !== undefined ? body_html : existing.body_html;
  const updatedFooterHtml = footer_html !== undefined ? String(footer_html) : (existing.footer_html ?? '');
  const updatedSidebar = show_officials_sidebar !== undefined ? Number(show_officials_sidebar) : existing.show_officials_sidebar;
  const updatedDefaultFee = default_fee !== undefined ? Number(default_fee) : existing.default_fee;
  const updatedIsActive = is_active !== undefined ? (Number(is_active) ? 1 : 0) : existing.is_active;

  const candidateUpdated: CertificateTemplate = {
    ...existing,
    template_name: updatedTemplateName,
    template_category: updatedCategory,
    paper_size: updatedPaperSize,
    header_html: updatedHeaderHtml,
    header_config_json: updatedHeaderConfigJson,
    title_header: updatedTitleHeader,
    body_html: updatedBodyHtml,
    footer_html: updatedFooterHtml,
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
        UPDATE ${table}
        SET template_name = @template_name,
            template_category = @template_category,
            paper_size = @paper_size,
            header_html = @header_html,
            header_config_json = @header_config_json,
            title_header = @title_header,
            body_html = @body_html,
            footer_html = @footer_html,
            show_officials_sidebar = @show_officials_sidebar,
            default_fee = @default_fee,
            is_active = @is_active,
            updated_by = @updated_by,
            updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `).run({
        id: existing.id,
        template_name: candidateUpdated.template_name,
        template_category: candidateUpdated.template_category,
        paper_size: candidateUpdated.paper_size,
        header_html: candidateUpdated.header_html,
        header_config_json: candidateUpdated.header_config_json,
        title_header: candidateUpdated.title_header,
        body_html: candidateUpdated.body_html,
        footer_html: candidateUpdated.footer_html,
        show_officials_sidebar: candidateUpdated.show_officials_sidebar,
        default_fee: candidateUpdated.default_fee,
        is_active: candidateUpdated.is_active,
        updated_by: req.user!.id
      });

      updatedTemplate = db.prepare(`
        SELECT ${TEMPLATE_COLUMNS}
        FROM ${table}
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
        oldData: existing as unknown as Record<string, any>,
        newData: updatedTemplate as unknown as Record<string, any>,
        clientIp: req.clientIp
      });
    });

    updateTemplateTx();

    try {
      saveTemplateDocxToDisk(updatedTemplate!);
    } catch {
      // Non-fatal
    }

    res.status(200).json(updatedTemplate!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template', details: (error as Error).message });
  }
});

/**
 * POST /api/templates
 * Creates a new certificate or blotter template. Restricted strictly to Admin.
 */
router.post('/', requireRole('Admin'), (req: Request, res: Response): void => {
  const {
    template_code,
    template_name,
    template_category = 'certificate',
    paper_size = 'a4',
    header_html,
    header_config_json,
    title_header,
    body_html,
    footer_html = '',
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
  const existing = findTemplateWithTable(cleanCode);
  if (existing) {
    res.status(409).json({ error: 'A template with this template_code already exists' });
    return;
  }

  const cleanCategory: TemplateCategory = template_category === 'blotter' ? 'blotter' : 'certificate';
  const cleanPaperSize: PaperSize = ['short', 'a4', 'long'].includes(String(paper_size).toLowerCase())
    ? (String(paper_size).toLowerCase() as PaperSize)
    : 'a4';

  const targetTable = cleanCategory === 'blotter' ? 'blotter_templates' : 'certificate_templates';
  const defaultHdr = cleanCategory === 'blotter' ? DEFAULT_BLOTTER_HEADER_HTML : DEFAULT_CERTIFICATE_HEADER_HTML;
  const resolvedHeaderHtml = typeof header_html === 'string' && header_html.trim() ? header_html : defaultHdr;
  const resolvedHeaderConfig =
    typeof header_config_json === 'string'
      ? header_config_json
      : header_config_json && typeof header_config_json === 'object'
      ? JSON.stringify(header_config_json)
      : JSON.stringify({
          show_left_seal: true,
          show_right_seal: true,
          seal_size: 'md',
          show_control_number: true,
          border_style: cleanCategory === 'blotter' ? 'double' : 'solid',
          alignment: 'center',
          office_subtitle:
            cleanCategory === 'blotter'
              ? 'Office of the Lupong Tagapamayapa'
              : 'Office of the Punong Barangay'
        });

  const docxFilename = `${cleanCode.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

  try {
    let createdTemplate: CertificateTemplate;

    const createTemplateTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO ${targetTable} (
          template_code, template_name, template_category, paper_size,
          header_html, header_config_json, title_header, body_html,
          footer_html, docx_filename, show_officials_sidebar, default_fee,
          requires_blotter_check, is_active, updated_by, updated_at
        ) VALUES (
          @template_code, @template_name, @template_category, @paper_size,
          @header_html, @header_config_json, @title_header, @body_html,
          @footer_html, @docx_filename, @show_officials_sidebar, @default_fee,
          @requires_blotter_check, @is_active, @updated_by, datetime('now', 'localtime')
        )
      `).run({
        template_code: cleanCode,
        template_name: template_name.trim(),
        template_category: cleanCategory,
        paper_size: cleanPaperSize,
        header_html: resolvedHeaderHtml,
        header_config_json: resolvedHeaderConfig,
        title_header: title_header.trim().toUpperCase(),
        body_html: body_html.trim(),
        footer_html: typeof footer_html === 'string' ? footer_html : '',
        docx_filename: docxFilename,
        show_officials_sidebar: Number(show_officials_sidebar) ? 1 : 0,
        default_fee: Math.max(0, Number(default_fee) || 0),
        requires_blotter_check: Number(requires_blotter_check) ? 1 : 0,
        is_active: Number(is_active) ? 1 : 0,
        updated_by: req.user!.id
      });

      createdTemplate = db.prepare(`
        SELECT ${TEMPLATE_COLUMNS}
        FROM ${targetTable}
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
        newData: createdTemplate as unknown as Record<string, any>,
        clientIp: req.clientIp
      });
    });

    createTemplateTx();

    try {
      saveTemplateDocxToDisk(createdTemplate!);
    } catch {
      // Non-fatal
    }

    res.status(201).json(createdTemplate!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template', details: (error as Error).message });
  }
});

export default router;
