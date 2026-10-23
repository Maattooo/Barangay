import { UserRole } from './auth';
import { OfficialPosition, BarangayOfficial, CertificateTemplate } from './certificates';
import { SystemSettings } from './system';

export type BlotterStatus =
  | 'Active'
  | 'Under Mediation'
  | 'Settled'
  | 'Dismissed'
  | 'CFA Issued';

export const BLOTTER_STATUSES: BlotterStatus[] = [
  'Active',
  'Under Mediation',
  'Settled',
  'Dismissed',
  'CFA Issued'
];

export const BLOCKING_BLOTTER_STATUSES: BlotterStatus[] = [
  'Active',
  'Under Mediation',
  'CFA Issued'
];

export const CLEARING_BLOTTER_STATUSES: BlotterStatus[] = [
  'Settled',
  'Dismissed'
];

export interface BlotterRecord {
  id: number;
  case_number: string;
  complainant_id: number | null;
  complainant_name: string;
  respondent_id: number | null;
  respondent_name: string;
  incident_type: string;
  incident_location: string;
  incident_details: string;
  date_incident: string | null;
  date_recorded: string;
  status: BlotterStatus;
  settlement_notes: string;
  is_archived: number;
  created_by: number | null;
  updated_by: number | null;
  updated_at: string;
}

export interface CreateBlotterInput {
  complainant_name: string;
  respondent_name: string;
  incident_type: string;
  incident_details: string;
  complainant_id?: number | null;
  respondent_id?: number | null;
  incident_location?: string;
  date_incident?: string | null;
  status?: BlotterStatus;
}

export interface UpdateBlotterInput {
  status?: BlotterStatus;
  settlement_notes?: string;
  incident_details?: string;
  incident_location?: string;
  incident_type?: string;
  date_incident?: string | null;
  respondent_name?: string;
  complainant_name?: string;
  respondent_id?: number | null;
  complainant_id?: number | null;
}

export interface BlotterQueryFilter {
  status?: string;
  search?: string;
  respondent_id?: number;
  is_archived?: string;
  page?: number;
  limit?: number;
}

export interface BlotterListResponse {
  data: BlotterRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Barangay Officials
export type { OfficialPosition, BarangayOfficial };

export interface CreateOfficialInput {
  full_name: string;
  position: OfficialPosition;
  committee?: string | null;
  rank_order: number;
  term_start?: string | null;
  term_end?: string | null;
  is_active?: number | boolean;
}

export interface UpdateOfficialInput {
  full_name?: string;
  position?: OfficialPosition;
  committee?: string | null;
  rank_order?: number;
  term_start?: string | null;
  term_end?: string | null;
  is_active?: number | boolean;
}

// Certificate Templates
export type { CertificateTemplate };

export interface UpdateTemplateInput {
  template_name?: string;
  template_category?: 'certificate' | 'blotter';
  title_header?: string;
  paper_size?: 'short' | 'a4' | 'long';
  header_html?: string;
  header_config_json?: string;
  body_html?: string;
  footer_html?: string;
  show_officials_sidebar?: number;
  default_fee?: number;
  is_active?: number;
}

// Audit Logs
export type AuditAction =
  | 'LOGIN'
  | 'CREATE'
  | 'UPDATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'PRINT_CERTIFICATE'
  | 'PRINT_BLOTTER'
  | 'EXPORT_BLOTTER_DOCX'
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

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User Accounts & System Settings
export type { SystemSettings };

export interface UserAccount {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  official_id: number | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name: string;
  role: UserRole;
  official_id?: number | null;
}

export interface UpdateUserInput {
  full_name?: string;
  role?: UserRole;
  official_id?: number | null;
  is_active?: number | boolean;
  password?: string;
}
