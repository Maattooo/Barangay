import { db } from '../db/connection';
import {
  BlotterStatus,
  BLOTTER_STATUSES,
  BlotterRecord,
  CreateBlotterInput,
  UpdateBlotterInput,
  BlotterCaseSummary,
  BlotterCheckResponse,
  BlotterQueryFilter,
  BlotterListResponse
} from '../types/blotter';
import { logAuditEvent, sanitizeObject, computeJsonDiff } from './audit.service';

/**
 * Generates a thread-safe sequential blotter case number formatted as BLT-YYYY-NNN.
 * If targetYear is provided, generates sequence for that year; otherwise defaults to current year.
 * Checks all existing records for the given year (including archived ones) to ensure monotonicity.
 */
export function generateCaseNumber(targetYear?: number): string {
  const year = targetYear !== undefined ? targetYear : new Date().getFullYear();

  const row = db.prepare(`
    SELECT MAX(CAST(SUBSTR(case_number, 10) AS INTEGER)) AS max_seq
    FROM blotter_records
    WHERE case_number LIKE ?
  `).get(`BLT-${year}-%`) as { max_seq: number | null } | undefined;

  const nextSeq = (row?.max_seq && row.max_seq > 0) ? row.max_seq + 1 : 1;
  const padded = nextSeq < 1000 ? String(nextSeq).padStart(3, '0') : String(nextSeq);
  return `BLT-${year}-${padded}`;
}

/**
 * Gatekeeper check verifying if a resident has any active/blocking blotter records.
 * Query matches non-archived cases with status in ('Active', 'Under Mediation', 'CFA Issued')
 * where respondent_id matches the resident ID.
 */
export function checkResidentBlotter(residentId: number): BlotterCheckResponse {
  const query = `
    SELECT id, case_number, complainant_name, respondent_id, respondent_name, incident_type, status, date_recorded
    FROM blotter_records
    WHERE respondent_id = ? AND is_archived = 0 AND status IN ('Active', 'Under Mediation', 'CFA Issued')
    ORDER BY date_recorded DESC
  `;

  const rows = db.prepare(query).all(residentId) as BlotterCaseSummary[];

  if (!rows || rows.length === 0) {
    return {
      cleared: true,
      cases: []
    };
  }

  return {
    cleared: false,
    cases: rows
  };
}

/**
 * Validates whether an active blotter override justification meets security requirements.
 * When hadActiveBlotter is true, overrideReason must be provided and >= 10 non-whitespace characters.
 */
export function validateBlotterOverride(
  hadActiveBlotter: boolean,
  overrideReason?: string
): { valid: boolean; error?: string } {
  if (!hadActiveBlotter) {
    return { valid: true };
  }

  if (
    overrideReason === undefined ||
    overrideReason === null ||
    typeof overrideReason !== 'string' ||
    overrideReason.trim().length < 10
  ) {
    return {
      valid: false,
      error: 'Blotter override reason must be at least 10 characters long'
    };
  }

  return { valid: true };
}

/**
 * Validates that an optional resident ID exists in the residents table.
 */
function assertResidentExists(residentId: number, fieldName: string): void {
  const resident = db.prepare('SELECT id FROM residents WHERE id = ?').get(residentId);
  if (!resident) {
    throw new Error(`Referenced ${fieldName} (${residentId}) does not exist in residents`);
  }
}

/**
 * Creates a new blotter case with sequential case numbering, resident linkage, and audit logging.
 */
export function createBlotter(
  input: CreateBlotterInput,
  user: { id: number; username: string; role: string },
  clientIp?: string
): BlotterRecord {
  // Required string validation
  if (!input.complainant_name || typeof input.complainant_name !== 'string' || input.complainant_name.trim().length === 0) {
    throw new Error('complainant_name is required');
  }
  if (!input.respondent_name || typeof input.respondent_name !== 'string' || input.respondent_name.trim().length === 0) {
    throw new Error('respondent_name is required');
  }
  if (!input.incident_type || typeof input.incident_type !== 'string' || input.incident_type.trim().length === 0) {
    throw new Error('incident_type is required');
  }
  if (!input.incident_details || typeof input.incident_details !== 'string' || input.incident_details.trim().length === 0) {
    throw new Error('incident_details is required');
  }

  // Status validation
  const status: BlotterStatus = input.status || 'Active';
  if (!BLOTTER_STATUSES.includes(status)) {
    throw new Error(`Invalid blotter status: "${input.status}". Permitted statuses: ${BLOTTER_STATUSES.join(', ')}`);
  }

  // Foreign key validations
  if (input.complainant_id !== undefined && input.complainant_id !== null) {
    assertResidentExists(input.complainant_id, 'complainant_id');
  }
  if (input.respondent_id !== undefined && input.respondent_id !== null) {
    assertResidentExists(input.respondent_id, 'respondent_id');
  }

  const insertTx = db.transaction(() => {
    const case_number = generateCaseNumber();

    const insertStmt = db.prepare(`
      INSERT INTO blotter_records (
        case_number,
        complainant_id,
        complainant_name,
        respondent_id,
        respondent_name,
        incident_type,
        incident_location,
        incident_details,
        date_incident,
        status,
        settlement_notes,
        is_archived,
        created_by,
        updated_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?
      )
    `);

    const result = insertStmt.run(
      case_number,
      input.complainant_id ?? null,
      input.complainant_name.trim(),
      input.respondent_id ?? null,
      input.respondent_name.trim(),
      input.incident_type.trim(),
      (input.incident_location || '').trim(),
      input.incident_details.trim(),
      input.date_incident ? input.date_incident.trim() : null,
      status,
      '',
      user.id,
      user.id
    );

    const newId = Number(result.lastInsertRowid);
    const newRecord = db.prepare('SELECT * FROM blotter_records WHERE id = ?').get(newId) as BlotterRecord;

    logAuditEvent({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'CREATE',
      entityType: 'blotter',
      entityId: newId,
      summaryText: `Created blotter case ${newRecord.case_number} (${newRecord.incident_type}) against ${newRecord.respondent_name}`,
      newData: sanitizeObject(newRecord as unknown as Record<string, any>),
      clientIp: clientIp || '127.0.0.1'
    });

    return newRecord;
  });

  return insertTx();
}

/**
 * Retrieves a paginated and filtered list of blotter records.
 */
export function getBlotters(filter: BlotterQueryFilter): BlotterListResponse {
  const conditions: string[] = [];
  const params: any[] = [];

  // Archive filtering: default is_archived = 0 unless specified
  if (filter.is_archived === '1' || filter.is_archived === 'true') {
    conditions.push('is_archived = 1');
  } else if (filter.is_archived === 'all') {
    // Include both active and archived
  } else {
    conditions.push('is_archived = 0');
  }

  // Status filtering (single status or comma-separated list)
  if (filter.status && typeof filter.status === 'string' && filter.status.trim().length > 0) {
    const rawStatuses = filter.status.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const validStatuses = rawStatuses.filter((s): s is BlotterStatus => BLOTTER_STATUSES.includes(s as BlotterStatus));
    if (validStatuses.length > 0) {
      const placeholders = validStatuses.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...validStatuses);
    } else {
      // Unrecognized statuses should match nothing
      conditions.push('1 = 0');
    }
  }

  // Search filtering (case-insensitive partial match on case_number, complainant_name, respondent_name, incident_type)
  if (filter.search && typeof filter.search === 'string' && filter.search.trim().length > 0) {
    const searchPattern = `%${filter.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(case_number) LIKE ? OR
      LOWER(complainant_name) LIKE ? OR
      LOWER(respondent_name) LIKE ? OR
      LOWER(incident_type) LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  // Respondent ID filtering
  if (filter.respondent_id !== undefined && !isNaN(Number(filter.respondent_id))) {
    conditions.push('respondent_id = ?');
    params.push(Number(filter.respondent_id));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Total count
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM blotter_records ${whereClause}`);
  const countRow = countStmt.get(...params) as { total: number };
  const total = countRow ? countRow.total : 0;

  // Pagination parameters
  const page = Math.max(1, filter.page ? parseInt(String(filter.page), 10) || 1 : 1);
  const limit = Math.min(100, Math.max(1, filter.limit ? parseInt(String(filter.limit), 10) || 20 : 20));
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  // Data query
  const dataStmt = db.prepare(`
    SELECT *
    FROM blotter_records
    ${whereClause}
    ORDER BY date_recorded DESC, id DESC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...params, limit, offset) as BlotterRecord[];

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
 * Retrieves a single blotter record by ID.
 */
export function getBlotterById(id: number): BlotterRecord | null {
  const row = db.prepare('SELECT * FROM blotter_records WHERE id = ?').get(id) as BlotterRecord | undefined;
  return row || null;
}

/**
 * Updates an existing blotter case and records an UPDATE audit event with diff.
 */
export function updateBlotter(
  id: number,
  input: UpdateBlotterInput,
  user: { id: number; username: string; role: string },
  clientIp?: string
): BlotterRecord {
  const existing = getBlotterById(id);
  if (!existing) {
    throw new Error('Blotter record not found');
  }

  const updates: Record<string, any> = {};

  if (input.status !== undefined) {
    if (!BLOTTER_STATUSES.includes(input.status)) {
      throw new Error(`Invalid blotter status: "${input.status}". Permitted statuses: ${BLOTTER_STATUSES.join(', ')}`);
    }
    updates.status = input.status;
  }

  if (input.settlement_notes !== undefined) {
    updates.settlement_notes = String(input.settlement_notes).trim();
  }

  if (input.incident_details !== undefined) {
    if (typeof input.incident_details !== 'string' || input.incident_details.trim().length === 0) {
      throw new Error('incident_details cannot be empty');
    }
    updates.incident_details = input.incident_details.trim();
  }

  if (input.incident_location !== undefined) {
    updates.incident_location = String(input.incident_location).trim();
  }

  if (input.incident_type !== undefined) {
    if (typeof input.incident_type !== 'string' || input.incident_type.trim().length === 0) {
      throw new Error('incident_type cannot be empty');
    }
    updates.incident_type = input.incident_type.trim();
  }

  if (input.date_incident !== undefined) {
    updates.date_incident = input.date_incident ? String(input.date_incident).trim() : null;
  }

  if (input.respondent_name !== undefined) {
    if (typeof input.respondent_name !== 'string' || input.respondent_name.trim().length === 0) {
      throw new Error('respondent_name cannot be empty');
    }
    updates.respondent_name = input.respondent_name.trim();
  }

  if (input.complainant_name !== undefined) {
    if (typeof input.complainant_name !== 'string' || input.complainant_name.trim().length === 0) {
      throw new Error('complainant_name cannot be empty');
    }
    updates.complainant_name = input.complainant_name.trim();
  }

  if (input.respondent_id !== undefined) {
    if (input.respondent_id !== null) {
      assertResidentExists(input.respondent_id, 'respondent_id');
      updates.respondent_id = input.respondent_id;
    } else {
      updates.respondent_id = null;
    }
  }

  if (input.complainant_id !== undefined) {
    if (input.complainant_id !== null) {
      assertResidentExists(input.complainant_id, 'complainant_id');
      updates.complainant_id = input.complainant_id;
    } else {
      updates.complainant_id = null;
    }
  }

  // Check diff to suppress no-op updates
  const diff = computeJsonDiff(existing as unknown as Record<string, any>, {
    ...(existing as unknown as Record<string, any>),
    ...updates
  });

  if (diff.changedKeys.length === 0) {
    return existing;
  }

  const updateTx = db.transaction(() => {
    const updateKeys = Object.keys(updates);
    const setClauses = updateKeys.map((k) => `${k} = ?`);
    setClauses.push('updated_by = ?');
    setClauses.push("updated_at = datetime('now', 'localtime')");

    const updateValues = updateKeys.map((k) => updates[k]);
    updateValues.push(user.id);
    updateValues.push(id);

    const updateQuery = `UPDATE blotter_records SET ${setClauses.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...updateValues);

    const updatedRecord = db.prepare('SELECT * FROM blotter_records WHERE id = ?').get(id) as BlotterRecord;

    logAuditEvent({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'UPDATE',
      entityType: 'blotter',
      entityId: id,
      summaryText: `Updated blotter case ${updatedRecord.case_number} (${updatedRecord.status})`,
      oldData: existing as unknown as Record<string, any>,
      newData: updatedRecord as unknown as Record<string, any>,
      clientIp: clientIp || '127.0.0.1'
    });

    return updatedRecord;
  });

  return updateTx();
}

/**
 * Soft-deletes / archives a blotter record and records an ARCHIVE audit event.
 */
export function archiveBlotter(
  id: number,
  user: { id: number; username: string; role: string },
  clientIp?: string
): BlotterRecord {
  const existing = getBlotterById(id);
  if (!existing) {
    throw new Error('Blotter record not found');
  }

  const archiveTx = db.transaction(() => {
    db.prepare(`
      UPDATE blotter_records
      SET is_archived = 1,
          updated_by = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(user.id, id);

    logAuditEvent({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      action: 'ARCHIVE',
      entityType: 'blotter',
      entityId: id,
      summaryText: `Archived blotter case ${existing.case_number}`,
      oldData: { is_archived: existing.is_archived },
      newData: { is_archived: 1 },
      clientIp: clientIp || '127.0.0.1'
    });

    return getBlotterById(id)!;
  });

  return archiveTx();
}
