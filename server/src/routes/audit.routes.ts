import { Router, Request, Response } from 'express';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  AuditLogEntry,
  AuditAction,
  AuditEntityType
} from '../types/audit';
import { ALLOWED_ACTIONS, ALLOWED_ENTITY_TYPES } from '../services/audit.service';

const router = Router();

/**
 * Validates date filter strings.
 */
function isValidDateFilter(dateStr: string): boolean {
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return (
      dateObj.getUTCFullYear() === y &&
      dateObj.getUTCMonth() === m - 1 &&
      dateObj.getUTCDate() === d
    );
  }
  const normalized = trimmed.replace('T', ' ').replace('Z', '').split('.')[0];
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    const [datePart, timePart] = normalized.split(' ');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm, ss] = timePart.split(':').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return false;
    const dateObj = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
    return (
      dateObj.getUTCFullYear() === y &&
      dateObj.getUTCMonth() === m - 1 &&
      dateObj.getUTCDate() === d
    );
  }
  return false;
}

/**
 * Normalizes date input for SQLite datetime queries.
 */
function formatSqliteDate(dateStr: string, isEnd = false): string {
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isEnd ? `${trimmed} 23:59:59` : `${trimmed} 00:00:00`;
  }
  const normalized = trimmed.replace('T', ' ').replace('Z', '').split('.')[0];
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  return trimmed;
}

/**
 * Strict Immutability Guard:
 * Blocks any mutating HTTP methods on /api/audit-logs with HTTP 405 Method Not Allowed.
 */
const methodNotAllowed = (_req: Request, res: Response): void => {
  res.status(405).json({ error: 'Method not allowed. Audit logs are immutable.' });
};

router.post('/', methodNotAllowed);
router.put('/', methodNotAllowed);
router.patch('/', methodNotAllowed);
router.delete('/', methodNotAllowed);
router.post('/:id', methodNotAllowed);
router.put('/:id', methodNotAllowed);
router.patch('/:id', methodNotAllowed);
router.delete('/:id', methodNotAllowed);

/**
 * GET /api/audit-logs
 * Protected by Admin RBAC guard.
 * Returns paginated, filtered audit logs ordered by id DESC.
 */
router.get('/', authenticate, requireRole('Admin'), (req: Request, res: Response): void => {
  let pageNum = parseInt(req.query.page as string, 10);
  if (isNaN(pageNum) || pageNum <= 0) {
    pageNum = 1;
  }

  let limitNum = parseInt(req.query.limit as string, 10);
  if (isNaN(limitNum) || limitNum <= 0) {
    limitNum = 20;
  }
  if (limitNum > 100) {
    limitNum = 100;
  }

  const conditions: string[] = [];
  const params: any[] = [];

  // user_id filter
  if (req.query.user_id !== undefined && req.query.user_id !== '') {
    const userIdNum = Number(req.query.user_id);
    if (isNaN(userIdNum) || !Number.isInteger(userIdNum) || userIdNum <= 0) {
      res.status(400).json({ error: 'Invalid user_id filter specified' });
      return;
    }
    conditions.push('user_id = ?');
    params.push(userIdNum);
  }

  // action filter
  if (req.query.action) {
    const actionStr = req.query.action as string;
    if (!ALLOWED_ACTIONS.has(actionStr as AuditAction)) {
      res.status(400).json({ error: 'Invalid action filter specified' });
      return;
    }
    conditions.push('action = ?');
    params.push(actionStr);
  }

  // entity_type filter
  if (req.query.entity_type) {
    const entityTypeStr = req.query.entity_type as string;
    if (!ALLOWED_ENTITY_TYPES.has(entityTypeStr as AuditEntityType)) {
      res.status(400).json({ error: 'Invalid entity_type filter specified' });
      return;
    }
    conditions.push('entity_type = ?');
    params.push(entityTypeStr);
  }

  // start_date filter (created_at >= start_date)
  if (req.query.start_date) {
    const startDateStr = req.query.start_date as string;
    if (!isValidDateFilter(startDateStr)) {
      res.status(400).json({ error: 'Invalid start_date filter specified' });
      return;
    }
    conditions.push('created_at >= ?');
    params.push(formatSqliteDate(startDateStr, false));
  }

  // end_date filter (created_at <= end_date + ' 23:59:59')
  if (req.query.end_date) {
    const endDateStr = req.query.end_date as string;
    if (!isValidDateFilter(endDateStr)) {
      res.status(400).json({ error: 'Invalid end_date filter specified' });
      return;
    }
    conditions.push('created_at <= ?');
    params.push(formatSqliteDate(endDateStr, true));
  }

  // search filter (summary_text or username_snapshot)
  if (req.query.search) {
    const searchPattern = `%${(req.query.search as string).trim()}%`;
    conditions.push('(summary_text LIKE ? OR username_snapshot LIKE ?)');
    params.push(searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Calculate total matching records
  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM audit_logs ${whereClause}
  `).get(...params) as { total: number };

  const total = countRow ? countRow.total : 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limitNum);

  // Retrieve paginated records
  const offset = (pageNum - 1) * limitNum;
  const queryParams = [...params, limitNum, offset];

  const data = db.prepare(`
    SELECT id, user_id, username_snapshot, user_role_snapshot, action, entity_type, entity_id,
           summary_text, old_data_json, new_data_json, client_ip, created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all(...queryParams) as AuditLogEntry[];

  res.status(200).json({
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  });
});

/**
 * GET /api/audit-logs/:id
 * Protected by Admin RBAC guard.
 * Returns a single audit log entry by ID or HTTP 404 if not found.
 */
router.get('/:id', authenticate, requireRole('Admin'), (req: Request, res: Response): void => {
  const logId = parseInt(req.params.id, 10);
  if (isNaN(logId) || logId <= 0) {
    res.status(400).json({ error: 'Invalid audit log ID' });
    return;
  }

  const log = db.prepare(`
    SELECT id, user_id, username_snapshot, user_role_snapshot, action, entity_type, entity_id,
           summary_text, old_data_json, new_data_json, client_ip, created_at
    FROM audit_logs
    WHERE id = ?
  `).get(logId) as AuditLogEntry | undefined;

  if (!log) {
    res.status(404).json({ error: 'Audit log entry not found' });
    return;
  }

  res.status(200).json(log);
});

export default router;
