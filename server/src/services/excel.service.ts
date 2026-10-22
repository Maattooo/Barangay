import * as xlsx from 'xlsx';
import { db } from '../db/connection';
import {
  Resident,
  Sex,
  CivilStatus,
  ResidencyStatus,
  ExcelImportResult,
  ExcelImportError
} from '../types/resident';
import Database from 'better-sqlite3';

export const HEADER_ALIASES: Record<string, string> = {
  // First name
  'first_name': 'first_name',
  'firstname': 'first_name',
  'first name': 'first_name',
  'pangalan': 'first_name',
  'unang pangalan': 'first_name',

  // Middle name
  'middle_name': 'middle_name',
  'middlename': 'middle_name',
  'middle name': 'middle_name',
  'gitnang pangalan': 'middle_name',

  // Last name
  'last_name': 'last_name',
  'lastname': 'last_name',
  'last name': 'last_name',
  'apelyido': 'last_name',

  // Suffix
  'suffix': 'suffix',
  'hulapi': 'suffix',

  // Birthdate
  'birthdate': 'birthdate',
  'birth_date': 'birthdate',
  'birthday': 'birthdate',
  'birth date': 'birthdate',
  'date of birth': 'birthdate',
  'dob': 'birthdate',
  'kaarawan': 'birthdate',
  'kapanganakan': 'birthdate',

  // Sex
  'sex': 'sex',
  'gender': 'sex',
  'kasarian': 'sex',

  // Civil Status
  'civil_status': 'civil_status',
  'civilstatus': 'civil_status',
  'civil status': 'civil_status',
  'marital status': 'civil_status',
  'katayuang sibil': 'civil_status',

  // Purok
  'purok': 'purok',
  'sitio': 'purok',
  'zone': 'purok',

  // House No / Street
  'house_no_street': 'house_no_street',
  'housenostreet': 'house_no_street',
  'house no street': 'house_no_street',
  'house no': 'house_no_street',
  'street': 'house_no_street',
  'address': 'house_no_street',
  'tirahan': 'house_no_street',

  // Contact No
  'contact_no': 'contact_no',
  'contactno': 'contact_no',
  'contact no': 'contact_no',
  'contact': 'contact_no',
  'phone': 'contact_no',
  'mobile': 'contact_no',
  'cellphone': 'contact_no',
  'telepono': 'contact_no',

  // Occupation
  'occupation': 'occupation',
  'hanapbuhay': 'occupation',
  'trabaho': 'occupation',

  // Nationality
  'nationality': 'nationality',
  'nasyonalidad': 'nationality',

  // Residency Status
  'residency_status': 'residency_status',
  'residencystatus': 'residency_status',
  'residency status': 'residency_status',
  'status ng paninirahan': 'residency_status',

  // Voter
  'is_voter': 'is_voter',
  'voter': 'is_voter',
  'is voter': 'is_voter',
  'registered voter': 'is_voter',
  'botante': 'is_voter',

  // Precinct No
  'precinct_no': 'precinct_no',
  'precinct': 'precinct_no',
  'precinct no': 'precinct_no',
  'presinto': 'precinct_no',

  // PWD
  'is_pwd': 'is_pwd',
  'pwd': 'is_pwd',
  'is pwd': 'is_pwd',

  // PWD ID
  'pwd_id_no': 'pwd_id_no',
  'pwd id': 'pwd_id_no',
  'pwd id no': 'pwd_id_no',
  'pwd_id': 'pwd_id_no',

  // Disability Type
  'pwd_disability_type': 'pwd_disability_type',
  'disability': 'pwd_disability_type',
  'disability type': 'pwd_disability_type',
  'pwd disability type': 'pwd_disability_type',

  // Solo Parent
  'is_solo_parent': 'is_solo_parent',
  'solo_parent': 'is_solo_parent',
  'solo parent': 'is_solo_parent',
  'is solo parent': 'is_solo_parent',

  // Solo Parent ID
  'solo_parent_id_no': 'solo_parent_id_no',
  'solo parent id': 'solo_parent_id_no',
  'solo parent id no': 'solo_parent_id_no',

  // 4Ps
  'is_4ps': 'is_4ps',
  '4ps': 'is_4ps',
  'is 4ps': 'is_4ps',
  'pantawid': 'is_4ps',

  // Indigent
  'is_indigent': 'is_indigent',
  'indigent': 'is_indigent',
  'is indigent': 'is_indigent',

  // OFW
  'is_ofw': 'is_ofw',
  'ofw': 'is_ofw',
  'is ofw': 'is_ofw',

  // OSY
  'is_osy': 'is_osy',
  'osy': 'is_osy',
  'is osy': 'is_osy',
  'out of school youth': 'is_osy',
  'out-of-school youth': 'is_osy',

  // Senior ID
  'senior_id_no': 'senior_id_no',
  'senior id': 'senior_id_no',
  'senior id no': 'senior_id_no',
  'osca id': 'senior_id_no',
  'osca id no': 'senior_id_no'
};

/**
 * Normalizes header string to canonical database column name.
 */
export function normalizeHeader(raw: string): string {
  if (!raw) return '';
  const cleaned = String(raw).trim().toLowerCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ');
  if (HEADER_ALIASES[cleaned]) {
    return HEADER_ALIASES[cleaned];
  }
  const compact = cleaned.replace(/\s+/g, '');
  if (HEADER_ALIASES[compact]) {
    return HEADER_ALIASES[compact];
  }
  return raw;
}

/**
 * Converts various truthy values (1, 'true', 'yes', 'y', 'oo', etc.) to 1, otherwise 0.
 */
export function parseBooleanFlag(val: any): number {
  if (val === 1 || val === true) return 1;
  if (typeof val === 'number') return val > 0 ? 1 : 0;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'oo', 'checked'].includes(s)) return 1;
  }
  return 0;
}

/**
 * Safely parses Date instances, Excel date serials, or date strings into strictly YYYY-MM-DD.
 */
export function parseDateValue(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof val === 'number') {
    try {
      const parsed = xlsx.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
      }
    } catch {
      // Ignore fallback
    }
  }

  const str = String(val).trim();

  // Strict YYYY-MM-DD match
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(str + 'T00:00:00');
      if (!isNaN(dt.getTime()) && dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d) {
        return str;
      }
    }
    return null;
  }

  // MM/DD/YYYY or DD/MM/YYYY with disambiguation
  const slashDashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashDashMatch) {
    const token1 = parseInt(slashDashMatch[1], 10);
    const token2 = parseInt(slashDashMatch[2], 10);
    const y = parseInt(slashDashMatch[3], 10);

    let m: number;
    let d: number;

    if (token1 > 12) {
      // First token > 12 => must be DD/MM/YYYY
      d = token1;
      m = token2;
    } else if (token2 > 12) {
      // Second token > 12 => must be MM/DD/YYYY
      m = token1;
      d = token2;
    } else {
      // Both <= 12: default to MM/DD/YYYY
      m = token1;
      d = token2;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt = new Date(candidate + 'T00:00:00');
      if (!isNaN(dt.getTime()) && dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d) {
        return candidate;
      }
    }
    return null;
  }

  // General ISO string or standard date parse fallback
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    const year = dt.getFullYear();
    const month = dt.getMonth() + 1;
    const day = dt.getDate();
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const checkDt = new Date(candidate + 'T00:00:00');
    if (checkDt.getFullYear() === year && (checkDt.getMonth() + 1) === month && checkDt.getDate() === day) {
      return candidate;
    }
  }

  return null;
}

/**
 * Validates that date is YYYY-MM-DD format, is a real calendar date (no JavaScript rollover),
 * and is not in the future.
 */
export function isValidPastDate(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) return false;

  const dt = new Date(dateStr + 'T00:00:00');
  if (isNaN(dt.getTime())) return false;

  // Strict calendar check: verify no rollover occurred (e.g. Feb 31 -> Mar 3)
  if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== m || dt.getDate() !== d) {
    return false;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return dateStr <= todayStr;
}

/**
 * Normalizes Sex string to 'Male' or 'Female'.
 */
export function normalizeSex(val: any): Sex | null {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (['male', 'm', 'lalaki', 'lalake'].includes(s)) return 'Male';
  if (['female', 'f', 'babae'].includes(s)) return 'Female';
  return null;
}

/**
 * Normalizes Civil Status string to allowed CHECK values.
 */
export function normalizeCivilStatus(val: any): CivilStatus | null {
  if (!val) return null;
  const s = String(val).trim().toLowerCase();
  if (['single', 'binata', 'dalaga', 'walang asawa'].includes(s)) return 'Single';
  if (['married', 'kasal', 'may asawa'].includes(s)) return 'Married';
  if (['widowed', 'biyudo', 'biyuda', 'balo'].includes(s)) return 'Widowed';
  if (['separated', 'hiwalay'].includes(s)) return 'Separated';
  if (['live-in', 'livein', 'live in', 'kinakasama'].includes(s)) return 'Live-in';
  return null;
}

/**
 * Normalizes Residency Status string to allowed CHECK values.
 */
export function normalizeResidencyStatus(val: any): ResidencyStatus {
  if (!val) return 'Active';
  const s = String(val).trim().toLowerCase();
  if (['moved out', 'moved_out', 'umalis'].includes(s)) return 'Moved Out';
  if (['deceased', 'patay', 'pumanaw'].includes(s)) return 'Deceased';
  return 'Active';
}

/**
 * Normalizes a raw resident row object mapping aliases to canonical resident fields.
 */
export function normalizeRow(rawRow: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const canonicalKey = normalizeHeader(key);
    normalized[canonicalKey] = value;
  }
  return normalized;
}

/**
 * Parses an Excel buffer into an array of normalized row objects.
 */
export function parseExcelBuffer(buffer: Buffer): Array<Record<string, any>> {
  const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [];
  }
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd'
  });

  return rawRows.map(normalizeRow);
}

/**
 * Imports residents from raw records (parsed Excel or JSON array),
 * skips duplicates matching first_name + last_name + birthdate,
 * validates formats, and performs batch insertion atomically.
 */
export function importResidents(
  records: Array<Record<string, any>>,
  userId: number,
  dbInstance: Database.Database = db
): ExcelImportResult {
  const result: ExcelImportResult = {
    total_processed: 0,
    imported_count: 0,
    skipped_duplicates: 0,
    errors: []
  };

  const checkDuplicateStmt = dbInstance.prepare(`
    SELECT id FROM residents
    WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(?))
      AND LOWER(TRIM(last_name)) = LOWER(TRIM(?))
      AND birthdate = ?
      AND is_archived = 0
  `);

  const insertStmt = dbInstance.prepare(`
    INSERT INTO residents (
      first_name, middle_name, last_name, suffix, birthdate, sex, civil_status,
      purok, house_no_street, contact_no, occupation, nationality, residency_status,
      is_voter, precinct_no, is_pwd, pwd_id_no, pwd_disability_type,
      is_solo_parent, solo_parent_id_no, is_4ps, is_indigent, is_ofw, is_osy, senior_id_no,
      is_archived, created_by, updated_by
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      0, ?, ?
    )
  `);

  // Track duplicates within the incoming batch to prevent double insertion
  const seenInBatch = new Set<string>();

  const transaction = dbInstance.transaction(() => {
    for (let i = 0; i < records.length; i++) {
      result.total_processed++;
      const raw = normalizeRow(records[i]);
      const rowIndex = i + 1;

      const firstName = String(raw.first_name || '').trim();
      const lastName = String(raw.last_name || '').trim();
      const middleName = String(raw.middle_name || '').trim();
      const suffix = String(raw.suffix || '').trim();
      const rawBirthdate = raw.birthdate;
      const purok = String(raw.purok || '').trim();

      // Required field validation
      if (!firstName) {
        result.errors.push({ row: rowIndex, resident: raw, error: 'Missing or empty first_name' });
        continue;
      }
      if (!lastName) {
        result.errors.push({ row: rowIndex, resident: raw, error: 'Missing or empty last_name' });
        continue;
      }
      if (!purok) {
        result.errors.push({ row: rowIndex, resident: raw, error: 'Missing or empty purok' });
        continue;
      }

      const birthdate = parseDateValue(rawBirthdate);
      if (!birthdate || !isValidPastDate(birthdate)) {
        result.errors.push({
          row: rowIndex,
          resident: raw,
          error: `Invalid birthdate: "${rawBirthdate}". Must be a valid calendar date in YYYY-MM-DD format and cannot be in the future`
        });
        continue;
      }

      const sex = normalizeSex(raw.sex);
      if (!sex) {
        result.errors.push({
          row: rowIndex,
          resident: raw,
          error: `Invalid sex: "${raw.sex}". Must be Male or Female`
        });
        continue;
      }

      const civilStatus = normalizeCivilStatus(raw.civil_status);
      if (!civilStatus) {
        result.errors.push({
          row: rowIndex,
          resident: raw,
          error: `Invalid civil_status: "${raw.civil_status}". Must be Single, Married, Widowed, Separated, or Live-in`
        });
        continue;
      }

      const residencyStatus = normalizeResidencyStatus(raw.residency_status);

      // Check duplicates
      const dupKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${birthdate}`;
      if (seenInBatch.has(dupKey)) {
        result.skipped_duplicates++;
        continue;
      }

      const existing = checkDuplicateStmt.get(firstName, lastName, birthdate);
      if (existing) {
        result.skipped_duplicates++;
        continue;
      }

      seenInBatch.add(dupKey);

      // Extract optional fields
      const houseNoStreet = String(raw.house_no_street || '').trim();
      const contactNo = String(raw.contact_no || '').trim();
      const occupation = String(raw.occupation || '').trim();
      const nationality = String(raw.nationality || 'Filipino').trim();
      const precinctNo = String(raw.precinct_no || '').trim();
      const pwdIdNo = String(raw.pwd_id_no || '').trim();
      const pwdDisabilityType = String(raw.pwd_disability_type || '').trim();
      const soloParentIdNo = String(raw.solo_parent_id_no || '').trim();
      const seniorIdNo = String(raw.senior_id_no || '').trim();

      const isVoter = parseBooleanFlag(raw.is_voter);
      const isPwd = parseBooleanFlag(raw.is_pwd);
      const isSoloParent = parseBooleanFlag(raw.is_solo_parent);
      const is4ps = parseBooleanFlag(raw.is_4ps);
      const isIndigent = parseBooleanFlag(raw.is_indigent);
      const isOfw = parseBooleanFlag(raw.is_ofw);
      const isOsy = parseBooleanFlag(raw.is_osy);

      insertStmt.run(
        firstName,
        middleName,
        lastName,
        suffix,
        birthdate,
        sex,
        civilStatus,
        purok,
        houseNoStreet,
        contactNo,
        occupation,
        nationality,
        residencyStatus,
        isVoter,
        precinctNo,
        isPwd,
        pwdIdNo,
        pwdDisabilityType,
        isSoloParent,
        soloParentIdNo,
        is4ps,
        isIndigent,
        isOfw,
        isOsy,
        seniorIdNo,
        userId,
        userId
      );

      result.imported_count++;
    }
  });

  transaction();

  return result;
}

/**
 * Generates an Excel (.xlsx) workbook buffer from an array of residents.
 */
export function exportResidentsToExcel(residents: Resident[]): Buffer {
  const exportRows = residents.map((r) => ({
    'Resident ID': r.id,
    'Last Name': r.last_name,
    'First Name': r.first_name,
    'Middle Name': r.middle_name || '',
    'Suffix': r.suffix || '',
    'Birthdate': r.birthdate,
    'Age': r.age,
    'Sex': r.sex,
    'Civil Status': r.civil_status,
    'Purok': r.purok,
    'Address / Street': r.house_no_street || '',
    'Contact No': r.contact_no || '',
    'Occupation': r.occupation || '',
    'Nationality': r.nationality,
    'Residency Status': r.residency_status,
    'Registered Voter': r.is_voter ? 'Yes' : 'No',
    'Precinct No': r.precinct_no || '',
    'PWD': r.is_pwd ? 'Yes' : 'No',
    'PWD ID No': r.pwd_id_no || '',
    'Disability Type': r.pwd_disability_type || '',
    'Solo Parent': r.is_solo_parent ? 'Yes' : 'No',
    'Solo Parent ID No': r.solo_parent_id_no || '',
    '4Ps Beneficiary': r.is_4ps ? 'Yes' : 'No',
    'Indigent': r.is_indigent ? 'Yes' : 'No',
    'OFW': r.is_ofw ? 'Yes' : 'No',
    'Out-of-School Youth (OSY)': r.is_osy ? 'Yes' : 'No',
    'Senior Citizen': r.is_senior ? 'Yes' : 'No',
    'Senior ID No': r.senior_id_no || ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportRows);

  // Styling column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Resident ID
    { wch: 16 }, // Last Name
    { wch: 16 }, // First Name
    { wch: 16 }, // Middle Name
    { wch: 8 },  // Suffix
    { wch: 12 }, // Birthdate
    { wch: 6 },  // Age
    { wch: 8 },  // Sex
    { wch: 14 }, // Civil Status
    { wch: 16 }, // Purok
    { wch: 25 }, // Address / Street
    { wch: 15 }, // Contact No
    { wch: 16 }, // Occupation
    { wch: 12 }, // Nationality
    { wch: 16 }, // Residency Status
    { wch: 16 }, // Registered Voter
    { wch: 14 }, // Precinct No
    { wch: 8 },  // PWD
    { wch: 14 }, // PWD ID No
    { wch: 18 }, // Disability Type
    { wch: 14 }, // Solo Parent
    { wch: 18 }, // Solo Parent ID No
    { wch: 16 }, // 4Ps Beneficiary
    { wch: 12 }, // Indigent
    { wch: 8 },  // OFW
    { wch: 24 }, // Out-of-School Youth (OSY)
    { wch: 16 }, // Senior Citizen
    { wch: 16 }  // Senior ID No
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Barangay Residents');

  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
