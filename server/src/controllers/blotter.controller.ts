import { Request, Response } from 'express';
import { db } from '../db/connection';
import {
  createBlotter,
  getBlotters,
  getBlotterById,
  updateBlotter,
  archiveBlotter,
  checkResidentBlotter
} from '../services/blotter.service';
import { BLOTTER_STATUSES, BlotterStatus } from '../types/blotter';
import { CertificateTemplate } from '../types/templates';
import { BarangayOfficial } from '../types/officials';
import { interpolateTemplate, getOfficialsSidebarData, DEFAULT_BLOTTER_HEADER_HTML } from '../services/template.service';
import { generateDocxBuffer } from '../services/docx.service';
import { logAuditEvent } from '../services/audit.service';

/**
 * GET /api/blotter
 * List blotter cases with filtering by status, search, respondent_id, is_archived, and pagination.
 * Accessible to Admin and Lupon.
 */
export async function getBlotterListController(req: Request, res: Response): Promise<void> {
  try {
    const { status, search, respondent_id, is_archived, page, limit } = req.query;

    const filter = {
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      respondent_id: respondent_id ? parseInt(String(respondent_id), 10) : undefined,
      is_archived: typeof is_archived === 'string' ? is_archived : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined
    };

    const result = getBlotters(filter);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error listing blotter cases:', error);
    res.status(500).json({ error: 'Internal server error listing blotter cases' });
  }
}

/**
 * GET /api/blotter/:id
 * Retrieve detailed blotter case inspection.
 * Accessible to Admin and Lupon.
 */
export async function getBlotterByIdController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const record = getBlotterById(id);
    if (!record) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    res.status(200).json(record);
  } catch (error: any) {
    console.error('Error fetching blotter case:', error);
    res.status(500).json({ error: 'Internal server error fetching blotter case' });
  }
}

/**
 * POST /api/blotter
 * Create a new blotter case with auto-generated BLT-YYYY-NNN case number.
 * Accessible to Admin and Lupon.
 */
export async function createBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const {
      complainant_name,
      respondent_name,
      incident_type,
      incident_details,
      complainant_id,
      respondent_id,
      incident_location,
      date_incident,
      status
    } = req.body;

    if (!complainant_name || typeof complainant_name !== 'string' || complainant_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: complainant_name' });
      return;
    }
    if (!respondent_name || typeof respondent_name !== 'string' || respondent_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: respondent_name' });
      return;
    }
    if (!incident_type || typeof incident_type !== 'string' || incident_type.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: incident_type' });
      return;
    }
    if (!incident_details || typeof incident_details !== 'string' || incident_details.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: incident_details' });
      return;
    }

    if (status !== undefined && !BLOTTER_STATUSES.includes(status as BlotterStatus)) {
      res.status(400).json({
        error: `Invalid status "${status}". Allowed statuses: ${BLOTTER_STATUSES.join(', ')}`
      });
      return;
    }

    // Verify foreign keys if provided
    if (complainant_id !== undefined && complainant_id !== null) {
      const cId = Number(complainant_id);
      if (isNaN(cId) || cId <= 0) {
        res.status(400).json({ error: 'complainant_id must be a valid positive integer' });
        return;
      }
      const cExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(cId);
      if (!cExists) {
        res.status(400).json({ error: `Complainant resident ID (${cId}) does not exist in residents` });
        return;
      }
    }

    if (respondent_id !== undefined && respondent_id !== null) {
      const rId = Number(respondent_id);
      if (isNaN(rId) || rId <= 0) {
        res.status(400).json({ error: 'respondent_id must be a valid positive integer' });
        return;
      }
      const rExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(rId);
      if (!rExists) {
        res.status(400).json({ error: `Respondent resident ID (${rId}) does not exist in residents` });
        return;
      }
    }

    const newRecord = createBlotter(
      {
        complainant_name,
        respondent_name,
        incident_type,
        incident_details,
        complainant_id: complainant_id !== undefined && complainant_id !== null ? Number(complainant_id) : null,
        respondent_id: respondent_id !== undefined && respondent_id !== null ? Number(respondent_id) : null,
        incident_location,
        date_incident,
        status: status as BlotterStatus
      },
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(201).json(newRecord);
  } catch (error: any) {
    console.error('Error creating blotter case:', error);
    if (error.message && (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('does not exist'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error creating blotter case' });
  }
}

/**
 * PUT /api/blotter/:id
 * Update blotter case status and details with JSON diff audit logging.
 * Accessible to Admin and Lupon.
 */
export async function updateBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const existing = getBlotterById(id);
    if (!existing) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    const payload = req.body;

    if (payload.status !== undefined && !BLOTTER_STATUSES.includes(payload.status as BlotterStatus)) {
      res.status(400).json({
        error: `Invalid status "${payload.status}". Permitted statuses: ${BLOTTER_STATUSES.join(', ')}`
      });
      return;
    }

    if (payload.incident_details !== undefined && (typeof payload.incident_details !== 'string' || payload.incident_details.trim().length === 0)) {
      res.status(400).json({ error: 'incident_details cannot be empty' });
      return;
    }

    if (payload.incident_type !== undefined && (typeof payload.incident_type !== 'string' || payload.incident_type.trim().length === 0)) {
      res.status(400).json({ error: 'incident_type cannot be empty' });
      return;
    }

    if (payload.complainant_name !== undefined && (typeof payload.complainant_name !== 'string' || payload.complainant_name.trim().length === 0)) {
      res.status(400).json({ error: 'complainant_name cannot be empty' });
      return;
    }

    if (payload.respondent_name !== undefined && (typeof payload.respondent_name !== 'string' || payload.respondent_name.trim().length === 0)) {
      res.status(400).json({ error: 'respondent_name cannot be empty' });
      return;
    }

    if (payload.complainant_id !== undefined && payload.complainant_id !== null) {
      const cId = Number(payload.complainant_id);
      if (isNaN(cId) || cId <= 0) {
        res.status(400).json({ error: 'complainant_id must be a valid positive integer' });
        return;
      }
      const cExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(cId);
      if (!cExists) {
        res.status(400).json({ error: `Complainant resident ID (${cId}) does not exist in residents` });
        return;
      }
    }

    if (payload.respondent_id !== undefined && payload.respondent_id !== null) {
      const rId = Number(payload.respondent_id);
      if (isNaN(rId) || rId <= 0) {
        res.status(400).json({ error: 'respondent_id must be a valid positive integer' });
        return;
      }
      const rExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(rId);
      if (!rExists) {
        res.status(400).json({ error: `Respondent resident ID (${rId}) does not exist in residents` });
        return;
      }
    }

    const updated = updateBlotter(
      id,
      payload,
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error updating blotter case:', error);
    if (error.message && (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('cannot be empty') || error.message.includes('does not exist'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error updating blotter case' });
  }
}

/**
 * PATCH /api/blotter/:id/archive
 * Soft-delete blotter record (is_archived = 1) and record ARCHIVE audit log.
 * Restricted strictly to Admin.
 */
export async function archiveBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const existing = getBlotterById(id);
    if (!existing) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    archiveBlotter(
      id,
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(200).json({ message: 'Blotter case archived successfully' });
  } catch (error: any) {
    console.error('Error archiving blotter case:', error);
    res.status(500).json({ error: 'Internal server error archiving blotter case' });
  }
}

/**
 * GET /api/residents/:id/blotter-check
 * Fast automated clearance gatekeeper check returning { cleared: boolean, cases: [...] }.
 * Accessible to all authenticated staff (Admin, Clerk, Treasurer, Lupon).
 */
export async function checkResidentBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid resident ID' });
      return;
    }

    const resident = db.prepare('SELECT id FROM residents WHERE id = ?').get(id);
    if (!resident) {
      res.status(404).json({ error: 'Resident not found' });
      return;
    }

    const checkResult = checkResidentBlotter(id);
    res.status(200).json(checkResult);
  } catch (error: any) {
    console.error('Error performing blotter gatekeeper check:', error);
    res.status(500).json({ error: 'Internal server error performing blotter gatekeeper check' });
  }
}

/**
 * Resolves the appropriate Blotter/KP template from blotter_templates or certificate_templates.
 */
function resolveBlotterTemplate(templateId?: number, templateCode?: string, status?: string): CertificateTemplate | undefined {
  if (templateId && !isNaN(Number(templateId))) {
    const fromBlotter = db.prepare('SELECT * FROM blotter_templates WHERE id = ?').get(Number(templateId)) as CertificateTemplate | undefined;
    if (fromBlotter) return fromBlotter;
    const fromCert = db.prepare('SELECT * FROM certificate_templates WHERE id = ?').get(Number(templateId)) as CertificateTemplate | undefined;
    if (fromCert) return fromCert;
  }

  const targetCode = templateCode || (
    status === 'Settled'
      ? 'KP_SETTLEMENT'
      : status === 'CFA Issued' || status === 'Escalated to Police/Court'
      ? 'KP_CFA'
      : status === 'Under Mediation'
      ? 'KP_SUMMONS'
      : 'BLOTTER_EXTRACT'
  );

  const byCode = db.prepare('SELECT * FROM blotter_templates WHERE template_code = ?').get(targetCode) as CertificateTemplate | undefined;
  if (byCode) return byCode;

  const byCodeCert = db.prepare('SELECT * FROM certificate_templates WHERE template_code = ?').get(targetCode) as CertificateTemplate | undefined;
  if (byCodeCert) return byCodeCert;

  return db.prepare('SELECT * FROM blotter_templates ORDER BY id ASC LIMIT 1').get() as CertificateTemplate | undefined;
}

/**
 * POST /api/blotter/:id/print-preview
 * Renders an interpolated Blotter / KP form for printing or previewing.
 * Accessible to Admin and Lupon.
 */
export async function previewBlotterPrintController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const record = getBlotterById(id);
    if (!record) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    const {
      template_id,
      template_code,
      signatory_official_id,
      is_oic_signing,
      hearing_date,
      paper_size,
      log_print
    } = req.body || {};

    const template = resolveBlotterTemplate(
      template_id ? Number(template_id) : undefined,
      typeof template_code === 'string' ? template_code : undefined,
      record.status
    );

    if (!template) {
      res.status(404).json({ error: 'Blotter template not found' });
      return;
    }

    let signatory: BarangayOfficial | undefined;
    if (signatory_official_id && !isNaN(Number(signatory_official_id))) {
      signatory = db.prepare('SELECT * FROM barangay_officials WHERE id = ?').get(Number(signatory_official_id)) as BarangayOfficial | undefined;
    }
    if (!signatory) {
      signatory = db.prepare("SELECT * FROM barangay_officials WHERE is_active = 1 ORDER BY CASE WHEN position = 'Punong Barangay' THEN 0 ELSE 1 END, rank_order ASC LIMIT 1").get() as BarangayOfficial | undefined;
    }

    const isOic = Boolean(
      is_oic_signing === true ||
      is_oic_signing === 1 ||
      String(is_oic_signing).toLowerCase() === 'true' ||
      String(is_oic_signing) === '1'
    );

    const interpContext = {
      control_number: record.case_number,
      case_number: record.case_number,
      complainant_name: record.complainant_name,
      respondent_name: record.respondent_name,
      incident_type: record.incident_type,
      incident_location: record.incident_location || 'Barangay Jurisdiction',
      incident_details: record.incident_details,
      date_incident: record.date_incident,
      date_recorded: record.date_recorded,
      status: record.status,
      settlement_notes: record.settlement_notes || 'Pending formal settlement terms.',
      hearing_date: hearing_date ? String(hearing_date).trim() : undefined,
      signatory_official_id: signatory?.id,
      signatory_name: signatory?.full_name || 'PUNONG BARANGAY',
      signatory_position: signatory?.position || 'Punong Barangay',
      is_oic_signing: isOic ? 1 : 0,
      transaction_date: new Date()
    };

    const html = interpolateTemplate(template.body_html || '', interpContext);
    const rawHeader = template.header_html || DEFAULT_BLOTTER_HEADER_HTML;
    const header_html = interpolateTemplate(rawHeader, interpContext);
    const footer_html = interpolateTemplate(template.footer_html || '', interpContext);
    const sidebar_officials = getOfficialsSidebarData();

    const resolvedPaperSize =
      paper_size === 'short' || paper_size === 'a4' || paper_size === 'long'
        ? paper_size
        : (template.paper_size as 'short' | 'a4' | 'long') || 'short';

    if (log_print && req.user) {
      logAuditEvent({
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'PRINT_CERTIFICATE',
        entityType: 'blotter',
        entityId: record.id,
        summaryText: `Printed ${template.template_name} (${record.case_number})`,
        newData: {
          case_number: record.case_number,
          template_code: template.template_code,
          template_name: template.template_name,
          paper_size: resolvedPaperSize
        },
        clientIp: req.clientIp
      });
    }

    res.status(200).json({
      html,
      header_html,
      header_config_json: template.header_config_json || '{}',
      footer_html,
      title_header: template.title_header,
      template_id: template.id,
      template_code: template.template_code,
      template_name: template.template_name,
      paper_size: resolvedPaperSize,
      show_officials_sidebar: template.show_officials_sidebar,
      sidebar_officials,
      case_number: record.case_number,
      signatory_name: signatory?.full_name || 'PUNONG BARANGAY',
      signatory_position: signatory?.position || 'Punong Barangay',
      is_oic_signing: isOic ? 1 : 0,
      blotter: record
    });
  } catch (error: any) {
    console.error('Error generating blotter print preview:', error);
    res.status(500).json({ error: 'Internal server error generating blotter print preview' });
  }
}

/**
 * POST /api/blotter/:id/export-docx
 * Generates and downloads a filled MS Word (.docx) document for a Blotter / KP case.
 * Accessible to Admin and Lupon.
 */
export async function exportBlotterDocxController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const record = getBlotterById(id);
    if (!record) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    const {
      template_id,
      template_code,
      signatory_official_id,
      is_oic_signing,
      hearing_date,
      paper_size
    } = req.body || {};

    const template = resolveBlotterTemplate(
      template_id ? Number(template_id) : undefined,
      typeof template_code === 'string' ? template_code : undefined,
      record.status
    );

    if (!template) {
      res.status(404).json({ error: 'Blotter template not found' });
      return;
    }

    let signatory: BarangayOfficial | undefined;
    if (signatory_official_id && !isNaN(Number(signatory_official_id))) {
      signatory = db.prepare('SELECT * FROM barangay_officials WHERE id = ?').get(Number(signatory_official_id)) as BarangayOfficial | undefined;
    }
    if (!signatory) {
      signatory = db.prepare("SELECT * FROM barangay_officials WHERE is_active = 1 ORDER BY CASE WHEN position = 'Punong Barangay' THEN 0 ELSE 1 END, rank_order ASC LIMIT 1").get() as BarangayOfficial | undefined;
    }

    const isOic = Boolean(
      is_oic_signing === true ||
      is_oic_signing === 1 ||
      String(is_oic_signing).toLowerCase() === 'true' ||
      String(is_oic_signing) === '1'
    );

    const interpContext = {
      control_number: record.case_number,
      case_number: record.case_number,
      complainant_name: record.complainant_name,
      respondent_name: record.respondent_name,
      incident_type: record.incident_type,
      incident_location: record.incident_location || 'Barangay Jurisdiction',
      incident_details: record.incident_details,
      date_incident: record.date_incident,
      date_recorded: record.date_recorded,
      status: record.status,
      settlement_notes: record.settlement_notes || 'Pending formal settlement terms.',
      hearing_date: hearing_date ? String(hearing_date).trim() : undefined,
      signatory_official_id: signatory?.id,
      signatory_name: signatory?.full_name || 'PUNONG BARANGAY',
      signatory_position: signatory?.position || 'Punong Barangay',
      is_oic_signing: isOic ? 1 : 0,
      transaction_date: new Date()
    };

    const html = interpolateTemplate(template.body_html || '', interpContext);
    const rawHeader = template.header_html || DEFAULT_BLOTTER_HEADER_HTML;
    const header_html = interpolateTemplate(rawHeader, interpContext);
    const footer_html = interpolateTemplate(template.footer_html || '', interpContext);

    const resolvedPaperSize =
      paper_size === 'short' || paper_size === 'a4' || paper_size === 'long'
        ? paper_size
        : (template.paper_size as 'short' | 'a4' | 'long') || 'short';

    const buffer = generateDocxBuffer({
      titleHeader: template.title_header,
      headerHtml: header_html,
      bodyHtml: html,
      footerHtml: footer_html,
      paperSize: resolvedPaperSize,
      controlNumber: record.case_number
    });

    if (req.user) {
      logAuditEvent({
        userId: req.user.id,
        username: req.user.username,
        userRole: req.user.role,
        action: 'PRINT_CERTIFICATE',
        entityType: 'blotter',
        entityId: record.id,
        summaryText: `Exported ${template.template_name} (.docx) for ${record.case_number}`,
        newData: {
          case_number: record.case_number,
          template_code: template.template_code,
          paper_size: resolvedPaperSize
        },
        clientIp: req.clientIp
      });
    }

    const safeCase = record.case_number.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeCode = template.template_code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeCase}_${safeCode}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error: any) {
    console.error('Error exporting blotter docx:', error);
    res.status(500).json({ error: 'Internal server error exporting blotter .docx' });
  }
}
