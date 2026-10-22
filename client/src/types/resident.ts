export type Sex = 'Male' | 'Female';

export type CivilStatus = 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Live-in';

export type ResidencyStatus = 'Active' | 'Moved Out' | 'Deceased';

export type ResidentSector =
  | 'senior'
  | 'pwd'
  | 'indigent'
  | '4ps'
  | 'solo_parent'
  | 'voter'
  | 'youth'
  | 'ofw'
  | 'osy';

export interface Resident {
  id: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string; // YYYY-MM-DD
  sex: Sex;
  civil_status: CivilStatus;
  purok: string;
  house_no_street: string;
  contact_no: string;
  occupation: string;
  nationality: string;
  residency_status: ResidencyStatus;

  // Sector Flags (0 or 1) & Sector IDs
  is_voter: number;
  precinct_no: string;
  is_pwd: number;
  pwd_id_no: string;
  pwd_disability_type: string;
  is_solo_parent: number;
  solo_parent_id_no: string;
  is_4ps: number;
  is_indigent: number;
  is_ofw: number;
  is_osy: number;
  senior_id_no: string;

  // Soft Delete & Audit Metadata
  is_archived: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;

  // Dynamic computed properties
  age: number;
  is_senior: boolean;
  is_youth: boolean;
  is_minor: boolean;
}

export interface ResidentFilters {
  search?: string;
  purok?: string;
  sex?: Sex | '';
  civil_status?: CivilStatus | '';
  sectors?: ResidentSector[];
  page?: number;
  limit?: number;
  include_archived?: boolean | string;
}

export interface CreateResidentInput {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  birthdate: string;
  sex: Sex;
  civil_status: CivilStatus;
  purok: string;
  house_no_street?: string;
  contact_no?: string;
  occupation?: string;
  nationality?: string;
  residency_status?: ResidencyStatus;

  is_voter?: number | boolean;
  precinct_no?: string;
  is_pwd?: number | boolean;
  pwd_id_no?: string;
  pwd_disability_type?: string;
  is_solo_parent?: number | boolean;
  solo_parent_id_no?: string;
  is_4ps?: number | boolean;
  is_indigent?: number | boolean;
  is_ofw?: number | boolean;
  is_osy?: number | boolean;
  senior_id_no?: string;
}

export type UpdateResidentInput = Partial<CreateResidentInput>;

export interface ExcelImportError {
  row?: number;
  resident?: any;
  error: string;
}

export interface ExcelImportResult {
  total_processed: number;
  imported_count: number;
  skipped_duplicates: number;
  errors: ExcelImportError[];
}

export interface PaginatedResidentsResponse {
  data: Resident[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
