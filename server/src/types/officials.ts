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
  updated_by: number | null;
  updated_at: string;
}

export interface CreateOfficialInput {
  full_name: string;
  position: OfficialPosition;
  committee?: string | null;
  rank_order: number;
  term_start?: string | null;
  term_end?: string | null;
  is_active?: number;
}

export interface UpdateOfficialInput {
  full_name?: string;
  position?: OfficialPosition;
  committee?: string | null;
  rank_order?: number;
  term_start?: string | null;
  term_end?: string | null;
  is_active?: number;
}
