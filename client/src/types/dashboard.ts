export interface PurokCountItem {
  purok: string;
  count: number;
}

export interface ResidentStats {
  total_residents: number;
  seniors: number;
  pwds: number;
  four_ps: number;
  indigents: number;
  voters: number;
  solo_parents: number;
  ofw: number;
  osy: number;
  youth: number;
  minors: number;
  active_blotters: number;
  purok_counts: Record<string, number> | PurokCountItem[];
}

export interface RecentIssuance {
  id: number;
  control_number?: string;
  tracking_code?: string;
  template_name?: string;
  template_type?: string;
  resident_name: string;
  issued_at: string;
  issued_by_name?: string;
  status?: string;
}

export interface RecentBlotter {
  id: number;
  case_number: string;
  incident_type: string;
  complainant_name: string;
  respondent_name: string;
  status: string;
  incident_date: string;
}
