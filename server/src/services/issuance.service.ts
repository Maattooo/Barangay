import { db } from '../db/connection';
import {
  CertificateIssuance,
  PreviewIssuanceInput,
  CreateIssuanceInput,
  PreviewIssuanceResponse,
  PrintableIssuancePayload,
  IssuanceQueryParams,
  IssuanceListItem,
  IssuanceListResponse
} from '../types/issuances';
import { Resident } from '../types/resident';
import { CertificateTemplate } from '../types/templates';
import { BarangayOfficial } from '../types/officials';
import { checkResidentBlotter, validateBlotterOverride } from './blotter.service';
import { interpolateTemplate, getOfficialsSidebarData } from './template.service';
import { logAuditEvent } from './audit.service';

export class IssuanceError extends Error {
  statusCode: number;
  cases?: any[];

  constructor(message: string, statusCode = 400, cases?: any[]) {
    super(message);
    this.name = 'IssuanceError';
    this.statusCode = statusCode;
    this.cases = cases;
  }
}

/**
 * Generates a sequential control number strictly formatted as CERT-YYYY-NNNNN.
 * If targetYear is provided, generates sequence for that year; otherwise defaults to current year.
 * When sequence exceeds 99999, formats without truncation.
 * Counter automatically resets to 00001 upon calendar year rollover.
 */
export function generateControlNumber(targetYear?: number): string {
  const year = targetYear !== undefined ? targetYear : new Date().getFullYear();

  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(control_number, 11) AS INTEGER)) AS max_seq
    FROM certificate_issuances
    WHERE control_number LIKE ?
  `).get(`CERT-${year}-%`) as { max_seq: number | null } | undefined;

  const nextSeq = (row?.max_seq && row.max_seq > 0) ? row.max_seq + 1 : 1;
  const padded = nextSeq < 100000 ? String(nextSeq).padStart(5, '0') : String(nextSeq);
  return `CERT-${year}-${padded}`;
}

/**
 * Validates and retrieves the resident, certificate template, and signatory official.
 */
function fetchIssuanceEntities(residentId: number, templateId: number, signatoryOfficialId: number) {
  if (!residentId || isNaN(residentId) || residentId <= 0) {
    throw new IssuanceError('Invalid resident ID', 400);
  }
  if (!templateId || isNaN(templateId) || templateId <= 0) {
    throw new IssuanceError('Invalid template ID', 400);
  }
  if (!signatoryOfficialId || isNaN(signatoryOfficialId) || signatoryOfficialId <= 0) {
    throw new IssuanceError('Invalid signatory official ID', 400);
  }

  const resident = db.prepare(`
    SELECT * FROM residents WHERE id = ?
  `).get(residentId) as Resident | undefined;

  if (!resident) {
    throw new IssuanceError('Resident not found', 404);
  }

  const template = db.prepare(`
    SELECT * FROM certificate_templates WHERE id = ?
  `).get(templateId) as CertificateTemplate | undefined;

  if (!template) {
    throw new IssuanceError('Certificate template not found', 404);
  }

  if (template.is_active !== 1) {
    throw new IssuanceError('Certificate template is inactive', 400);
  }

  const signatory = db.prepare(`
    SELECT * FROM barangay_officials WHERE id = ?
  `).get(signatoryOfficialId) as BarangayOfficial | undefined;

  if (!signatory) {
    throw new IssuanceError('Signatory official not found', 404);
  }

  if (signatory.is_active !== 1) {
    throw new IssuanceError('Signatory official is not active', 400);
  }

  return { resident, template, signatory };
}

/**
 * Read-only Certificate Preview rendering pipeline.
 * Performs ZERO writes to database or audit logs.
 */
export function previewIssuance(input: PreviewIssuanceInput): PreviewIssuanceResponse {
  const { resident, template, signatory } = fetchIssuanceEntities(
    input.resident_id,
    input.template_id,
    input.signatory_official_id
  );

  const blotterCheck = checkResidentBlotter(input.resident_id);

  const year = new Date().getFullYear();
  const control_number_preview = `CERT-${year}-PREVIEW`;

  const amountPaidVal = input.amount_paid !== undefined && input.amount_paid !== null
    ? Number(input.amount_paid)
    : template.default_fee;

  const isOic = Boolean(
    input.is_oic_signing === true ||
    input.is_oic_signing === 1 ||
    String(input.is_oic_signing).toLowerCase() === 'true' ||
    String(input.is_oic_signing) === '1'
  );

  const html = interpolateTemplate(template.body_html, {
    resident,
    purpose: (input.purpose || '').trim(),
    or_number: (input.or_number || '').trim(),
    amount_paid: amountPaidVal,
    control_number: control_number_preview,
    signatory_official_id: signatory.id,
    is_oic_signing: isOic ? 1 : 0,
    transaction_date: new Date()
  });

  const sidebar_officials = getOfficialsSidebarData();

  return {
    html,
    title_header: template.title_header,
    show_officials_sidebar: template.show_officials_sidebar,
    control_number_preview,
    sidebar_officials,
    blotter_status: blotterCheck,
    default_fee: template.default_fee
  };
}

/**
 * Atomic Certificate Issuance Transaction.
 * Validates entities, evaluates Blotter Gatekeeper, records signatory snapshots,
 * inserts issuance record, and writes immutable audit logs (PRINT_CERTIFICATE + BLOTTER_OVERRIDE).
 */
export function createIssuance(
  input: CreateIssuanceInput,
  user: { id: number; username: string; role: string },
  clientIp?: string
): PrintableIssuancePayload {
  if (!input.purpose || typeof input.purpose !== 'string' || input.purpose.trim().length === 0) {
    throw new IssuanceError('Purpose is required', 400);
  }

  const { resident, template, signatory } = fetchIssuanceEntities(
    input.resident_id,
    input.template_id,
    input.signatory_official_id
  );

  // 1. Blotter Gatekeeper Verification
  const blotterCheck = checkResidentBlotter(input.resident_id);
  const isOverride = Boolean(
    input.is_override === true ||
    (input.is_override as unknown) === 1 ||
    String(input.is_override).toLowerCase() === 'true' ||
    String(input.is_override) === '1'
  );

  let had_active_blotter = 0;
  let blotter_override_reason = '';

  if (!blotterCheck.cleared) {
    if (!isOverride) {
      throw new IssuanceError(
        'Resident has active blotter records. Authorization override required.',
        400,
        blotterCheck.cases
      );
    }

    const overrideValidation = validateBlotterOverride(true, input.blotter_override_reason);
    if (!overrideValidation.valid) {
      throw new IssuanceError(
        overrideValidation.error || 'Blotter override reason must be at least 10 characters long',
        400
      );
    }

    had_active_blotter = 1;
    blotter_override_reason = input.blotter_override_reason!.trim();
  } else {
    had_active_blotter = 0;
    blotter_override_reason = '';
  }

  // 2. Signatory Snapshots
  const signatory_name_snapshot = signatory.full_name;
  const signatory_position_snapshot = signatory.position;

  const isOic = Boolean(
    input.is_oic_signing === true ||
    input.is_oic_signing === 1 ||
    String(input.is_oic_signing).toLowerCase() === 'true' ||
    String(input.is_oic_signing) === '1'
  );
  const is_oic_signing = isOic ? 1 : 0;

  const amountPaidVal = input.amount_paid !== undefined && input.amount_paid !== null && !isNaN(Number(input.amount_paid))
    ? Number(input.amount_paid)
    : template.default_fee;

  const orNumberVal = input.or_number !== undefined && input.or_number !== null
    ? input.or_number.trim()
    : (amountPaidVal === 0 ? 'FREE / EXEMPT' : '');

  const ctcNumberVal = (input.ctc_number || '').trim();
  const ctcDateVal = (input.ctc_date_issued || '').trim();
  const ctcPlaceVal = (input.ctc_place_issued || '').trim();
  const purposeVal = input.purpose.trim();

  // 3. Atomic SQLite Transaction
  const issuanceTx = db.transaction(() => {
    const control_number = generateControlNumber();

    const insertStmt = db.prepare(`
      INSERT INTO certificate_issuances (
        control_number,
        resident_id,
        template_id,
        purpose,
        or_number,
        amount_paid,
        ctc_number,
        ctc_date_issued,
        ctc_place_issued,
        signatory_official_id,
        signatory_name_snapshot,
        signatory_position_snapshot,
        is_oic_signing,
        had_active_blotter,
        blotter_override_reason,
        issued_by_user_id,
        issued_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime')
      )
    `);

    const result = insertStmt.run(
      control_number,
      input.resident_id,
      input.template_id,
      purposeVal,
      orNumberVal,
      amountPaidVal,
      ctcNumberVal,
      ctcDateVal,
      ctcPlaceVal,
      signatory.id,
      signatory_name_snapshot,
      signatory_position_snapshot,
      is_oic_signing,
      had_active_blotter,
      blotter_override_reason,
      user.id
    );

    const newId = Number(result.lastInsertRowid);
    const issuanceRecord = db.prepare(`
      SELECT * FROM certificate_issuances WHERE id = ?
    `).get(newId) as CertificateIssuance;

    // Resident full name for human-readable audit summary
    const resNameParts = [
      resident.first_name,
      resident.middle_name,
      resident.last_name,
      resident.suffix
    ].filter(Boolean).map(s => String(s).trim());
    const residentFullName = resNameParts.join(' ').toUpperCase();

    // Log PRINT_CERTIFICATE audit event
    logAuditEvent({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'PRINT_CERTIFICATE',
      entityType: 'issuance',
      entityId: newId,
      summaryText: `Issued ${template.template_name} (${control_number}) for ${residentFullName}`,
      newData: issuanceRecord as unknown as Record<string, any>,
      clientIp: clientIp || '127.0.0.1'
    });

    // If gatekeeper override was exercised, log BLOTTER_OVERRIDE audit event concurrently
    if (had_active_blotter === 1) {
      logAuditEvent({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        action: 'BLOTTER_OVERRIDE',
        entityType: 'issuance',
        entityId: newId,
        summaryText: `Blotter override authorized for ${control_number}: ${blotter_override_reason}`,
        newData: {
          control_number,
          resident_id: input.resident_id,
          blotter_override_reason,
          pending_cases: blotterCheck.cases
        },
        clientIp: clientIp || '127.0.0.1'
      });
    }

    return issuanceRecord;
  });

  const savedIssuance = issuanceTx();

  // 4. Generate printable HTML payload
  const html = interpolateTemplate(template.body_html, {
    resident,
    purpose: savedIssuance.purpose,
    or_number: savedIssuance.or_number,
    amount_paid: savedIssuance.amount_paid,
    control_number: savedIssuance.control_number,
    signatory_official_id: savedIssuance.signatory_official_id,
    is_oic_signing: savedIssuance.is_oic_signing,
    transaction_date: savedIssuance.issued_at
  });

  const sidebar_officials = getOfficialsSidebarData();

  return {
    issuance: savedIssuance,
    html,
    sidebar_officials,
    template_name: template.template_name,
    title_header: template.title_header,
    show_officials_sidebar: template.show_officials_sidebar
  };
}

/**
 * Retrieves a paginated and filtered list of certificate issuance records.
 */
export function getIssuances(params: IssuanceQueryParams): IssuanceListResponse {
  const conditions: string[] = [];
  const queryArgs: any[] = [];

  // Date range filter
  if (params.start_date && typeof params.start_date === 'string' && params.start_date.trim()) {
    conditions.push("date(ci.issued_at) >= date(?)");
    queryArgs.push(params.start_date.trim());
  }
  if (params.end_date && typeof params.end_date === 'string' && params.end_date.trim()) {
    conditions.push("date(ci.issued_at) <= date(?)");
    queryArgs.push(params.end_date.trim());
  }

  // Template filter
  if (params.template_id !== undefined && params.template_id !== null && String(params.template_id).trim() !== '') {
    const tid = Number(params.template_id);
    if (!isNaN(tid)) {
      conditions.push("ci.template_id = ?");
      queryArgs.push(tid);
    }
  }

  // Issuing Clerk / Staff filter
  if (params.issued_by_user_id !== undefined && params.issued_by_user_id !== null && String(params.issued_by_user_id).trim() !== '') {
    const uid = Number(params.issued_by_user_id);
    if (!isNaN(uid)) {
      conditions.push("ci.issued_by_user_id = ?");
      queryArgs.push(uid);
    }
  }

  // Had active blotter filter
  if (params.had_active_blotter !== undefined && params.had_active_blotter !== null && String(params.had_active_blotter).trim() !== '') {
    const val = Number(params.had_active_blotter);
    if (!isNaN(val)) {
      conditions.push("ci.had_active_blotter = ?");
      queryArgs.push(val);
    }
  }

  // Search filter (across control_number, purpose, or_number, and resident full name)
  if (params.search && typeof params.search === 'string' && params.search.trim().length > 0) {
    const pattern = `%${params.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(ci.control_number) LIKE ? OR
      LOWER(ci.purpose) LIKE ? OR
      LOWER(ci.or_number) LIKE ? OR
      LOWER(r.first_name || ' ' || r.last_name) LIKE ? OR
      LOWER(r.last_name || ' ' || r.first_name) LIKE ?
    )`);
    queryArgs.push(pattern, pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM certificate_issuances ci
    LEFT JOIN residents r ON ci.resident_id = r.id
    ${whereClause}
  `);
  const countRow = countStmt.get(...queryArgs) as { total: number };
  const total = countRow ? countRow.total : 0;

  // Pagination parameters
  const page = Math.max(1, params.page ? parseInt(String(params.page), 10) || 1 : 1);
  const limit = Math.min(100, Math.max(1, params.limit ? parseInt(String(params.limit), 10) || 20 : 20));
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  // Data query
  const dataStmt = db.prepare(`
    SELECT 
      ci.*,
      TRIM(r.first_name || CASE WHEN r.middle_name IS NOT NULL AND TRIM(r.middle_name) != '' THEN ' ' || TRIM(r.middle_name) ELSE '' END || ' ' || r.last_name || CASE WHEN r.suffix IS NOT NULL AND TRIM(r.suffix) != '' THEN ' ' || TRIM(r.suffix) ELSE '' END) AS resident_name,
      t.template_name,
      t.template_code,
      u.full_name AS issued_by_name
    FROM certificate_issuances ci
    LEFT JOIN residents r ON ci.resident_id = r.id
    LEFT JOIN certificate_templates t ON ci.template_id = t.id
    LEFT JOIN users u ON ci.issued_by_user_id = u.id
    ${whereClause}
    ORDER BY ci.issued_at DESC, ci.id DESC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...queryArgs, limit, offset) as IssuanceListItem[];

  return {
    data: rows,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
}

/**
 * Retrieves a single certificate issuance record by ID,
 * complete with pre-interpolated printable HTML and council sidebar data.
 */
export function getIssuanceById(id: number) {
  const issuance = db.prepare(`
    SELECT 
      ci.*,
      TRIM(r.first_name || CASE WHEN r.middle_name IS NOT NULL AND TRIM(r.middle_name) != '' THEN ' ' || TRIM(r.middle_name) ELSE '' END || ' ' || r.last_name || CASE WHEN r.suffix IS NOT NULL AND TRIM(r.suffix) != '' THEN ' ' || TRIM(r.suffix) ELSE '' END) AS resident_name,
      t.template_name,
      t.template_code,
      t.title_header,
      t.show_officials_sidebar,
      t.body_html,
      u.full_name AS issued_by_name
    FROM certificate_issuances ci
    LEFT JOIN residents r ON ci.resident_id = r.id
    LEFT JOIN certificate_templates t ON ci.template_id = t.id
    LEFT JOIN users u ON ci.issued_by_user_id = u.id
    WHERE ci.id = ?
  `).get(id) as (CertificateIssuance & {
    resident_name: string;
    template_name: string;
    template_code: string;
    title_header: string;
    show_officials_sidebar: number;
    body_html: string;
    issued_by_name: string;
  }) | undefined;

  if (!issuance) {
    return null;
  }

  const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(issuance.resident_id) as Resident | undefined;

  const html = interpolateTemplate(issuance.body_html || '', {
    resident,
    purpose: issuance.purpose,
    or_number: issuance.or_number,
    amount_paid: issuance.amount_paid,
    control_number: issuance.control_number,
    signatory_official_id: issuance.signatory_official_id,
    is_oic_signing: issuance.is_oic_signing,
    transaction_date: issuance.issued_at
  });

  const sidebar_officials = getOfficialsSidebarData();

  // Create clean issuance object matching CertificateIssuance
  const issuanceRecord: CertificateIssuance = {
    id: issuance.id,
    control_number: issuance.control_number,
    resident_id: issuance.resident_id,
    template_id: issuance.template_id,
    purpose: issuance.purpose,
    or_number: issuance.or_number,
    amount_paid: issuance.amount_paid,
    ctc_number: issuance.ctc_number,
    ctc_date_issued: issuance.ctc_date_issued,
    ctc_place_issued: issuance.ctc_place_issued,
    signatory_official_id: issuance.signatory_official_id,
    signatory_name_snapshot: issuance.signatory_name_snapshot,
    signatory_position_snapshot: issuance.signatory_position_snapshot,
    is_oic_signing: issuance.is_oic_signing,
    had_active_blotter: issuance.had_active_blotter,
    blotter_override_reason: issuance.blotter_override_reason,
    issued_by_user_id: issuance.issued_by_user_id,
    issued_at: issuance.issued_at
  };

  return {
    ...issuanceRecord,
    resident_name: issuance.resident_name,
    template_name: issuance.template_name,
    template_code: issuance.template_code,
    title_header: issuance.title_header,
    show_officials_sidebar: issuance.show_officials_sidebar,
    issued_by_name: issuance.issued_by_name,
    html,
    sidebar_officials,
    issuance: issuanceRecord
  };
}
