import { db } from '../db/connection';
import { BarangayOfficial } from '../types/officials';
import { TemplateInterpolationContext } from '../types/templates';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Calculates ordinal suffix for a calendar day (1st, 2nd, 3rd, 4th, ..., 21st, 22nd, 23rd, 31st).
 */
export function getOrdinalSuffix(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) {
    return `${day}st`;
  }
  if (j === 2 && k !== 12) {
    return `${day}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${day}rd`;
  }
  return `${day}th`;
}

/**
 * Calculates dynamic age given a birthdate string (YYYY-MM-DD or parseable date)
 * and an optional reference date (defaults to today).
 */
export function calculateAge(birthdateStr?: string | null, refDate: Date = new Date()): string {
  if (!birthdateStr || typeof birthdateStr !== 'string') return '';
  const trimmed = birthdateStr.trim();
  if (!trimmed) return '';

  let birthYear: number;
  let birthMonth: number;
  let birthDay: number;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split('T')[0].split('-').map(Number);
    birthYear = y;
    birthMonth = m - 1;
    birthDay = d;
  } else {
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '';
    birthYear = d.getFullYear();
    birthMonth = d.getMonth();
    birthDay = d.getDate();
  }

  let age = refDate.getFullYear() - birthYear;
  const mDiff = refDate.getMonth() - birthMonth;
  if (mDiff < 0 || (mDiff === 0 && refDate.getDate() < birthDay)) {
    age--;
  }

  return age >= 0 ? String(age) : '0';
}

/**
 * Formats a birthdate string into "Month DD, YYYY" (e.g., "October 21, 1990").
 */
export function formatBirthdate(birthdateStr?: string | null): string {
  if (!birthdateStr || typeof birthdateStr !== 'string') return '';
  const trimmed = birthdateStr.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const [y, m, d] = trimmed.split('T')[0].split('-').map(Number);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
    }
  }

  const dt = new Date(trimmed);
  if (isNaN(dt.getTime())) return birthdateStr;
  return `${MONTH_NAMES[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}

/**
 * Retrieves key-value mapping of all system settings from SQLite database.
 */
export function getSystemSettings(): Record<string, string> {
  try {
    const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    return settings;
  } catch {
    return {};
  }
}

export type OfficialsSidebarResult = BarangayOfficial[] & {
  punong_barangay?: BarangayOfficial | null;
  kagawads?: BarangayOfficial[];
  sk_chairperson?: BarangayOfficial | null;
  secretary?: BarangayOfficial | null;
  treasurer?: BarangayOfficial | null;
  officials?: BarangayOfficial[];
};

/**
 * Retrieves active council officials sorted strictly by rank_order ASC.
 * Pre-partitions council roles for the 28% left sidebar layout.
 */
export function getOfficialsSidebarData(): OfficialsSidebarResult {
  const rows = db.prepare(`
    SELECT id, full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by, updated_at
    FROM barangay_officials
    WHERE is_active = 1
    ORDER BY rank_order ASC
  `).all() as BarangayOfficial[];

  const result = [...rows] as OfficialsSidebarResult;
  result.officials = rows;
  result.punong_barangay = rows.find(o => o.position === 'Punong Barangay') || null;
  result.kagawads = rows.filter(o => o.position === 'Sangguniang Barangay Member');
  result.sk_chairperson = rows.find(o => o.position === 'SK Chairperson') || null;
  result.secretary = rows.find(o => o.position === 'Barangay Secretary') || null;
  result.treasurer = rows.find(o => o.position === 'Barangay Treasurer') || null;

  return result;
}

/**
 * Replaces all 20 standard {{placeholders}} case-insensitively in template HTML
 * using resident data, transaction context, and current active barangay officials.
 */
export function interpolateTemplate(
  bodyHtml: string,
  context: TemplateInterpolationContext = {}
): string {
  if (!bodyHtml || typeof bodyHtml !== 'string') {
    return '';
  }

  const resident = context.resident || null;
  const refDate = context.transaction_date ? new Date(context.transaction_date) : new Date();

  // 1. {{full_name}}: FIRST_NAME [MIDDLE_NAME] LAST_NAME [SUFFIX] (Uppercase, trimmed single spaces)
  const nameParts = [
    resident?.first_name,
    resident?.middle_name,
    resident?.last_name,
    resident?.suffix
  ].filter((p): p is string => Boolean(p && typeof p === 'string' && p.trim().length > 0))
   .map(p => p.trim());
  const fullName = nameParts.join(' ').toUpperCase();

  // 2. {{age}}: dynamic calculation from birthdate
  const age = calculateAge(resident?.birthdate, refDate);

  // 3. {{birthdate}}: formatted Month DD, YYYY
  const birthdateFormatted = formatBirthdate(resident?.birthdate);

  // 4. {{sex}}: 'Male' | 'Female'
  const rawSex = (resident?.sex || '').trim();
  const isMale = /^male$/i.test(rawSex);
  const isFemale = /^female$/i.test(rawSex);
  const sex = isMale ? 'Male' : (isFemale ? 'Female' : rawSex);

  // 5. {{civil_status}}
  const civilStatus = (resident?.civil_status || '').trim();

  // 6. {{pronoun_he_she}}: 'he' or 'she'
  const pronounHeShe = isMale ? 'he' : (isFemale ? 'she' : 'they');

  // 7. {{pronoun_his_her}}: 'his' or 'her'
  const pronounHisHer = isMale ? 'his' : (isFemale ? 'her' : 'their');

  // 8. {{purok}}
  const purok = (resident?.purok || '').trim();

  // 9. {{address}}: house_no_street, purok, Barangay, Municipality, Province (omit leading comma if house_no_street is empty)
  const settings = getSystemSettings();
  const street = resident?.house_no_street ? resident.house_no_street.trim() : '';
  const brgy = (settings.barangay_name || '').trim();
  const muni = (settings.municipality_name || '').trim();
  const prov = (settings.province_name || '').trim();

  const address = [street, purok, brgy, muni, prov]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(', ');

  // 10. {{purpose}}
  const purpose = (context.purpose || '').trim();

  // 11. {{control_number}}
  const controlNumber = (context.control_number || '').trim();

  // 12. {{or_number}} & 13. {{amount_paid}}
  let amountPaidStr = 'FREE';
  let isZeroFee = true;

  if (context.amount_paid !== undefined && context.amount_paid !== null) {
    if (typeof context.amount_paid === 'number') {
      if (context.amount_paid > 0) {
        amountPaidStr = `₱${context.amount_paid.toFixed(2)}`;
        isZeroFee = false;
      }
    } else if (typeof context.amount_paid === 'string') {
      const clean = context.amount_paid.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(clean);
      if (!isNaN(parsed) && parsed > 0) {
        amountPaidStr = `₱${parsed.toFixed(2)}`;
        isZeroFee = false;
      }
    }
  }

  let orNumber = (context.or_number || '').trim();
  if (!orNumber || isZeroFee) {
    orNumber = 'FREE / EXEMPT';
  }

  // 14. {{day_ordinal}}
  const dayOrdinal = getOrdinalSuffix(refDate.getDate());

  // 15. {{month_year}}
  const monthYear = `${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()}`;

  // 16. {{punong_barangay}}, 17. {{barangay_secretary}}, 18. {{barangay_treasurer}}
  let punongBarangayName = '';
  let secretaryName = '';
  let treasurerName = '';

  try {
    const pbRow = db.prepare(`
      SELECT full_name FROM barangay_officials
      WHERE position = 'Punong Barangay' AND is_active = 1
      ORDER BY rank_order ASC LIMIT 1
    `).get() as { full_name: string } | undefined;
    if (pbRow) punongBarangayName = pbRow.full_name;

    const secRow = db.prepare(`
      SELECT full_name FROM barangay_officials
      WHERE position = 'Barangay Secretary' AND is_active = 1
      ORDER BY rank_order ASC LIMIT 1
    `).get() as { full_name: string } | undefined;
    if (secRow) secretaryName = secRow.full_name;

    const treasRow = db.prepare(`
      SELECT full_name FROM barangay_officials
      WHERE position = 'Barangay Treasurer' AND is_active = 1
      ORDER BY rank_order ASC LIMIT 1
    `).get() as { full_name: string } | undefined;
    if (treasRow) treasurerName = treasRow.full_name;
  } catch {
    // Database might not be initialized or available in certain isolated tests
  }

  // 19. {{signatory_name}} & 20. {{signatory_title}}
  let signatoryName = punongBarangayName;
  let signatoryPosition = 'Punong Barangay';

  if (context.signatory_official_id) {
    try {
      const signRow = db.prepare(`
        SELECT full_name, position FROM barangay_officials WHERE id = ?
      `).get(context.signatory_official_id) as { full_name: string; position: string } | undefined;
      if (signRow) {
        signatoryName = signRow.full_name;
        signatoryPosition = signRow.position;
      }
    } catch {
      // Fallback to active Punong Barangay
    }
  }

  const isOic = Boolean(
    context.is_oic_signing === true ||
    context.is_oic_signing === 1 ||
    String(context.is_oic_signing).toLowerCase() === 'true' ||
    String(context.is_oic_signing) === '1'
  );

  const signatoryTitle = isOic
    ? 'Sangguniang Barangay Member / OIC'
    : (signatoryPosition || 'Punong Barangay');

  // Mapping of all 20 standard placeholder keys in lowercase
  const replacements: Record<string, string> = {
    full_name: fullName,
    age,
    birthdate: birthdateFormatted,
    sex,
    civil_status: civilStatus,
    pronoun_he_she: pronounHeShe,
    pronoun_his_her: pronounHisHer,
    purok,
    address,
    purpose,
    control_number: controlNumber,
    or_number: orNumber,
    amount_paid: amountPaidStr,
    day_ordinal: dayOrdinal,
    month_year: monthYear,
    punong_barangay: punongBarangayName,
    barangay_secretary: secretaryName,
    barangay_treasurer: treasurerName,
    signatory_name: signatoryName,
    signatory_title: signatoryTitle
  };

  // Replace case-insensitively without throwing on missing values
  return bodyHtml.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gi, (match, tag) => {
    const key = tag.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      return replacements[key] ?? '';
    }
    return match;
  });
}
