import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcryptjs from 'bcryptjs';
import { db, initDb, createDbConnection, closeDb, DEFAULT_DB_PATH } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';

describe('SQLite Database & Integrity Test Suite', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_db_runner.sqlite');

  beforeAll(() => {
    // Ensure clean state before running
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
    // Initialize the singleton db proxy targeting the isolated test runner database
    initDb(testDbFile);
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

  // Proxy Prototype Test
  describe('Proxy Prototype & Instance Test', () => {
    it('verifies db instanceof Database evaluates to true', () => {
      expect(db instanceof Database).toBe(true);
    });
  });

  // 1. Pragma Verification Test
  describe('1. Pragma Verification Test', () => {
    it('verifies that SQLite connection enables WAL mode, normal synchronous, and foreign keys', () => {
      const journalModeRow = db.prepare('PRAGMA journal_mode;').get() as { journal_mode: string };
      expect(journalModeRow.journal_mode.toLowerCase()).toBe('wal');

      const syncRow = db.prepare('PRAGMA synchronous;').get() as { synchronous: number };
      expect(syncRow.synchronous).toBe(1);

      const fkRow = db.prepare('PRAGMA foreign_keys;').get() as { foreign_keys: number };
      expect(fkRow.foreign_keys).toBe(1);

      // Also check via helper pragma method
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(db.pragma('synchronous', { simple: true })).toBe(1);
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    });

    it('verifies createDbConnection helper also initializes WAL mode and foreign keys', () => {
      const standalonePath = path.resolve(__dirname, '../../data/test_standalone_pragma.sqlite');
      try {
        const testConn = createDbConnection(standalonePath);
        expect(testConn.pragma('journal_mode', { simple: true })).toBe('wal');
        expect(testConn.pragma('synchronous', { simple: true })).toBe(1);
        expect(testConn.pragma('foreign_keys', { simple: true })).toBe(1);
        testConn.close();
      } finally {
        for (const f of [standalonePath, `${standalonePath}-wal`, `${standalonePath}-shm`]) {
          if (fs.existsSync(f)) {
            try {
              fs.unlinkSync(f);
            } catch {
              // Ignore
            }
          }
        }
      }
    });
  });

  // 2. Schema Table & Index Existence Test
  describe('2. Schema Table & Index Existence Test', () => {
    beforeAll(() => {
      initSchema(db);
    });

    it('asserts all 8 tables exist in sqlite_master', () => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);

      const expectedTables = [
        'barangay_officials',
        'users',
        'residents',
        'blotter_records',
        'certificate_templates',
        'certificate_issuances',
        'audit_logs',
        'system_settings'
      ];

      for (const table of expectedTables) {
        expect(tableNames, `Expected table ${table} to exist`).toContain(table);
      }
    });

    it('asserts all 5 specified indexes exist in sqlite_master', () => {
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      const expectedIndexes = [
        'idx_residents_name',
        'idx_residents_purok',
        'idx_residents_birthdate',
        'idx_residents_sectors',
        'idx_blotter_respondent'
      ];

      for (const idx of expectedIndexes) {
        expect(indexNames, `Expected index ${idx} to exist`).toContain(idx);
      }
    });
  });

  // 3. Foreign Key Enforcement & Constraint Test
  describe('3. Foreign Key Enforcement & Constraint Test', () => {
    beforeAll(() => {
      initSchema(db);
    });

    it('throws SQLITE_CONSTRAINT_FOREIGNKEY when inserting blotter record with non-existent respondent_id', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO blotter_records (
            case_number, complainant_name, respondent_id, respondent_name,
            incident_type, incident_details
          ) VALUES (
            'BLT-TEST-FK-001', 'Test Complainant', 999999, 'Non-existent Resident',
            'Dispute', 'Test Details'
          )
        `).run();
      }).toThrowError(/(?:SQLITE_CONSTRAINT_FOREIGNKEY|FOREIGN KEY constraint failed)/);
    });

    it('throws SQLITE_CONSTRAINT_CHECK when inserting user with invalid role', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO users (username, password_hash, full_name, role)
          VALUES ('invalid_user', 'hash123', 'Invalid User', 'SuperAdmin')
        `).run();
      }).toThrowError(/(?:SQLITE_CONSTRAINT_CHECK|CHECK constraint failed)/);
    });
  });

  // 4. Seed Content & Idempotency Test
  describe('4. Seed Content & Idempotency Test', () => {
    it('runs seed twice consecutively without errors (idempotency)', () => {
      expect(() => seed(db)).not.toThrow();
      expect(() => seed(db)).not.toThrow();
    });

    it('verifies default Admin account credentials and role', () => {
      const admin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      expect(admin).toBeDefined();
      expect(admin.username).toBe('admin');
      expect(admin.role).toBe('Admin');
      expect(admin.is_active).toBe(1);
      expect(admin.full_name).toBe('System Administrator');
      expect(bcryptjs.compareSync('admin123', admin.password_hash)).toBe(true);
    });

    it('verifies exactly 11 active barangay officials ordered by rank_order 1 to 11', () => {
      const officials = db.prepare(
        "SELECT * FROM barangay_officials WHERE is_active = 1 ORDER BY rank_order ASC"
      ).all() as any[];

      expect(officials).toHaveLength(11);

      const rankOrders = officials.map((o) => o.rank_order);
      expect(rankOrders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

      // 1 Punong Barangay
      expect(officials[0].position).toBe('Punong Barangay');
      expect(officials[0].rank_order).toBe(1);

      // 7 Sangguniang Barangay Members with realistic committees
      for (let i = 1; i <= 7; i++) {
        expect(officials[i].position).toBe('Sangguniang Barangay Member');
        expect(officials[i].rank_order).toBe(i + 1);
        expect(officials[i].committee).toBeTruthy();
      }

      // 1 SK Chairperson
      expect(officials[8].position).toBe('SK Chairperson');
      expect(officials[8].rank_order).toBe(9);

      // 1 Barangay Secretary
      expect(officials[9].position).toBe('Barangay Secretary');
      expect(officials[9].rank_order).toBe(10);

      // 1 Barangay Treasurer
      expect(officials[10].position).toBe('Barangay Treasurer');
      expect(officials[10].rank_order).toBe(11);
    });

    it('verifies the 4 required certificate templates exist with valid HTML and {{placeholders}}', () => {
      const templates = db.prepare(
        "SELECT * FROM certificate_templates WHERE is_active = 1"
      ).all() as any[];

      expect(templates).toHaveLength(4);
      const templateMap = new Map(templates.map((t) => [t.template_code, t]));

      // 1. Barangay Clearance
      const clearance = templateMap.get('BRGY_CLEARANCE');
      expect(clearance).toBeDefined();
      expect(clearance.template_name).toBe('Barangay Clearance');
      expect(clearance.show_officials_sidebar).toBe(1);
      expect(clearance.default_fee).toBe(50.00);
      expect(clearance.requires_blotter_check).toBe(1);
      expect(clearance.body_html).toContain('{{full_name}}');
      expect(clearance.body_html).toContain('{{purpose}}');
      expect(clearance.body_html).toContain('{{day_ordinal}}');
      expect(clearance.body_html).toContain('{{month_year}}');

      // 2. Certificate of Indigency
      const indigency = templateMap.get('INDIGENCY');
      expect(indigency).toBeDefined();
      expect(indigency.template_name).toBe('Certificate of Indigency');
      expect(indigency.show_officials_sidebar).toBe(1);
      expect(indigency.default_fee).toBe(0.00);
      expect(indigency.requires_blotter_check).toBe(0);
      expect(indigency.body_html).toContain('{{full_name}}');

      // 3. Certificate of Residency
      const residency = templateMap.get('RESIDENCY');
      expect(residency).toBeDefined();
      expect(residency.template_name).toBe('Certificate of Residency');
      expect(residency.show_officials_sidebar).toBe(1);
      expect(residency.default_fee).toBe(50.00);
      expect(residency.requires_blotter_check).toBe(0);
      expect(residency.body_html).toContain('{{full_name}}');

      // 4. First-Time Jobseeker Certification
      const jobseeker = templateMap.get('JOBSEEKER');
      expect(jobseeker).toBeDefined();
      expect(jobseeker.template_name).toBe('First-Time Jobseeker Certification');
      expect(jobseeker.show_officials_sidebar).toBe(1);
      expect(jobseeker.default_fee).toBe(0.00);
      expect(jobseeker.requires_blotter_check).toBe(1);
      expect(jobseeker.body_html).toContain('{{full_name}}');
    });

    it('verifies at least 10 active residents with valid birthdates and sectors', () => {
      const residents = db.prepare(
        "SELECT * FROM residents WHERE is_archived = 0"
      ).all() as any[];

      expect(residents.length).toBeGreaterThanOrEqual(10);

      // Verify birthdate format (YYYY-MM-DD)
      for (const r of residents) {
        expect(r.birthdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }

      // Check seniors (at least 2 seniors with birthdate <= 60 years ago)
      const seniors = residents.filter((r) => {
        const diffMs = Date.now() - new Date(r.birthdate).getTime();
        const ageYears = diffMs / (365.25 * 24 * 3600 * 1000);
        return ageYears >= 60;
      });
      expect(seniors.length).toBeGreaterThanOrEqual(2);

      // Check minor (< 18 years ago)
      const minors = residents.filter((r) => {
        const diffMs = Date.now() - new Date(r.birthdate).getTime();
        const ageYears = diffMs / (365.25 * 24 * 3600 * 1000);
        return ageYears < 18;
      });
      expect(minors.length).toBeGreaterThanOrEqual(1);

      // Check sector coverage
      expect(residents.some((r) => r.is_pwd === 1)).toBe(true);
      expect(residents.some((r) => r.is_4ps === 1)).toBe(true);
      expect(residents.some((r) => r.is_solo_parent === 1)).toBe(true);
      expect(residents.some((r) => r.is_indigent === 1)).toBe(true);
      expect(residents.some((r) => r.is_voter === 1)).toBe(true);

      // Check multiple Puroks
      const puroks = new Set(residents.map((r) => r.purok));
      expect(puroks.size).toBeGreaterThanOrEqual(3);
    });

    it('verifies at least 1 active blotter record linked to a resident respondent', () => {
      const blotterRecords = db.prepare(
        "SELECT * FROM blotter_records WHERE status = 'Active'"
      ).all() as any[];

      expect(blotterRecords.length).toBeGreaterThanOrEqual(1);
      const record = blotterRecords[0];

      expect(record.case_number).toMatch(/^BLT-\d{4}-\d{3}$/);
      expect(record.respondent_id).toBeTruthy();

      const resident = db.prepare("SELECT * FROM residents WHERE id = ?").get(record.respondent_id) as any;
      expect(resident).toBeDefined();
      expect(resident.id).toBe(record.respondent_id);
    });

    it('verifies default barangay metadata exists in system_settings', () => {
      const settings = db.prepare("SELECT * FROM system_settings").all() as { key: string; value: string }[];
      const settingMap = new Map(settings.map((s) => [s.key, s.value]));

      expect(settingMap.get('barangay_name')).toBe('Barangay San Jose');
      expect(settingMap.get('municipality_name')).toBe('Antipolo City');
      expect(settingMap.get('province_name')).toBe('Rizal');
      expect(settingMap.get('region_name')).toBe('Region IV-A (CALABARZON)');
      expect(settingMap.get('contact_email')).toBe('sanjose.antipolo@example.gov.ph');
    });
  });
});
