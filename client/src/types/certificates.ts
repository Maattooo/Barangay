export type OfficialPosition =
  | 'Punong Barangay'
  | 'Sangguniang Barangay Member'
  | 'SK Chairperson'
  | 'Barangay Secretary'
  | 'Barangay Treasurer';

export interface BarangayOfficial {
  id: number;
  full_name: string;
  position: OfficialPosition;
  committee: string | null;
  rank_order: number;
  term_start: string | null;
  term_end: string | null;
  is_active: number;
  updated_by?: number | null;
  updated_at?: string;
}

export interface CertificateTemplate {
  id: number;
  template_code: string;
  template_name: string;
  title_header: string;
  body_html: string;
  show_officials_sidebar: number;
  default_fee: number;
  requires_blotter_check: number;
  is_active: number;
  updated_by?: number | null;
  updated_at?: string;
}

export interface CertificateIssuance {
  id: number;
  control_number: string;
  resident_id: number;
  template_id: number;
  purpose: string;
  or_number: string;
  amount_paid: number;
  ctc_number: string;
  ctc_date_issued: string;
  ctc_place_issued: string;
  signatory_official_id: number;
  signatory_name_snapshot: string;
  signatory_position_snapshot: string;
  is_oic_signing: number;
  had_active_blotter: number;
  blotter_override_reason: string;
  issued_by_user_id: number;
  issued_at: string;
}

export interface BlotterCaseSummary {
  id?: number;
  case_number: string;
  complainant_name: string;
  respondent_id?: number | null;
  respondent_name?: string;
  incident_type: string;
  status: string;
  date_recorded: string;
}

export interface BlotterCheckResponse {
  cleared: boolean;
  cases: BlotterCaseSummary[];
}

export interface PreviewIssuanceInput {
  resident_id: number;
  template_id: number;
  purpose?: string;
  or_number?: string;
  amount_paid?: number;
  ctc_number?: string;
  ctc_date_issued?: string;
  ctc_place_issued?: string;
  signatory_official_id: number;
  is_oic_signing?: boolean | number;
  is_override?: boolean;
  blotter_override_reason?: string;
}

export interface CreateIssuanceInput {
  resident_id: number;
  template_id: number;
  purpose: string;
  or_number?: string;
  amount_paid?: number;
  ctc_number?: string;
  ctc_date_issued?: string;
  ctc_place_issued?: string;
  signatory_official_id: number;
  is_oic_signing?: boolean | number;
  is_override?: boolean;
  blotter_override_reason?: string;
}

export interface PreviewIssuanceResponse {
  html: string;
  title_header: string;
  show_officials_sidebar: number;
  control_number_preview: string;
  sidebar_officials: BarangayOfficial[];
  blotter_status: BlotterCheckResponse;
  default_fee: number;
}

export interface PrintableIssuancePayload {
  issuance: CertificateIssuance;
  html: string;
  sidebar_officials: BarangayOfficial[];
  template_name: string;
  title_header: string;
  show_officials_sidebar: number;
}

export interface IssuanceQueryParams {
  start_date?: string;
  end_date?: string;
  template_id?: number | string;
  issued_by_user_id?: number | string;
  had_active_blotter?: number | string;
  search?: string;
  page?: number | string;
  limit?: number | string;
}

export interface IssuanceListItem extends CertificateIssuance {
  resident_name?: string;
  template_name?: string;
  template_code?: string;
  issued_by_name?: string;
}

export interface IssuanceListResponse {
  data: IssuanceListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SingleIssuanceResponse extends CertificateIssuance {
  resident_name?: string;
  template_name?: string;
  template_code?: string;
  title_header?: string;
  show_officials_sidebar?: number;
  issued_by_name?: string;
  html?: string;
  sidebar_officials?: BarangayOfficial[];
  issuance?: CertificateIssuance;
}
