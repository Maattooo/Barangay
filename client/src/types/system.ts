export interface SystemSettings {
  barangay_name?: string;
  municipality?: string;
  province?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  seal_url?: string;
  [key: string]: unknown;
}

export interface SystemInfoResponse {
  lan_ips: string[];
  db_size_bytes: number;
  settings: SystemSettings;
}
