import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import { db } from './connection';
import { initSchema } from './init';

/**
 * Seeds the database with default admin user, official roster, certificate templates,
 * sample residents, active blotter case, and system settings.
 *
 * This function is completely idempotent and can be safely executed repeatedly.
 */
export function seed(targetDb: Database.Database = db): void {
  // Ensure schema exists first
  initSchema(targetDb);

  const seedTransaction = targetDb.transaction(() => {
    // 1. DEFAULT ADMIN USER
    const adminPasswordHash = bcryptjs.hashSync('admin123', 10);
    targetDb.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES ('admin', @password_hash, 'System Administrator', 'Admin', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        full_name = excluded.full_name,
        role = excluded.role,
        is_active = excluded.is_active
    `).run({ password_hash: adminPasswordHash });

    const adminUser = targetDb.prepare(`SELECT id FROM users WHERE username = 'admin'`).get() as { id: number };

    // 2. SANGGUNIANG BARANGAY COUNCIL ROSTER (11 Members)
    const councilMembers = [
      {
        full_name: 'HON. ROBERTO C. SANTOS',
        position: 'Punong Barangay',
        committee: 'Executive',
        rank_order: 1,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. MARIA ELENA D. REYES',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Peace and Order',
        rank_order: 2,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. JUANITO P. GARCIA',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Health and Sanitation',
        rank_order: 3,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. CARMELITA S. TAN',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Finance and Appropriation',
        rank_order: 4,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. DANILO V. BAUTISTA',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Infrastructure and Public Works',
        rank_order: 5,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. TERESITA M. AQUINO',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Education and Culture',
        rank_order: 6,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. ANTONIO L. MENDOZA',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Agriculture and Environment',
        rank_order: 7,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. LOURDES R. CASTRO',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Women, Family, and Social Services',
        rank_order: 8,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'HON. CHRISTIAN JOSHUA G. ALVAREZ',
        position: 'SK Chairperson',
        committee: 'Committee on Youth and Sports Development',
        rank_order: 9,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'JOSEPHINE K. DELOS REYES',
        position: 'Barangay Secretary',
        committee: null,
        rank_order: 10,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      },
      {
        full_name: 'RICARDO E. VILLANUEVA',
        position: 'Barangay Treasurer',
        committee: null,
        rank_order: 11,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      }
    ];

    const findOfficial = targetDb.prepare(`SELECT id FROM barangay_officials WHERE rank_order = ?`);
    const updateOfficial = targetDb.prepare(`
      UPDATE barangay_officials
      SET full_name = @full_name,
          position = @position,
          committee = @committee,
          term_start = @term_start,
          term_end = @term_end,
          is_active = @is_active,
          updated_by = @updated_by
      WHERE rank_order = @rank_order
    `);
    const insertOfficial = targetDb.prepare(`
      INSERT INTO barangay_officials (
        full_name, position, committee, rank_order, term_start, term_end, is_active, updated_by
      ) VALUES (
        @full_name, @position, @committee, @rank_order, @term_start, @term_end, @is_active, @updated_by
      )
    `);

    for (const official of councilMembers) {
      const existing = findOfficial.get(official.rank_order);
      const params = { ...official, updated_by: adminUser.id };
      if (existing) {
        updateOfficial.run(params);
      } else {
        insertOfficial.run(params);
      }
    }

    // 3. CERTIFICATE TEMPLATES (4 Templates with Standard HTML & {{placeholders}})
    const templates = [
      {
        template_code: 'BRGY_CLEARANCE',
        template_name: 'Barangay Clearance',
        title_header: 'BARANGAY CLEARANCE',
        body_html: `<p><strong>TO WHOM IT MAY CONCERN:</strong></p>
<p>This is to certify that <strong>{{full_name}}</strong>, {{age}} years old, {{civil_status}}, Filipino, is a bona fide resident of {{purok}}, this Barangay, and that {{pronoun_he_she}} is known to be of good moral character and a law-abiding citizen in the community.</p>
<p>Records of this office further show that the subject person has NO DEROGATORY RECORD or pending criminal/civil case filed against {{pronoun_his_her}} in the Lupong Tagapamayapa of this Barangay as of this date.</p>
<p>This certification is issued upon the request of the interested party for <strong>{{purpose}}</strong> and for whatever legal purpose it may serve.</p>
<p>Given this <strong>{{day_ordinal}}</strong> day of <strong>{{month_year}}</strong> at the Barangay Hall.</p>
<br/><br/>
<div style="text-align: right;">
  <p><strong>{{signatory_name}}</strong><br/>{{signatory_title}}</p>
</div>`,
        show_officials_sidebar: 1,
        default_fee: 50.00,
        requires_blotter_check: 1,
        is_active: 1
      },
      {
        template_code: 'INDIGENCY',
        template_name: 'Certificate of Indigency',
        title_header: 'CERTIFICATE OF INDIGENCY',
        body_html: `<p><strong>TO WHOM IT MAY CONCERN:</strong></p>
<p>This is to certify that <strong>{{full_name}}</strong>, {{age}} years old, {{civil_status}}, is a permanent resident of {{purok}}, this Barangay.</p>
<p>It is further certified that the said resident belongs to an indigent family in this community whose family income is insufficient to sustain their basic day-to-day needs.</p>
<p>This certification is issued upon the request of the bearer for the purpose of <strong>{{purpose}}</strong> (Financial/Medical Assistance/Scholarship).</p>
<p>Issued this <strong>{{day_ordinal}}</strong> day of <strong>{{month_year}}</strong> at the Office of the Punong Barangay.</p>
<br/><br/>
<div style="text-align: right;">
  <p><strong>{{signatory_name}}</strong><br/>{{signatory_title}}</p>
</div>`,
        show_officials_sidebar: 1,
        default_fee: 0.00,
        requires_blotter_check: 0,
        is_active: 1
      },
      {
        template_code: 'RESIDENCY',
        template_name: 'Certificate of Residency',
        title_header: 'CERTIFICATE OF RESIDENCY',
        body_html: `<p><strong>TO WHOM IT MAY CONCERN:</strong></p>
<p>This is to certify that <strong>{{full_name}}</strong>, of legal age, {{civil_status}}, Filipino citizen, is an active resident of {{purok}}, this Barangay, having resided in this community for several years.</p>
<p>This certification is issued upon the request of the interested party for <strong>{{purpose}}</strong>.</p>
<p>Issued this <strong>{{day_ordinal}}</strong> day of <strong>{{month_year}}</strong> at the Barangay Hall.</p>
<br/><br/>
<div style="text-align: right;">
  <p><strong>{{signatory_name}}</strong><br/>{{signatory_title}}</p>
</div>`,
        show_officials_sidebar: 1,
        default_fee: 50.00,
        requires_blotter_check: 0,
        is_active: 1
      },
      {
        template_code: 'JOBSEEKER',
        template_name: 'First-Time Jobseeker Certification',
        title_header: 'FIRST-TIME JOBSEEKER CERTIFICATION',
        body_html: `<p><strong>TO WHOM IT MAY CONCERN:</strong></p>
<p>This is to certify that <strong>{{full_name}}</strong>, {{age}} years old, resident of {{purok}}, this Barangay, is a qualified first-time jobseeker under the provisions of <strong>Republic Act No. 11261</strong> (First Time Jobseekers Assistance Act of 2019).</p>
<p>The applicant is hereby granted exemption from government charges and fees in connection with the application for employment.</p>
<p>Issued this <strong>{{day_ordinal}}</strong> day of <strong>{{month_year}}</strong> at the Office of the Punong Barangay for <strong>{{purpose}}</strong>.</p>
<br/><br/>
<div style="text-align: right;">
  <p><strong>{{signatory_name}}</strong><br/>{{signatory_title}}</p>
</div>`,
        show_officials_sidebar: 1,
        default_fee: 0.00,
        requires_blotter_check: 1,
        is_active: 1
      }
    ];

    const upsertTemplate = targetDb.prepare(`
      INSERT INTO certificate_templates (
        template_code, template_name, title_header, body_html,
        show_officials_sidebar, default_fee, requires_blotter_check, is_active, updated_by
      ) VALUES (
        @template_code, @template_name, @title_header, @body_html,
        @show_officials_sidebar, @default_fee, @requires_blotter_check, @is_active, @updated_by
      )
      ON CONFLICT(template_code) DO UPDATE SET
        template_name = excluded.template_name,
        title_header = excluded.title_header,
        body_html = excluded.body_html,
        show_officials_sidebar = excluded.show_officials_sidebar,
        default_fee = excluded.default_fee,
        requires_blotter_check = excluded.requires_blotter_check,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by
    `);

    for (const t of templates) {
      upsertTemplate.run({ ...t, updated_by: adminUser.id });
    }

    // 4. SAMPLE RESIDENTS (10 Residents covering diverse Puroks and Special Sectors)
    const sampleResidents = [
      {
        first_name: 'Juan',
        middle_name: 'Mendoza',
        last_name: 'Dela Cruz',
        suffix: 'Jr.',
        birthdate: '1955-05-15', // Senior (>=60 yrs)
        sex: 'Male',
        civil_status: 'Married',
        purok: 'Purok 1',
        house_no_street: '123 Rizal St.',
        contact_no: '09171234567',
        occupation: 'Retired Public Servant',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0012A',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: 'OSCA-2015-0045'
      },
      {
        first_name: 'Corazon',
        middle_name: 'Aquino',
        last_name: 'Silang',
        suffix: '',
        birthdate: '1950-11-20', // Senior (>=60 yrs), PWD, Indigent
        sex: 'Female',
        civil_status: 'Widowed',
        purok: 'Purok 2',
        house_no_street: '45 Mabini St.',
        contact_no: '09182345678',
        occupation: 'Homemaker',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0012B',
        is_pwd: 1,
        pwd_id_no: 'PWD-2020-0012',
        pwd_disability_type: 'Visual Impairment',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 1,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: 'OSCA-2010-0102'
      },
      {
        first_name: 'Maria',
        middle_name: 'Santos',
        last_name: 'Santos',
        suffix: '',
        birthdate: '1988-03-12', // Solo Parent, 4Ps, Indigent
        sex: 'Female',
        civil_status: 'Separated',
        purok: 'Purok 3',
        house_no_street: 'Block 4 Lot 10, Sampaguita St.',
        contact_no: '09193456789',
        occupation: 'Dressmaker',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0013A',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 1,
        solo_parent_id_no: 'SP-2022-0056',
        is_4ps: 1,
        is_indigent: 1,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Rodrigo',
        middle_name: 'Alvarez',
        last_name: 'Reyes',
        suffix: '',
        birthdate: '1992-08-25', // Blotter Respondent
        sex: 'Male',
        civil_status: 'Single',
        purok: 'Purok 1',
        house_no_street: '77 Bonifacio St.',
        contact_no: '09204567890',
        occupation: 'Construction Worker',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0012A',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Angelo',
        middle_name: 'Santos',
        last_name: 'Santos',
        suffix: '',
        birthdate: '2015-06-18', // Minor (<18 yrs)
        sex: 'Male',
        civil_status: 'Single',
        purok: 'Purok 3',
        house_no_street: 'Block 4 Lot 10, Sampaguita St.',
        contact_no: '',
        occupation: 'Student',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 0,
        precinct_no: '',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Mark Dave',
        middle_name: 'Castro',
        last_name: 'Navarro',
        suffix: '',
        birthdate: '2005-09-14', // Out-of-School Youth (OSY)
        sex: 'Male',
        civil_status: 'Single',
        purok: 'Sitio Centro',
        house_no_street: '12 Riverside',
        contact_no: '09215678901',
        occupation: 'Freelance Courier',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0014B',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 1,
        senior_id_no: ''
      },
      {
        first_name: 'Elena',
        middle_name: 'Bautista',
        last_name: 'Torres',
        suffix: '',
        birthdate: '1983-01-30', // OFW
        sex: 'Female',
        civil_status: 'Married',
        purok: 'Purok 4',
        house_no_street: '88 Ilang-Ilang St.',
        contact_no: '09226789012',
        occupation: 'Overseas Filipino Worker (Nurse)',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0015A',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 1,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Felipe',
        middle_name: 'Castro',
        last_name: 'Lim',
        suffix: '',
        birthdate: '1978-04-10', // Blotter Complainant
        sex: 'Male',
        civil_status: 'Married',
        purok: 'Purok 1',
        house_no_street: '75 Bonifacio St.',
        contact_no: '09237890123',
        occupation: 'Sari-Sari Store Owner',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0012A',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Grace',
        middle_name: 'Mercado',
        last_name: 'Tan',
        suffix: '',
        birthdate: '1996-12-05', // PWD
        sex: 'Female',
        civil_status: 'Single',
        purok: 'Sitio Centro',
        house_no_street: '34 Central Ave.',
        contact_no: '09248901234',
        occupation: 'Virtual Assistant',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0014A',
        is_pwd: 1,
        pwd_id_no: 'PWD-2023-0089',
        pwd_disability_type: 'Orthopedic Disability',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      },
      {
        first_name: 'Joshua',
        middle_name: 'David',
        last_name: 'Perez',
        suffix: '',
        birthdate: '2004-07-22', // Youth / First-Time Jobseeker
        sex: 'Male',
        civil_status: 'Single',
        purok: 'Purok 2',
        house_no_street: '19 Dahlia St.',
        contact_no: '09259012345',
        occupation: 'First-Time Jobseeker',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_voter: 1,
        precinct_no: '0012B',
        is_pwd: 0,
        pwd_id_no: '',
        pwd_disability_type: '',
        is_solo_parent: 0,
        solo_parent_id_no: '',
        is_4ps: 0,
        is_indigent: 0,
        is_ofw: 0,
        is_osy: 0,
        senior_id_no: ''
      }
    ];

    const findResident = targetDb.prepare(`
      SELECT id FROM residents WHERE first_name = ? AND last_name = ? AND birthdate = ?
    `);
    const updateResident = targetDb.prepare(`
      UPDATE residents SET
        middle_name = @middle_name,
        suffix = @suffix,
        sex = @sex,
        civil_status = @civil_status,
        purok = @purok,
        house_no_street = @house_no_street,
        contact_no = @contact_no,
        occupation = @occupation,
        nationality = @nationality,
        residency_status = @residency_status,
        is_voter = @is_voter,
        precinct_no = @precinct_no,
        is_pwd = @is_pwd,
        pwd_id_no = @pwd_id_no,
        pwd_disability_type = @pwd_disability_type,
        is_solo_parent = @is_solo_parent,
        solo_parent_id_no = @solo_parent_id_no,
        is_4ps = @is_4ps,
        is_indigent = @is_indigent,
        is_ofw = @is_ofw,
        is_osy = @is_osy,
        senior_id_no = @senior_id_no,
        updated_by = @updated_by
      WHERE id = @id
    `);
    const insertResident = targetDb.prepare(`
      INSERT INTO residents (
        first_name, middle_name, last_name, suffix, birthdate, sex, civil_status,
        purok, house_no_street, contact_no, occupation, nationality, residency_status,
        is_voter, precinct_no, is_pwd, pwd_id_no, pwd_disability_type,
        is_solo_parent, solo_parent_id_no, is_4ps, is_indigent, is_ofw, is_osy, senior_id_no,
        created_by, updated_by
      ) VALUES (
        @first_name, @middle_name, @last_name, @suffix, @birthdate, @sex, @civil_status,
        @purok, @house_no_street, @contact_no, @occupation, @nationality, @residency_status,
        @is_voter, @precinct_no, @is_pwd, @pwd_id_no, @pwd_disability_type,
        @is_solo_parent, @solo_parent_id_no, @is_4ps, @is_indigent, @is_ofw, @is_osy, @senior_id_no,
        @created_by, @updated_by
      )
    `);

    for (const r of sampleResidents) {
      const existing = findResident.get(r.first_name, r.last_name, r.birthdate) as { id: number } | undefined;
      const params = {
        ...r,
        created_by: adminUser.id,
        updated_by: adminUser.id
      };
      if (existing) {
        updateResident.run({ ...params, id: existing.id });
      } else {
        insertResident.run(params);
      }
    }

    // 5. ACTIVE BLOTTER RECORD (Linked to Respondent Resident)
    const respondent = targetDb.prepare(`
      SELECT id, first_name || ' ' || last_name AS name
      FROM residents
      WHERE first_name = 'Rodrigo' AND last_name = 'Reyes'
    `).get() as { id: number; name: string } | undefined;

    const complainant = targetDb.prepare(`
      SELECT id, first_name || ' ' || last_name AS name
      FROM residents
      WHERE first_name = 'Felipe' AND last_name = 'Lim'
    `).get() as { id: number; name: string } | undefined;

    if (respondent && complainant) {
      targetDb.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_id, complainant_name,
          respondent_id, respondent_name, incident_type,
          incident_location, incident_details, date_incident,
          date_recorded, status, settlement_notes, created_by, updated_by
        ) VALUES (
          'BLT-2026-001',
          @complainant_id,
          @complainant_name,
          @respondent_id,
          @respondent_name,
          'Collection of Sum of Money',
          'Purok 1, Bonifacio St.',
          'Complainant alleges respondent failed to pay outstanding sari-sari store grocery credit amounting to PHP 4,500 despite repeated verbal demands.',
          '2026-10-10',
          '2026-10-12 14:30:00',
          'Active',
          '',
          @created_by,
          @updated_by
        )
        ON CONFLICT(case_number) DO UPDATE SET
          complainant_id = excluded.complainant_id,
          complainant_name = excluded.complainant_name,
          respondent_id = excluded.respondent_id,
          respondent_name = excluded.respondent_name,
          incident_type = excluded.incident_type,
          incident_location = excluded.incident_location,
          incident_details = excluded.incident_details,
          date_incident = excluded.date_incident,
          date_recorded = excluded.date_recorded,
          status = excluded.status,
          updated_by = excluded.updated_by
      `).run({
        complainant_id: complainant.id,
        complainant_name: complainant.name,
        respondent_id: respondent.id,
        respondent_name: respondent.name,
        created_by: adminUser.id,
        updated_by: adminUser.id
      });
    }

    // 6. DEFAULT SYSTEM SETTINGS METADATA
    const defaultSettings = [
      { key: 'barangay_name', value: 'Barangay San Jose' },
      { key: 'municipality_name', value: 'Antipolo City' },
      { key: 'province_name', value: 'Rizal' },
      { key: 'region_name', value: 'Region IV-A (CALABARZON)' },
      { key: 'contact_email', value: 'sanjose.antipolo@example.gov.ph' },
      { key: 'puroks_json', value: JSON.stringify(['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4', 'Sitio Centro', 'Sitio Riverside']) },
      { key: 'streets_json', value: JSON.stringify(['Rizal St.', 'Bonifacio St.', 'Mabini St.', 'Dahlia St.', 'Riverside Ave.', 'Sampaguita St.']) }
    ];

    const upsertSetting = targetDb.prepare(`
      INSERT INTO system_settings (key, value)
      VALUES (@key, @value)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const setting of defaultSettings) {
      upsertSetting.run(setting);
    }
  });

  seedTransaction();
}

// Execute when invoked directly via CLI (tsx src/db/seed.ts or node dist/db/seed.js)
const isDirectRun =
  require.main === module ||
  (process.argv[1] !== undefined &&
    (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js')));

if (isDirectRun) {
  try {
    console.log('[Database] Seeding database...');
    seed();
    console.log('[Database] Database seeded successfully.');
  } catch (error) {
    console.error('[Database] Seeding failed:', error);
    process.exit(1);
  }
}
