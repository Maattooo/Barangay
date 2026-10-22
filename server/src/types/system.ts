export interface SystemInfoResponse {
  lan_ips: string[];
  db_size_bytes: number;
  settings: Record<string, string>;
}

export interface BackupResult {
  filename: string;
  filePath: string;
}
