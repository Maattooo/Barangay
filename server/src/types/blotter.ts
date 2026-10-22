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

export interface BlotterCaseSummary {
  id: number;
  case_number: string;
  complainant_name: string;
  respondent_id: number | null;
  respondent_name: string;
  incident_type: string;
  status: BlotterStatus;
  date_recorded: string;
}

export interface BlotterCheckResponse {
  cleared: boolean;
  cases: BlotterCaseSummary[];
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
