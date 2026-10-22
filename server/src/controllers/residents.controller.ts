import { Request, Response } from 'express';
import { db } from '../db/connection';
import {
  Resident,
  Sex,
  CivilStatus,
  ResidencyStatus,
  ResidentStats
} from '../types/resident';
import {
  exportResidentsToExcel,
  importResidents,
  parseExcelBuffer,
  parseBooleanFlag,
  parseDateValue,
  isValidPastDate,
  normalizeSex,
  normalizeCivilStatus,
  normalizeResidencyStatus
} from '../services/excel.service';
import { logAuditEvent, computeJsonDiff } from '../services/audit.service';

export const SQL_DYNAMIC_AGE = `CAST((julianday('now', 'localtime') - julianday(birthdate)) / 365.2425 AS INTEGER)`;

/**
 * Enriches a raw database resident row with dynamic boolean sector derivations.
 */
export function enrichResident(row: any): Resident {
  const age = typeof row.age === 'number' ? row.age : Number(row.age) || 0;
  return {
    ...row,
    age,
    is_senior: age >= 60,
    is_youth: age >= 15 && age <= 30,
    is_minor: age < 18
  };
}

/**
 * Builds dynamic WHERE clause and parameters for resident filtering.
 */
export function buildResidentFilter(query: any): { whereSql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  // Soft-delete filter: default is_archived = 0 unless include_archived is true
  const includeArchived = query.include_archived === 'true' || query.include_archived === true || query.include_archived === '1';
  if (!includeArchived) {
    conditions.push('r.is_archived = 0');
  }

  // Text search on names
  if (query.search && typeof query.search === 'string' && query.search.trim().length > 0) {
    const term = `%${query.search.trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(r.first_name) LIKE ? OR
      LOWER(r.last_name) LIKE ? OR
      LOWER(r.middle_name) LIKE ? OR
      LOWER(r.first_name || ' ' || r.last_name) LIKE ? OR
      LOWER(r.last_name || ' ' || r.first_name) LIKE ?
    )`);
    params.push(term, term, term, term, term);
  }

  // Purok filter
  if (query.purok && typeof query.purok === 'string' && query.purok.trim().length > 0) {
    conditions.push('LOWER(TRIM(r.purok)) = LOWER(TRIM(?))');
    params.push(query.purok.trim());
  }

  // Sex filter
  if (query.sex && typeof query.sex === 'string' && query.sex.trim().length > 0) {
    const normalizedSex = normalizeSex(query.sex);
    if (normalizedSex) {
      conditions.push('r.sex = ?');
      params.push(normalizedSex);
    }
  }

  // Civil Status filter
  if (query.civil_status && typeof query.civil_status === 'string' && query.civil_status.trim().length > 0) {
    const normalizedCs = normalizeCivilStatus(query.civil_status);
    if (normalizedCs) {
      conditions.push('r.civil_status = ?');
      params.push(normalizedCs);
    }
  }

  // Combinatorial Sectors Filter (Strict AND logic)
  if (query.sectors && typeof query.sectors === 'string' && query.sectors.trim().length > 0) {
    const sectorTokens = query.sectors
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 0);

    for (const sec of sectorTokens) {
      switch (sec) {
        case 'senior':
          conditions.push(`${SQL_DYNAMIC_AGE} >= 60`);
          break;
        case 'pwd':
          conditions.push('r.is_pwd = 1');
          break;
        case 'indigent':
          conditions.push('r.is_indigent = 1');
          break;
        case '4ps':
          conditions.push('r.is_4ps = 1');
          break;
        case 'solo_parent':
        case 'soloparent':
          conditions.push('r.is_solo_parent = 1');
          break;
        case 'voter':
          conditions.push('r.is_voter = 1');
          break;
        case 'youth':
        case 'sk':
          conditions.push(`(${SQL_DYNAMIC_AGE} >= 15 AND ${SQL_DYNAMIC_AGE} <= 30)`);
          break;
        case 'ofw':
          conditions.push('r.is_ofw = 1');
          break;
        case 'osy':
          conditions.push('r.is_osy = 1');
          break;
        case 'minor':
          conditions.push(`${SQL_DYNAMIC_AGE} < 18`);
          break;
        default:
          // Unrecognized sector: should fail combinatorial match
          conditions.push('1 = 0');
          break;
      }
    }
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereSql, params };
}

/**
 * GET /api/residents
 * Query residents with text search, purok, sex, civil_status, combinatorial sector filter, and pagination.
 */
export async function getResidents(req: Request, res: Response): Promise<void> {
  try {
    const { whereSql, params } = buildResidentFilter(req.query);

    // Count query
    const countQuery = `SELECT COUNT(*) as total FROM residents r ${whereSql}`;
    const countResult = db.prepare(countQuery).get(...params) as { total: number };
    const total = countResult ? countResult.total : 0;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Data query
    const dataQuery = `
      SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
      FROM residents r
      ${whereSql}
      ORDER BY r.last_name ASC, r.first_name ASC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataQuery).all(...params, limit, offset);
    const data = rows.map(enrichResident);

    res.status(200).json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    });
  } catch (error: any) {
    console.error('Error fetching residents:', error);
    res.status(500).json({ error: 'Internal server error fetching residents' });
  }
}

/**
 * GET /api/residents/stats
 * Dashboard aggregated statistics for active (non-archived) residents and active blotter cases.
 */
export async function getResidentStats(_req: Request, res: Response): Promise<void> {
  try {
    // 1. Sector counts on non-archived residents
    const summaryQuery = `
      SELECT
        COUNT(*) AS total_residents,
        COUNT(CASE WHEN ${SQL_DYNAMIC_AGE} >= 60 THEN 1 END) AS seniors,
        COUNT(CASE WHEN is_pwd = 1 THEN 1 END) AS pwds,
        COUNT(CASE WHEN is_4ps = 1 THEN 1 END) AS four_ps,
        COUNT(CASE WHEN is_indigent = 1 THEN 1 END) AS indigents,
        COUNT(CASE WHEN is_voter = 1 THEN 1 END) AS voters,
        COUNT(CASE WHEN is_solo_parent = 1 THEN 1 END) AS solo_parents,
        COUNT(CASE WHEN is_ofw = 1 THEN 1 END) AS ofw,
        COUNT(CASE WHEN is_osy = 1 THEN 1 END) AS osy,
        COUNT(CASE WHEN ${SQL_DYNAMIC_AGE} >= 15 AND ${SQL_DYNAMIC_AGE} <= 30 THEN 1 END) AS youth,
        COUNT(CASE WHEN ${SQL_DYNAMIC_AGE} < 18 THEN 1 END) AS minors
      FROM residents
      WHERE is_archived = 0
    `;
    const summaryRow = db.prepare(summaryQuery).get() as any;

    // 2. Counts grouped by purok
    const purokQuery = `
      SELECT purok, COUNT(*) AS count
      FROM residents
      WHERE is_archived = 0
      GROUP BY purok
      ORDER BY purok ASC
    `;
    const purokRows = db.prepare(purokQuery).all() as Array<{ purok: string; count: number }>;
    const purok_counts: Record<string, number> = {};
    for (const r of purokRows) {
      if (r.purok) {
        purok_counts[r.purok] = r.count;
      }
    }

    // 3. Active blotters count
    const blotterQuery = `
      SELECT COUNT(*) AS count
      FROM blotter_records
      WHERE status IN ('Active', 'Under Mediation', 'CFA Issued')
        AND is_archived = 0
    `;
    const blotterRow = db.prepare(blotterQuery).get() as { count: number };

    const stats: ResidentStats = {
      total_residents: summaryRow ? Number(summaryRow.total_residents) : 0,
      purok_counts,
      seniors: summaryRow ? Number(summaryRow.seniors) : 0,
      pwds: summaryRow ? Number(summaryRow.pwds) : 0,
      four_ps: summaryRow ? Number(summaryRow.four_ps) : 0,
      indigents: summaryRow ? Number(summaryRow.indigents) : 0,
      voters: summaryRow ? Number(summaryRow.voters) : 0,
      solo_parents: summaryRow ? Number(summaryRow.solo_parents) : 0,
      ofw: summaryRow ? Number(summaryRow.ofw) : 0,
      osy: summaryRow ? Number(summaryRow.osy) : 0,
      youth: summaryRow ? Number(summaryRow.youth) : 0,
      minors: summaryRow ? Number(summaryRow.minors) : 0,
      active_blotters: blotterRow ? Number(blotterRow.count) : 0
    };

    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error computing resident stats:', error);
    res.status(500).json({ error: 'Internal server error calculating resident statistics' });
  }
}

/**
 * POST /api/residents
 * Create a new resident profile and generate a CREATE audit log.
 */
export async function createResident(req: Request, res: Response): Promise<void> {
  try {
    const {
      first_name,
      middle_name = '',
      last_name,
      suffix = '',
      birthdate,
      sex,
      civil_status,
      purok,
      house_no_street = '',
      contact_no = '',
      occupation = '',
      nationality = 'Filipino',
      residency_status = 'Active',
      is_voter = 0,
      precinct_no = '',
      is_pwd = 0,
      pwd_id_no = '',
      pwd_disability_type = '',
      is_solo_parent = 0,
      solo_parent_id_no = '',
      is_4ps = 0,
      is_indigent = 0,
      is_ofw = 0,
      is_osy = 0,
      senior_id_no = ''
    } = req.body;

    // Validate required fields
    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: first_name' });
      return;
    }
    if (!last_name || typeof last_name !== 'string' || last_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: last_name' });
      return;
    }
    if (!birthdate || typeof birthdate !== 'string' || birthdate.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: birthdate' });
      return;
    }
    if (!purok || typeof purok !== 'string' || purok.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: purok' });
      return;
    }

    // Validate birthdate format and range
    const parsedBirthdate = parseDateValue(birthdate);
    if (!parsedBirthdate || !isValidPastDate(parsedBirthdate)) {
      res.status(400).json({ error: 'Invalid birthdate. Must be a valid calendar date in YYYY-MM-DD format and cannot be in the future' });
      return;
    }

    // Validate sex
    const validatedSex = normalizeSex(sex);
    if (!validatedSex) {
      res.status(400).json({ error: 'Invalid sex. Must be Male or Female' });
      return;
    }

    // Validate civil status
    const validatedCs = normalizeCivilStatus(civil_status);
    if (!validatedCs) {
      res.status(400).json({ error: 'Invalid civil_status. Must be Single, Married, Widowed, Separated, or Live-in' });
      return;
    }

    // Validate residency status
    const validatedResidency = normalizeResidencyStatus(residency_status);

    const userId = req.user!.id;
    const vIsVoter = parseBooleanFlag(is_voter);
    const vIsPwd = parseBooleanFlag(is_pwd);
    const vIsSoloParent = parseBooleanFlag(is_solo_parent);
    const vIs4ps = parseBooleanFlag(is_4ps);
    const vIsIndigent = parseBooleanFlag(is_indigent);
    const vIsOfw = parseBooleanFlag(is_ofw);
    const vIsOsy = parseBooleanFlag(is_osy);

    const insertStmt = db.prepare(`
      INSERT INTO residents (
        first_name, middle_name, last_name, suffix, birthdate, sex, civil_status,
        purok, house_no_street, contact_no, occupation, nationality, residency_status,
        is_voter, precinct_no, is_pwd, pwd_id_no, pwd_disability_type,
        is_solo_parent, solo_parent_id_no, is_4ps, is_indigent, is_ofw, is_osy, senior_id_no,
        is_archived, created_by, updated_by
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        0, ?, ?
      )
    `);

    // Atomic transaction enclosing resident creation and audit logging
    const createTx = db.transaction(() => {
      const result = insertStmt.run(
        first_name.trim(),
        (middle_name || '').trim(),
        last_name.trim(),
        (suffix || '').trim(),
        parsedBirthdate,
        validatedSex,
        validatedCs,
        purok.trim(),
        (house_no_street || '').trim(),
        (contact_no || '').trim(),
        (occupation || '').trim(),
        (nationality || 'Filipino').trim(),
        validatedResidency,
        vIsVoter,
        (precinct_no || '').trim(),
        vIsPwd,
        (pwd_id_no || '').trim(),
        (pwd_disability_type || '').trim(),
        vIsSoloParent,
        (solo_parent_id_no || '').trim(),
        vIs4ps,
        vIsIndigent,
        vIsOfw,
        vIsOsy,
        (senior_id_no || '').trim(),
        userId,
        userId
      );

      const newId = Number(result.lastInsertRowid);

      const newResidentRaw = db.prepare(`
        SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
        FROM residents r
        WHERE r.id = ?
      `).get(newId) as Record<string, any>;

      const enriched = enrichResident(newResidentRaw);

      // Audit log within insertion transaction
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'resident',
        entityId: newId,
        summaryText: `Created resident ${enriched.first_name} ${enriched.last_name}`,
        newData: enriched,
        clientIp: req.clientIp
      });

      return enriched;
    });

    const enriched = createTx();
    res.status(201).json(enriched);
  } catch (error: any) {
    console.error('Error creating resident:', error);
    res.status(500).json({ error: 'Internal server error creating resident' });
  }
}

/**
 * PUT /api/residents/:id
 * Update an existing resident profile and generate an UPDATE audit log with diff.
 */
export async function updateResident(req: Request, res: Response): Promise<void> {
  try {
    const residentId = parseInt(req.params.id, 10);
    if (isNaN(residentId)) {
      res.status(400).json({ error: 'Invalid resident ID' });
      return;
    }

    const existingRaw = db.prepare(`
      SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
      FROM residents r
      WHERE r.id = ?
    `).get(residentId) as Record<string, any> | undefined;

    if (!existingRaw) {
      res.status(404).json({ error: 'Resident not found' });
      return;
    }

    const payload = req.body;
    const updates: Record<string, any> = {};

    // Validate fields if provided
    if (payload.first_name !== undefined) {
      if (typeof payload.first_name !== 'string' || payload.first_name.trim().length === 0) {
        res.status(400).json({ error: 'first_name cannot be empty' });
        return;
      }
      updates.first_name = payload.first_name.trim();
    }

    if (payload.middle_name !== undefined) {
      updates.middle_name = String(payload.middle_name).trim();
    }

    if (payload.last_name !== undefined) {
      if (typeof payload.last_name !== 'string' || payload.last_name.trim().length === 0) {
        res.status(400).json({ error: 'last_name cannot be empty' });
        return;
      }
      updates.last_name = payload.last_name.trim();
    }

    if (payload.suffix !== undefined) {
      updates.suffix = String(payload.suffix).trim();
    }

    if (payload.birthdate !== undefined) {
      const parsedBirthdate = parseDateValue(payload.birthdate);
      if (!parsedBirthdate || !isValidPastDate(parsedBirthdate)) {
        res.status(400).json({ error: 'Invalid birthdate. Must be a valid calendar date in YYYY-MM-DD format and cannot be in the future' });
        return;
      }
      updates.birthdate = parsedBirthdate;
    }

    if (payload.sex !== undefined) {
      const validatedSex = normalizeSex(payload.sex);
      if (!validatedSex) {
        res.status(400).json({ error: 'Invalid sex. Must be Male or Female' });
        return;
      }
      updates.sex = validatedSex;
    }

    if (payload.civil_status !== undefined) {
      const validatedCs = normalizeCivilStatus(payload.civil_status);
      if (!validatedCs) {
        res.status(400).json({ error: 'Invalid civil_status. Must be Single, Married, Widowed, Separated, or Live-in' });
        return;
      }
      updates.civil_status = validatedCs;
    }

    if (payload.purok !== undefined) {
      if (typeof payload.purok !== 'string' || payload.purok.trim().length === 0) {
        res.status(400).json({ error: 'purok cannot be empty' });
        return;
      }
      updates.purok = payload.purok.trim();
    }

    if (payload.house_no_street !== undefined) updates.house_no_street = String(payload.house_no_street).trim();
    if (payload.contact_no !== undefined) updates.contact_no = String(payload.contact_no).trim();
    if (payload.occupation !== undefined) updates.occupation = String(payload.occupation).trim();
    if (payload.nationality !== undefined) updates.nationality = String(payload.nationality).trim();

    if (payload.residency_status !== undefined) {
      updates.residency_status = normalizeResidencyStatus(payload.residency_status);
    }

    if (payload.is_voter !== undefined) updates.is_voter = parseBooleanFlag(payload.is_voter);
    if (payload.precinct_no !== undefined) updates.precinct_no = String(payload.precinct_no).trim();
    if (payload.is_pwd !== undefined) updates.is_pwd = parseBooleanFlag(payload.is_pwd);
    if (payload.pwd_id_no !== undefined) updates.pwd_id_no = String(payload.pwd_id_no).trim();
    if (payload.pwd_disability_type !== undefined) updates.pwd_disability_type = String(payload.pwd_disability_type).trim();
    if (payload.is_solo_parent !== undefined) updates.is_solo_parent = parseBooleanFlag(payload.is_solo_parent);
    if (payload.solo_parent_id_no !== undefined) updates.solo_parent_id_no = String(payload.solo_parent_id_no).trim();
    if (payload.is_4ps !== undefined) updates.is_4ps = parseBooleanFlag(payload.is_4ps);
    if (payload.is_indigent !== undefined) updates.is_indigent = parseBooleanFlag(payload.is_indigent);
    if (payload.is_ofw !== undefined) updates.is_ofw = parseBooleanFlag(payload.is_ofw);
    if (payload.is_osy !== undefined) updates.is_osy = parseBooleanFlag(payload.is_osy);
    if (payload.senior_id_no !== undefined) updates.senior_id_no = String(payload.senior_id_no).trim();

    // Suppress no-op updates: if no fields change, return 200 without creating an audit log
    const diff = computeJsonDiff(existingRaw, { ...existingRaw, ...updates });
    if (diff.changedKeys.length === 0) {
      res.status(200).json(enrichResident(existingRaw));
      return;
    }

    // Atomic transaction enclosing resident update and audit logging
    const updateTx = db.transaction(() => {
      const updateKeys = Object.keys(updates);
      if (updateKeys.length > 0) {
        const setClauses = updateKeys.map((k) => `${k} = ?`);
        setClauses.push('updated_by = ?');
        setClauses.push("updated_at = datetime('now', 'localtime')");

        const updateValues = updateKeys.map((k) => updates[k]);
        updateValues.push(req.user!.id);
        updateValues.push(residentId);

        const updateQuery = `UPDATE residents SET ${setClauses.join(', ')} WHERE id = ?`;
        db.prepare(updateQuery).run(...updateValues);
      }

      const updatedRaw = db.prepare(`
        SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
        FROM residents r
        WHERE r.id = ?
      `).get(residentId) as Record<string, any>;

      const enriched = enrichResident(updatedRaw);

      // Audit log with diff within transaction
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'resident',
        entityId: residentId,
        summaryText: `Updated resident ${enriched.first_name} ${enriched.last_name}`,
        oldData: existingRaw,
        newData: updatedRaw,
        clientIp: req.clientIp
      });

      return enriched;
    });

    const enriched = updateTx();
    res.status(200).json(enriched);
  } catch (error: any) {
    console.error('Error updating resident:', error);
    res.status(500).json({ error: 'Internal server error updating resident' });
  }
}

/**
 * PATCH /api/residents/:id/archive
 * Soft-delete resident (is_archived = 1) and record ARCHIVE audit log.
 */
export async function archiveResident(req: Request, res: Response): Promise<void> {
  try {
    const residentId = parseInt(req.params.id, 10);
    if (isNaN(residentId)) {
      res.status(400).json({ error: 'Invalid resident ID' });
      return;
    }

    const resident = db.prepare('SELECT * FROM residents WHERE id = ?').get(residentId) as any;
    if (!resident) {
      res.status(404).json({ error: 'Resident not found' });
      return;
    }

    // Atomic transaction enclosing archive update and audit logging
    const archiveTx = db.transaction(() => {
      db.prepare(`
        UPDATE residents
        SET is_archived = 1,
            updated_by = ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(req.user!.id, residentId);

      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'ARCHIVE',
        entityType: 'resident',
        entityId: residentId,
        summaryText: `Archived resident ${resident.first_name} ${resident.last_name}`,
        oldData: { is_archived: 0 },
        newData: { is_archived: 1 },
        clientIp: req.clientIp
      });
    });

    archiveTx();

    res.status(200).json({ message: 'Resident archived successfully' });
  } catch (error: any) {
    console.error('Error archiving resident:', error);
    res.status(500).json({ error: 'Internal server error archiving resident' });
  }
}

/**
 * POST /api/residents/import-excel
 * Bulk import residents from uploaded Excel file or JSON array.
 */
export async function importResidentsController(req: Request, res: Response): Promise<void> {
  try {
    let records: Array<Record<string, any>> = [];

    if (req.file && req.file.buffer) {
      records = parseExcelBuffer(req.file.buffer);
    } else if (Array.isArray(req.body)) {
      records = req.body;
    } else if (req.body && Array.isArray(req.body.residents)) {
      records = req.body.residents;
    } else {
      res.status(400).json({ error: 'No Excel file or resident array provided' });
      return;
    }

    const result = importResidents(records, req.user!.id);

    logAuditEvent({
      userId: req.user!.id,
      username: req.user!.username,
      userRole: req.user!.role,
      action: 'IMPORT_EXCEL',
      entityType: 'resident',
      summaryText: `Bulk imported residents from Excel: ${result.imported_count} imported, ${result.skipped_duplicates} skipped (duplicates), ${result.errors.length} errors out of ${result.total_processed} processed`,
      clientIp: req.clientIp
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error importing residents:', error);
    res.status(500).json({ error: 'Internal server error importing residents' });
  }
}

/**
 * GET /api/residents/export-excel
 * Export filtered residents masterlist matching query parameters as a styled .xlsx buffer.
 */
export async function exportResidentsController(req: Request, res: Response): Promise<void> {
  try {
    const { whereSql, params } = buildResidentFilter(req.query);

    const query = `
      SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
      FROM residents r
      ${whereSql}
      ORDER BY r.last_name ASC, r.first_name ASC
    `;

    const rows = db.prepare(query).all(...params);
    const residents = rows.map(enrichResident);

    const excelBuffer = exportResidentsToExcel(residents);

    // Human-readable summary of filters
    const filterParts: string[] = [];
    if (req.query.search) filterParts.push(`search="${req.query.search}"`);
    if (req.query.purok) filterParts.push(`purok="${req.query.purok}"`);
    if (req.query.sex) filterParts.push(`sex="${req.query.sex}"`);
    if (req.query.civil_status) filterParts.push(`civil_status="${req.query.civil_status}"`);
    if (req.query.sectors) filterParts.push(`sectors="${req.query.sectors}"`);
    const filterDesc = filterParts.length > 0 ? filterParts.join(', ') : 'all';

    logAuditEvent({
      userId: req.user!.id,
      username: req.user!.username,
      userRole: req.user!.role,
      action: 'EXPORT_EXCEL',
      entityType: 'resident',
      summaryText: `Exported residents masterlist with filters: ${filterDesc} (${residents.length} records)`,
      clientIp: req.clientIp
    });

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const filename = `barangay_residents_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.status(200).send(excelBuffer);
  } catch (error: any) {
    console.error('Error exporting residents:', error);
    res.status(500).json({ error: 'Internal server error exporting residents' });
  }
}
