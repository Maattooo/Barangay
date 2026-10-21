import { db } from '../db/connection';
import {
  AuditAction,
  AuditEntityType,
  LogAuditParams,
  JsonDiffResult
} from '../types/audit';

export const ALLOWED_ACTIONS: Set<AuditAction> = new Set([
  'LOGIN',
  'CREATE',
  'UPDATE',
  'ARCHIVE',
  'RESTORE',
  'PRINT_CERTIFICATE',
  'BLOTTER_OVERRIDE',
  'IMPORT_EXCEL',
  'EXPORT_EXCEL',
  'SYSTEM_BACKUP'
]);

export const ALLOWED_ENTITY_TYPES: Set<AuditEntityType> = new Set([
  'resident',
  'blotter',
  'official',
  'template',
  'issuance',
  'user'
]);

export const DEFAULT_IGNORED_KEYS = ['password_hash', 'password', 'updated_at', 'created_at'];

/**
 * Deterministically serializes values with recursively sorted object keys
 * so that key insertion order does not generate false differences.
 */
export function canonicalJsonStringify(val: any): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalJsonStringify).join(',')}]`;
  }
  const sortedKeys = Object.keys(val).sort();
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(val[k])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * Sanitizes an object by removing sensitive or internal keys.
 */
export function sanitizeObject(
  obj?: Record<string, any> | null,
  ignoredKeys: string[] = DEFAULT_IGNORED_KEYS
): Record<string, any> | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const ignoredSet = new Set(ignoredKeys);
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!ignoredSet.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Compares two objects and computes a fine-grained before-and-after diff.
 * Returns only the keys whose values actually changed, excluding sensitive keys.
 * If no values changed, returns null for both oldDiff and newDiff with an empty changedKeys array.
 *
 * Normalizes undefined (omitted) and null so that omitting an attribute that is already null
 * does not generate a phantom diff.
 * Uses canonical recursive key sorting for nested objects so that key order is invariant.
 */
export function computeJsonDiff(
  oldObj?: Record<string, any> | null,
  newObj?: Record<string, any> | null,
  ignoredKeys: string[] = DEFAULT_IGNORED_KEYS
): JsonDiffResult {
  const o = oldObj || {};
  const n = newObj || {};

  const ignoredSet = new Set(ignoredKeys);
  const allKeys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)])).filter(
    (key) => !ignoredSet.has(key)
  );

  const oldDiff: Record<string, any> = {};
  const newDiff: Record<string, any> = {};
  const changedKeys: string[] = [];

  for (const key of allKeys) {
    const rawOldVal = o[key];
    const rawNewVal = n[key];

    // Normalize undefined to null for accurate delta detection
    const normOld = rawOldVal === undefined ? null : rawOldVal;
    const normNew = rawNewVal === undefined ? null : rawNewVal;

    const areEqual = (v1: any, v2: any): boolean => {
      if (v1 === v2) return true;
      if (typeof v1 === 'number' && typeof v2 === 'number' && isNaN(v1) && isNaN(v2)) {
        return true;
      }
      if (typeof v1 === 'object' && v1 !== null && typeof v2 === 'object' && v2 !== null) {
        return canonicalJsonStringify(v1) === canonicalJsonStringify(v2);
      }
      return false;
    };

    if (!areEqual(normOld, normNew)) {
      changedKeys.push(key);
      oldDiff[key] = normOld;
      newDiff[key] = normNew;
    }
  }

  if (changedKeys.length === 0) {
    return {
      oldDiff: null,
      newDiff: null,
      changedKeys: []
    };
  }

  return {
    oldDiff,
    newDiff,
    changedKeys
  };
}

/**
 * Centralized audit logging service.
 * Validates action and entity type against permitted enums,
 * automatically computes JSON diffs for UPDATE actions,
 * sanitizes initial attributes for CREATE actions,
 * writes to immutable audit_logs table, and returns the newly inserted ID.
 */
export function logAuditEvent(params: LogAuditParams): number {
  if (params.userId === undefined || params.userId === null || typeof params.userId !== 'number' || isNaN(params.userId)) {
    throw new Error('Audit log requires a valid numeric userId');
  }

  if (!params.username || typeof params.username !== 'string' || params.username.trim().length === 0) {
    throw new Error('Audit log requires a valid username snapshot');
  }

  if (!params.userRole || typeof params.userRole !== 'string' || params.userRole.trim().length === 0) {
    throw new Error('Audit log requires a valid userRole snapshot');
  }

  if (!params.summaryText || typeof params.summaryText !== 'string' || params.summaryText.trim().length === 0) {
    throw new Error('Audit log requires a valid summaryText');
  }

  if (!ALLOWED_ACTIONS.has(params.action)) {
    throw new Error(`Invalid audit action: "${params.action}". Must be one of: ${Array.from(ALLOWED_ACTIONS).join(', ')}`);
  }

  if (!ALLOWED_ENTITY_TYPES.has(params.entityType)) {
    throw new Error(`Invalid audit entity_type: "${params.entityType}". Must be one of: ${Array.from(ALLOWED_ENTITY_TYPES).join(', ')}`);
  }

  let oldDataJson: string | null = null;
  let newDataJson: string | null = null;

  if (params.action === 'UPDATE') {
    if (params.oldData || params.newData) {
      const diff = computeJsonDiff(params.oldData, params.newData);
      oldDataJson = diff.oldDiff ? JSON.stringify(diff.oldDiff) : null;
      newDataJson = diff.newDiff ? JSON.stringify(diff.newDiff) : null;
    }
  } else if (params.action === 'CREATE') {
    oldDataJson = null;
    if (params.newData) {
      const sanitized = sanitizeObject(params.newData);
      newDataJson = sanitized ? JSON.stringify(sanitized) : null;
    }
  } else {
    // For other actions (e.g. ARCHIVE, RESTORE, LOGIN, etc.)
    if (params.oldData && params.newData) {
      const diff = computeJsonDiff(params.oldData, params.newData);
      oldDataJson = diff.oldDiff ? JSON.stringify(diff.oldDiff) : null;
      newDataJson = diff.newDiff ? JSON.stringify(diff.newDiff) : null;
    } else {
      if (params.oldData) {
        const sanitizedOld = sanitizeObject(params.oldData);
        oldDataJson = sanitizedOld ? JSON.stringify(sanitizedOld) : null;
      }
      if (params.newData) {
        const sanitizedNew = sanitizeObject(params.newData);
        newDataJson = sanitizedNew ? JSON.stringify(sanitizedNew) : null;
      }
    }
  }

  const clientIp = params.clientIp || '127.0.0.1';

  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      user_id,
      username_snapshot,
      user_role_snapshot,
      action,
      entity_type,
      entity_id,
      summary_text,
      old_data_json,
      new_data_json,
      client_ip
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    params.userId,
    params.username,
    params.userRole,
    params.action,
    params.entityType,
    params.entityId ?? null,
    params.summaryText,
    oldDataJson,
    newDataJson,
    clientIp
  );

  return Number(result.lastInsertRowid);
}
