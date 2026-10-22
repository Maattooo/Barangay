import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import * as xlsx from 'xlsx';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import { parseDateValue } from '../src/services/excel.service';

describe('Excel Engine & Bulk Import/Export Test Suite (excel.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_excel_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;

  beforeAll(async () => {
    // Clean up any stale test database
    const filesToClean = [
      testDbFile,
      `${testDbFile}-wal`,
      `${testDbFile}-shm`
    ];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore
        }
      }
    }

    initDb(testDbFile);
    initSchema();
    seed();

    // Ensure all 4 roles exist
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('xl_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('xl_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('xl_lupon', ?, 'Lupon Member', 'Lupon', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        is_active = excluded.is_active
    `).run(passHash, passHash, passHash);

    // Acquire tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const clerkLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'xl_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'xl_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'xl_lupon', password: 'matrix_pass_123' });
    luponToken = luponLogin.body.token;
  });

  afterAll(() => {
    closeDb();
    const filesToClean = [
      testDbFile,
      `${testDbFile}-wal`,
      `${testDbFile}-shm`
    ];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore
        }
      }
    }
  });

  // Helper to build an in-memory .xlsx Buffer using SheetJS
  function createExcelBuffer(rows: Array<Record<string, any>>): Buffer {
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Residents');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  // 1. Excel Bulk Import & Duplicate Detection
  describe('1. Excel Import & Duplicate Detection', () => {
    it('ingests an Excel file with 5 valid records: assert all 5 inserted, imported_count = 5, skipped_duplicates = 0', async () => {
      // Clear residents table
      db.prepare('DELETE FROM residents').run();

      const validRecords = [
        {
          'First Name': 'Maria',
          'Last Name': 'Santos',
          'Birthdate': '1980-05-12',
          'Kasarian': 'Female',
          'Civil Status': 'Married',
          'Purok': 'Purok 1',
          'Registered Voter': 'Yes'
        },
        {
          'First Name': 'Jose',
          'Last Name': 'Rizal',
          'Birthdate': '1975-06-19',
          'Kasarian': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 2',
          'PWD': '1'
        },
        {
          'First Name': 'Andres',
          'Last Name': 'Bonifacio',
          'Birthdate': '1982-11-30',
          'Kasarian': 'Male',
          'Civil Status': 'Married',
          'Purok': 'Purok 1'
        },
        {
          'First Name': 'Gabriela',
          'Last Name': 'Silang',
          'Birthdate': '1990-03-19',
          'Kasarian': 'Female',
          'Civil Status': 'Widowed',
          'Purok': 'Purok 3',
          'Solo Parent': 'true'
        },
        {
          'First Name': 'Emilio',
          'Last Name': 'Jacinto',
          'Birthdate': '1995-12-15',
          'Kasarian': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 2'
        }
      ];

      const excelBuffer = createExcelBuffer(validRecords);

      const res = await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'batch1.xlsx')
        .expect(200);

      expect(res.body).toEqual({
        total_processed: 5,
        imported_count: 5,
        skipped_duplicates: 0,
        errors: []
      });

      const count = db.prepare('SELECT COUNT(*) as count FROM residents').get() as { count: number };
      expect(count.count).toBe(5);
    });

    it('ingests second file containing 2 new records and 3 identical records: assert imported_count = 2, skipped_duplicates = 3', async () => {
      const mixedRecords = [
        // Duplicate 1 (Maria Santos)
        {
          'First Name': 'Maria',
          'Last Name': 'Santos',
          'Birthdate': '1980-05-12',
          'Sex': 'Female',
          'Civil Status': 'Married',
          'Purok': 'Purok 1'
        },
        // Duplicate 2 (Jose Rizal - case insensitive & trimmed)
        {
          'First Name': '  jose  ',
          'Last Name': '  RIZAL  ',
          'Birthdate': '1975-06-19',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 2'
        },
        // Duplicate 3 (Andres Bonifacio)
        {
          'First Name': 'Andres',
          'Last Name': 'Bonifacio',
          'Birthdate': '1982-11-30',
          'Sex': 'Male',
          'Civil Status': 'Married',
          'Purok': 'Purok 1'
        },
        // New Record 1
        {
          'First Name': 'Juan',
          'Last Name': 'Luna',
          'Birthdate': '1988-10-23',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 4'
        },
        // New Record 2
        {
          'First Name': 'Melchora',
          'Last Name': 'Aquino',
          'Birthdate': '1955-01-06',
          'Sex': 'Female',
          'Civil Status': 'Widowed',
          'Purok': 'Purok 4'
        }
      ];

      const excelBuffer = createExcelBuffer(mixedRecords);

      const res = await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'batch2.xlsx')
        .expect(200);

      expect(res.body.total_processed).toBe(5);
      expect(res.body.imported_count).toBe(2);
      expect(res.body.skipped_duplicates).toBe(3);
      expect(res.body.errors).toHaveLength(0);

      const count = db.prepare('SELECT COUNT(*) as count FROM residents').get() as { count: number };
      expect(count.count).toBe(7); // 5 + 2
    });

    it('ingests row with missing required fields: assert flagged in errors and does not corrupt valid insertions', async () => {
      const recordsWithErrors = [
        // Valid record
        {
          'First Name': 'Apolinario',
          'Last Name': 'Mabini',
          'Birthdate': '1970-07-23',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        },
        // Invalid 1: missing last name
        {
          'First Name': 'NoLastName',
          'Last Name': '',
          'Birthdate': '1985-01-01',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        },
        // Invalid 2: invalid date
        {
          'First Name': 'Bad',
          'Last Name': 'Date',
          'Birthdate': 'not-a-date',
          'Sex': 'Female',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        }
      ];

      const excelBuffer = createExcelBuffer(recordsWithErrors);

      const res = await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'invalid_batch.xlsx')
        .expect(200);

      expect(res.body.total_processed).toBe(3);
      expect(res.body.imported_count).toBe(1);
      expect(res.body.errors).toHaveLength(2);

      const errorMessages = res.body.errors.map((e: any) => e.error);
      expect(errorMessages.some((msg: string) => msg.includes('last_name'))).toBe(true);
      expect(errorMessages.some((msg: string) => msg.includes('birthdate'))).toBe(true);

      // Verify Apolinario was successfully inserted
      const mabini = db.prepare('SELECT * FROM residents WHERE first_name = ?').get('Apolinario') as any;
      expect(mabini).toBeDefined();
      expect(mabini.last_name).toBe('Mabini');
    });

    it('Excel import with an impossible calendar birthdate (2023-02-31) records error in result.errors and skips insertion', async () => {
      const recordsWithImpossibleDate = [
        {
          'First Name': 'ValidResident',
          'Last Name': 'Legit',
          'Birthdate': '1985-05-15',
          'Sex': 'Female',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        },
        {
          'First Name': 'ImpossibleDate',
          'Last Name': 'Rollover',
          'Birthdate': '2023-02-31',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        }
      ];

      const excelBuffer = createExcelBuffer(recordsWithImpossibleDate);

      const res = await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'impossible_date.xlsx')
        .expect(200);

      expect(res.body.total_processed).toBe(2);
      expect(res.body.imported_count).toBe(1);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].error).toContain('Invalid birthdate: "2023-02-31"');

      // Assert impossible row was NOT inserted into database
      const row = db.prepare('SELECT * FROM residents WHERE first_name = ?').get('ImpossibleDate');
      expect(row).toBeUndefined();

      // Assert valid row was inserted
      const validRow = db.prepare('SELECT * FROM residents WHERE first_name = ?').get('ValidResident');
      expect(validRow).toBeDefined();
    });

    it('supports direct JSON array import via request body', async () => {
      const jsonRecords = [
        {
          first_name: 'Marcelo',
          last_name: 'Del Pilar',
          birthdate: '1984-08-30',
          sex: 'Male',
          civil_status: 'Married',
          purok: 'Purok 3'
        }
      ];

      const res = await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(jsonRecords)
        .expect(200);

      expect(res.body.imported_count).toBe(1);
      expect(res.body.skipped_duplicates).toBe(0);
    });
  });

  // 2. Filtered Excel Export Generation & Filtering
  describe('2. Excel Export Generation & Filtering', () => {
    beforeAll(() => {
      // Seed specific residents for export
      db.prepare('DELETE FROM residents').run();

      const insert = db.prepare(`
        INSERT INTO residents (
          first_name, last_name, birthdate, sex, civil_status, purok,
          is_voter, is_pwd, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      // Senior resident (Birthdate: 1950)
      insert.run('SeniorMan', 'Cruz', '1950-01-01', 'Male', 'Married', 'Purok 1', 1, 0);
      // Senior resident (Birthdate: 1955)
      insert.run('SeniorWoman', 'Reyes', '1955-05-05', 'Female', 'Widowed', 'Purok 1', 0, 1);
      // Non-senior resident (Birthdate: 2000)
      insert.run('YoungMan', 'Bautista', '2000-01-01', 'Male', 'Single', 'Purok 2', 1, 0);
    });

    const binaryParser = (res: any, cb: (err: Error | null, res: Buffer) => void) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    it('GET /api/residents/export-excel?sectors=senior returns 200, valid headers, and .xlsx filename', async () => {
      const res = await request(app)
        .get('/api/residents/export-excel?sectors=senior')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      expect(res.headers['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="barangay_residents_\d{4}-\d{2}-\d{2}\.xlsx"/);

      // Parse the downloaded binary buffer using xlsx.read
      const wb = xlsx.read(res.body, { type: 'buffer' });
      expect(wb.SheetNames).toContain('Barangay Residents');

      const ws = wb.Sheets['Barangay Residents'];
      const data = xlsx.utils.sheet_to_json<Record<string, any>>(ws);

      // Only the two senior residents should be present
      expect(data).toHaveLength(2);
      const lastNames = data.map((row) => row['Last Name']);
      expect(lastNames).toContain('Cruz');
      expect(lastNames).toContain('Reyes');
      expect(lastNames).not.toContain('Bautista');

      // Verify columns exist
      expect(data[0]).toHaveProperty('Age');
      expect(data[0]).toHaveProperty('Senior Citizen', 'Yes');
    });

    it('GET /api/residents/export-excel with search filter exports only matching residents', async () => {
      const res = await request(app)
        .get('/api/residents/export-excel?search=bautista')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);

      const wb = xlsx.read(res.body, { type: 'buffer' });
      const ws = wb.Sheets['Barangay Residents'];
      const data = xlsx.utils.sheet_to_json<Record<string, any>>(ws);

      expect(data).toHaveLength(1);
      expect(data[0]['Last Name']).toBe('Bautista');
      expect(data[0]['Senior Citizen']).toBe('No');
    });
  });

  // 3. Role-Based Access Control (RBAC) for Excel Endpoints
  describe('3. Role-Based Access Control (RBAC) for Excel Endpoints', () => {
    it('POST /api/residents/import-excel: 200 OK for Admin, 403 Forbidden for Clerk, Treasurer, Lupon', async () => {
      const testBuffer = createExcelBuffer([
        {
          'First Name': 'TestRBAC',
          'Last Name': 'Excel',
          'Birthdate': '1990-01-01',
          'Sex': 'Male',
          'Civil Status': 'Single',
          'Purok': 'Purok 1'
        }
      ]);

      // Clerk -> 403
      await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${clerkToken}`)
        .attach('file', testBuffer, 'test.xlsx')
        .expect(403);

      // Treasurer -> 403
      await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .attach('file', testBuffer, 'test.xlsx')
        .expect(403);

      // Lupon -> 403
      await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${luponToken}`)
        .attach('file', testBuffer, 'test.xlsx')
        .expect(403);

      // Admin -> 200
      await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', testBuffer, 'test.xlsx')
        .expect(200);
    });

    it('GET /api/residents/export-excel: 200 OK for Admin, Clerk, Treasurer, 403 Forbidden for Lupon', async () => {
      // Admin -> 200
      await request(app)
        .get('/api/residents/export-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Clerk -> 200
      await request(app)
        .get('/api/residents/export-excel')
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      // Treasurer -> 200
      await request(app)
        .get('/api/residents/export-excel')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .expect(200);

      // Lupon -> 403
      await request(app)
        .get('/api/residents/export-excel')
        .set('Authorization', `Bearer ${luponToken}`)
        .expect(403);
    });
  });

  // 4. Audit Log Trail Verification for Excel Actions
  describe('4. Audit Log Trail Verification for Excel Actions', () => {
    it('records IMPORT_EXCEL audit log on POST /api/residents/import-excel', async () => {
      const records = [
        {
          'First Name': 'AuditImport',
          'Last Name': 'Resident',
          'Birthdate': '1993-03-03',
          'Sex': 'Female',
          'Civil Status': 'Single',
          'Purok': 'Purok Audit'
        }
      ];
      const buffer = createExcelBuffer(records);

      await request(app)
        .post('/api/residents/import-excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', buffer, 'audit_import.xlsx')
        .expect(200);

      const log = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'IMPORT_EXCEL' AND entity_type = 'resident'
        ORDER BY id DESC LIMIT 1
      `).get() as any;

      expect(log).toBeDefined();
      expect(log.action).toBe('IMPORT_EXCEL');
      expect(log.username_snapshot).toBe('admin');
      expect(log.summary_text).toContain('Bulk imported residents from Excel');
    });

    it('records EXPORT_EXCEL audit log on GET /api/residents/export-excel', async () => {
      await request(app)
        .get('/api/residents/export-excel?purok=Purok+1')
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      const log = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'EXPORT_EXCEL' AND entity_type = 'resident'
        ORDER BY id DESC LIMIT 1
      `).get() as any;

      expect(log).toBeDefined();
      expect(log.action).toBe('EXPORT_EXCEL');
      expect(log.username_snapshot).toBe('xl_clerk');
      expect(log.user_role_snapshot).toBe('Clerk');
      expect(log.summary_text).toContain('Exported residents masterlist with filters');
      expect(log.summary_text).toContain('purok="Purok 1"');
    });
  });

  // 5. Excel Date Parser Format Disambiguation Unit Tests
  describe('5. Excel Date Parser Format Disambiguation Unit Tests', () => {
    it('correctly disambiguates day-first vs month-first dates and rejects impossible dates', () => {
      // Test parseDateValue("25/12/1990") returns "1990-12-25" (Day-first because 25 > 12)
      expect(parseDateValue('25/12/1990')).toBe('1990-12-25');

      // Test parseDateValue("12/25/1990") returns "1990-12-25" (Month-first because 25 > 12)
      expect(parseDateValue('12/25/1990')).toBe('1990-12-25');

      // Test parseDateValue("31/02/2023") returns null (February 31 is impossible calendar date)
      expect(parseDateValue('31/02/2023')).toBeNull();

      // Additional boundary tests
      expect(parseDateValue('2023-02-31')).toBeNull();
      expect(parseDateValue('2023-02-29')).toBeNull(); // non-leap year
      expect(parseDateValue('2024-02-29')).toBe('2024-02-29'); // leap year
    });
  });
});
