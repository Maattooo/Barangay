export type AuditAction =
  | 'LOGIN'
  | 'CREATE'
  | 'UPDATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'PRINT_CERTIFICATE'
  | 'BLOTTER_OVERRIDE'
  | 'IMPORT_EXCEL'
  | 'EXPORT_EXCEL'
  | 'SYSTEM_BACKUP';

export type AuditEntityType =
  | 'resident'
  | 'blotter'
  | 'official'
  | 'template'
  | 'issuance'
  | 'user';

export interface AuditLogEntry {
  id: number;
  user_id: number;
  username_snapshot: string;
  user_role_snapshot: string;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: number | null;
  summary_text: string;
  old_data_json: string | null;
  new_data_json: string | null;
  client_ip: string;
  created_at: string;
}

export interface LogAuditParams {
  userId: number;
  username: string;
  userRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: number | null;
  summaryText: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  clientIp?: string;
}

export interface JsonDiffResult {
  oldDiff: Record<string, any> | null;
  newDiff: Record<string, any> | null;
  changedKeys: string[];
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  pagination: AuditLogPagination;
}

export interface AuditQueryParams {
  page?: string;
  limit?: string;
  user_id?: string;
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}
