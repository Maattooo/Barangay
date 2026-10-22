import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { logAuditEvent, computeJsonDiff } from '../services/audit.service';
import { OfficialPosition, BarangayOfficial } from '../types/officials';

const router = Router();

export const ALLOWED_POSITIONS: OfficialPosition[] = [
  'Punong Barangay',
  'Sangguniang Barangay Member',
  'SK Chairperson',
  'Barangay Secretary',
  'Barangay Treasurer'
];

// All officials endpoints require authentication
router.use(authenticate);

/**
 * Validates and normalizes is_active input.
 * Accepts boolean (true/false) or integer (1/0).
 * Rejects strings (e.g., "false", "true", "invalid") or other types with an error.
 */
function parseStrictIsActive(val: any): { valid: true; value: number } | { valid: false } {
  if (typeof val === 'boolean') {
    return { valid: true, value: val ? 1 : 0 };
  }
  if (val === 0 || val === 1) {
    return { valid: true, value: val };
  }
  return { valid: false };
}

/**
 * GET /api/officials
 * Lists all active officials (or all officials if include_inactive=true) ordered strictly by rank_order ASC.
 */
router.get('/', (req: Request, res: Response): void => {
  const includeInactive = req.query.include_inactive === 'true';

  const query = includeInactive
    ? `SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
       FROM barangay_officials
       ORDER BY rank_order ASC`
    : `SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
       FROM barangay_officials
       WHERE is_active = 1
       ORDER BY rank_order ASC`;

  const officials = db.prepare(query).all() as BarangayOfficial[];
  res.status(200).json(officials);
});

/**
 * POST /api/officials
 * Adds a new barangay official inside an atomic transaction. Restricted strictly to Admin.
 */
router.post('/', requireRole('Admin'), (req: Request, res: Response): void => {
  const {
    full_name,
    position,
    committee,
    rank_order,
    term_start,
    term_end,
    is_active
  } = req.body || {};

  // Validate required fields
  if (
    typeof full_name !== 'string' ||
    full_name.trim().length === 0 ||
    typeof position !== 'string' ||
    !ALLOWED_POSITIONS.includes(position as OfficialPosition) ||
    rank_order === undefined ||
    isNaN(Number(rank_order)) ||
    !Number.isInteger(Number(rank_order)) ||
    Number(rank_order) <= 0
  ) {
    res.status(400).json({
      error: 'Missing or invalid required fields (full_name, position, positive integer rank_order)'
    });
    return;
  }

  // Strict validation for is_active
  let activeFlag = 1;
  if (is_active !== undefined) {
    const parsed = parseStrictIsActive(is_active);
    if (!parsed.valid) {
      res.status(400).json({ error: 'is_active must be 0, 1, true, or false' });
      return;
    }
    activeFlag = parsed.value;
  }

  const rankNum = Number(rank_order);
  const committeeVal = committee !== undefined && committee !== null ? String(committee).trim() : null;
  const termStartVal = term_start !== undefined && term_start !== null ? String(term_start).trim() : null;
  const termEndVal = term_end !== undefined && term_end !== null ? String(term_end).trim() : null;

  try {
    let newOfficial: BarangayOfficial;

    const createOfficialTx = db.transaction(() => {
      const insertStmt = db.prepare(`
        INSERT INTO barangay_officials (
          full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by
        ) VALUES (
          @full_name, @position, @committee, @rank_order, @term_start, @term_end, @is_active, @updated_by
        )
      `);

      const result = insertStmt.run({
        full_name: full_name.trim(),
        position,
        committee: committeeVal,
        rank_order: rankNum,
        term_start: termStartVal,
        term_end: termEndVal,
        is_active: activeFlag,
        updated_by: req.user!.id
      });

      const newOfficialId = Number(result.lastInsertRowid);
      newOfficial = db.prepare(`
        SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
        FROM barangay_officials
        WHERE id = ?
      `).get(newOfficialId) as BarangayOfficial;

      // Log CREATE audit event synchronously inside transaction
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'official',
        entityId: newOfficialId,
        summaryText: `Created official: ${newOfficial.full_name} (${newOfficial.position})`,
        newData: newOfficial,
        clientIp: req.clientIp
      });
    });

    createOfficialTx();
    res.status(201).json(newOfficial!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create official', details: (error as Error).message });
  }
});

/**
 * PUT /api/officials/:id
 * Modifies an existing official's details inside an atomic transaction with no-op suppression.
 * Restricted strictly to Admin.
 */
router.put('/:id', requireRole('Admin'), (req: Request, res: Response): void => {
  const officialId = Number(req.params.id);
  if (isNaN(officialId) || !Number.isInteger(officialId) || officialId <= 0) {
    res.status(400).json({ error: 'Invalid official ID specified' });
    return;
  }

  const existing = db.prepare(`
    SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
    FROM barangay_officials
    WHERE id = ?
  `).get(officialId) as BarangayOfficial | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Official not found' });
    return;
  }

  const {
    full_name,
    position,
    committee,
    rank_order,
    term_start,
    term_end,
    is_active
  } = req.body || {};

  if (full_name !== undefined && (typeof full_name !== 'string' || full_name.trim().length === 0)) {
    res.status(400).json({ error: 'full_name must be a non-empty string' });
    return;
  }

  if (position !== undefined && !ALLOWED_POSITIONS.includes(position as OfficialPosition)) {
    res.status(400).json({ error: `position must be one of: ${ALLOWED_POSITIONS.join(', ')}` });
    return;
  }

  if (rank_order !== undefined) {
    const ro = Number(rank_order);
    if (isNaN(ro) || !Number.isInteger(ro) || ro <= 0) {
      res.status(400).json({ error: 'rank_order must be a positive integer' });
      return;
    }
  }

  let updatedIsActive = existing.is_active;
  if (is_active !== undefined) {
    const parsed = parseStrictIsActive(is_active);
    if (!parsed.valid) {
      res.status(400).json({ error: 'is_active must be 0, 1, true, or false' });
      return;
    }
    updatedIsActive = parsed.value;
  }

  const updatedFullName = full_name !== undefined ? full_name.trim() : existing.full_name;
  const updatedPosition = position !== undefined ? position : existing.position;
  const updatedCommittee = committee !== undefined
    ? (committee === null || committee === '' ? null : String(committee).trim())
    : existing.committee;
  const updatedRankOrder = rank_order !== undefined ? Number(rank_order) : existing.rank_order;
  const updatedTermStart = term_start !== undefined
    ? (term_start === null || term_start === '' ? null : String(term_start).trim())
    : existing.term_start;
  const updatedTermEnd = term_end !== undefined
    ? (term_end === null || term_end === '' ? null : String(term_end).trim())
    : existing.term_end;

  const candidateUpdated: BarangayOfficial = {
    ...existing,
    full_name: updatedFullName,
    position: updatedPosition,
    committee: updatedCommittee,
    rank_order: updatedRankOrder,
    term_start: updatedTermStart,
    term_end: updatedTermEnd,
    is_active: updatedIsActive
  };

  // Suppress no-op updates: if no fields changed, return existing immediately without writing DB or audit log
  const diff = computeJsonDiff(existing, candidateUpdated);
  if (diff.changedKeys.length === 0) {
    res.status(200).json(existing);
    return;
  }

  try {
    let updatedOfficial: BarangayOfficial;

    const updateOfficialTx = db.transaction(() => {
      db.prepare(`
        UPDATE barangay_officials
        SET full_name = @full_name,
            position = @position,
            committee = @committee,
            rank_order = @rank_order,
            term_start = @term_start,
            term_end = @term_end,
            is_active = @is_active,
            updated_by = @updated_by,
            updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `).run({
        id: officialId,
        full_name: candidateUpdated.full_name,
        position: candidateUpdated.position,
        committee: candidateUpdated.committee,
        rank_order: candidateUpdated.rank_order,
        term_start: candidateUpdated.term_start,
        term_end: candidateUpdated.term_end,
        is_active: candidateUpdated.is_active,
        updated_by: req.user!.id
      });

      updatedOfficial = db.prepare(`
        SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
        FROM barangay_officials
        WHERE id = ?
      `).get(officialId) as BarangayOfficial;

      // Log UPDATE audit event synchronously inside transaction
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'official',
        entityId: officialId,
        summaryText: `Updated official: ${updatedOfficial.full_name}`,
        oldData: existing,
        newData: updatedOfficial,
        clientIp: req.clientIp
      });
    });

    updateOfficialTx();
    res.status(200).json(updatedOfficial!);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update official', details: (error as Error).message });
  }
});

export default router;
