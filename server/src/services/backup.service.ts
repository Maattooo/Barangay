import path from 'path';
import fs from 'fs';
import { db } from '../db/connection';
import { BackupResult } from '../types/system';

/**
 * Generates unique timestamped filename formatted strictly as barangay_backup_YYYYMMDD_HHMMSS.sqlite
 */
export function formatBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `barangay_backup_${yyyy}${mm}${dd}_${hh}${min}${ss}.sqlite`;
}

/**
 * Creates a safe, non-corrupt SQLite hot snapshot backup using better-sqlite3's .backup() API.
 * Ensures the target backup directory exists.
 */
export async function createBackup(customDir?: string): Promise<BackupResult> {
  const backupDir = customDir
    ? path.resolve(customDir)
    : path.resolve(process.cwd(), 'data/backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const filename = formatBackupFilename();
  const filePath = path.join(backupDir, filename);

  // better-sqlite3 backup returns a Promise
  await db.backup(filePath);

  return {
    filename,
    filePath
  };
}
