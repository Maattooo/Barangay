import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import * as auditService from '../src/services/audit.service';

describe('Resident RBI Management & Demographics Test Suite (residents.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_residents_suite.sqlite');

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
        ('res_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('res_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('res_lupon', ?, 'Lupon Member', 'Lupon', 1)
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
      .send({ username: 'res_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'res_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'res_lupon', password: 'matrix_pass_123' });
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

  // Helper to format date relative to today
  function getRelativeBirthdate(yearsAgo: number, daysOffset = 0): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - yearsAgo);
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 1. Dynamic Age & Sector SQL Derivation
  describe('1. Dynamic Age & Sector SQL Derivation', () => {
    it('seeds residents with relative birthdates and verifies age calculation and sector boolean flags', async () => {
      // Clear residents table for clean derivation verification
      db.prepare('DELETE FROM residents').run();

      const bday65 = getRelativeBirthdate(65);
      const bday60 = getRelativeBirthdate(60);
      const bday25 = getRelativeBirthdate(25);
      const bday17 = getRelativeBirthdate(17);

      const insert = db.prepare(`
        INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok, is_archived)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `);

      insert.run('Senior', 'Elderly', bday65, 'Male', 'Married', 'Purok 1');
      insert.run('Turning', 'Sixty', bday60, 'Female', 'Widowed', 'Purok 1');
      insert.run('Young', 'Adult', bday25, 'Male', 'Single', 'Purok 2');
      insert.run('Teen', 'Minor', bday17, 'Female', 'Single', 'Purok 2');

      const res = await request(app)
        .get('/api/residents?limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const items = res.body.data;
      expect(items.length).toBe(4);

      const seniorElderly = items.find((r: any) => r.first_name === 'Senior');
      const turningSixty = items.find((r: any) => r.first_name === 'Turning');
      const youngAdult = items.find((r: any) => r.first_name === 'Young');
      const teenMinor = items.find((r: any) => r.first_name === 'Teen');

      // Assert age matches SQLite Julian day calculation
      expect(seniorElderly.age).toBe(65);
      expect(seniorElderly.is_senior).toBe(true);
      expect(seniorElderly.is_youth).toBe(false);
      expect(seniorElderly.is_minor).toBe(false);

      expect(turningSixty.age).toBe(60);
      expect(turningSixty.is_senior).toBe(true);
      expect(turningSixty.is_youth).toBe(false);
      expect(turningSixty.is_minor).toBe(false);

      expect(youngAdult.age).toBe(25);
      expect(youngAdult.is_senior).toBe(false);
      expect(youngAdult.is_youth).toBe(true);
      expect(youngAdult.is_minor).toBe(false);

      expect(teenMinor.age).toBe(17);
      expect(teenMinor.is_senior).toBe(false);
      expect(teenMinor.is_youth).toBe(true); // 17 is between 15 and 30
      expect(teenMinor.is_minor).toBe(true);  // 17 < 18
    });
  });

  // 2. Combinatorial Sector Filtering (GET /api/residents)
  describe('2. Combinatorial Sector Filtering (GET /api/residents)', () => {
    beforeAll(() => {
      // Clear and seed specific combinatorial residents
      db.prepare('DELETE FROM residents').run();

      const bdaySenior = getRelativeBirthdate(68);
      const bdayYouth = getRelativeBirthdate(22);
      const bdayAdult = getRelativeBirthdate(35);

      const insert = db.prepare(`
        INSERT INTO residents (
          first_name, last_name, birthdate, sex, civil_status, purok,
          is_pwd, is_solo_parent, is_4ps, is_voter, is_osy, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      // Resident 1: Senior Citizen + PWD
      insert.run('Resident1', 'SeniorPWD', bdaySenior, 'Male', 'Married', 'Purok 1', 1, 0, 0, 0, 0);

      // Resident 2: Senior Citizen only
      insert.run('Resident2', 'SeniorOnly', bdaySenior, 'Female', 'Widowed', 'Purok 1', 0, 0, 0, 0, 0);

      // Resident 3: Solo Parent + 4Ps + Registered Voter
      insert.run('Resident3', 'Solo4PsVoter', bdayAdult, 'Female', 'Single', 'Purok 2', 0, 1, 1, 1, 0);

      // Resident 4: Youth + Out-of-School Youth (OSY)
      insert.run('Resident4', 'YouthOSY', bdayYouth, 'Male', 'Single', 'Purok 3', 0, 0, 0, 0, 1);
    });

    it('Query ?sectors=senior,pwd: Assert ONLY Resident 1 is returned (strict AND logic)', async () => {
      const res = await request(app)
        .get('/api/residents?sectors=senior,pwd')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].first_name).toBe('Resident1');
    });

    it('Query ?sectors=senior: Assert both Resident 1 and Resident 2 are returned', async () => {
      const res = await request(app)
        .get('/api/residents?sectors=senior')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      const names = res.body.data.map((r: any) => r.first_name);
      expect(names).toContain('Resident1');
      expect(names).toContain('Resident2');
    });

    it('Query ?sectors=solo_parent,4ps,voter: Assert ONLY Resident 3 is returned', async () => {
      const res = await request(app)
        .get('/api/residents?sectors=solo_parent,4ps,voter')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].first_name).toBe('Resident3');
    });

    it('Query non-existent combination ?sectors=senior,osy: Assert empty result set returned', async () => {
      const res = await request(app)
        .get('/api/residents?sectors=senior,osy')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(0);
      expect(res.body.pagination.total).toBe(0);
    });
  });

  // 3. Multi-field Search & Demographic Filters
  describe('3. Multi-field Search & Demographic Filters', () => {
    it('Query ?search=<partial_first_or_last_name>: Assert matching residents are returned', async () => {
      const res = await request(app)
        .get('/api/residents?search=solo4ps')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].last_name).toBe('Solo4PsVoter');
    });

    it('Query ?purok=<purok_name>: Assert only residents within specified purok are returned', async () => {
      const res = await request(app)
        .get('/api/residents?purok=Purok+1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      res.body.data.forEach((r: any) => {
        expect(r.purok).toBe('Purok 1');
      });
    });

    it('Query ?sex=Female&civil_status=Widowed: Assert proper filtering on enum columns', async () => {
      const res = await request(app)
        .get('/api/residents?sex=Female&civil_status=Widowed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].first_name).toBe('Resident2');
    });

    it('Pagination verification: Query with page=1&limit=2 returns exactly 2 records and accurate metadata', async () => {
      const res = await request(app)
        .get('/api/residents?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toEqual({
        total: 4,
        page: 1,
        limit: 2,
        totalPages: 2
      });
    });
  });

  // 4. Soft-Delete / Archive Protection
  describe('4. Soft-Delete / Archive Protection', () => {
    let targetResidentId: number;

    beforeAll(async () => {
      // Create a dedicated resident to test archiving
      const createRes = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Archive',
          last_name: 'Candidate',
          birthdate: '1990-01-01',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok Archive'
        })
        .expect(201);

      targetResidentId = createRes.body.id;
    });

    it('verifies newly created resident appears in active list', async () => {
      const res = await request(app)
        .get(`/api/residents?search=Candidate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.some((r: any) => r.id === targetResidentId)).toBe(true);
    });

    it('PATCH /api/residents/:id/archive updates is_archived = 1 in SQLite and returns 200', async () => {
      const res = await request(app)
        .patch(`/api/residents/${targetResidentId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.message).toBe('Resident archived successfully');

      const row = db.prepare('SELECT is_archived FROM residents WHERE id = ?').get(targetResidentId) as any;
      expect(row.is_archived).toBe(1);
    });

    it('GET /api/residents omits archived resident by default', async () => {
      const res = await request(app)
        .get(`/api/residents?search=Candidate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.some((r: any) => r.id === targetResidentId)).toBe(false);
    });

    it('GET /api/residents?include_archived=true includes archived resident', async () => {
      const res = await request(app)
        .get(`/api/residents?search=Candidate&include_archived=true`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.some((r: any) => r.id === targetResidentId)).toBe(true);
    });
  });

  // 5. Dashboard Statistics (GET /api/residents/stats)
  describe('5. Dashboard Statistics (GET /api/residents/stats)', () => {
    beforeAll(() => {
      // Clear and seed predictable numbers
      db.prepare('DELETE FROM blotter_records').run();
      db.prepare('DELETE FROM residents').run();

      const bdaySenior = getRelativeBirthdate(65);
      const bdayYouth = getRelativeBirthdate(20);
      const bdayMinor = getRelativeBirthdate(10);
      const bdayAdult = getRelativeBirthdate(40);

      const insResident = db.prepare(`
        INSERT INTO residents (
          first_name, last_name, birthdate, sex, civil_status, purok,
          is_pwd, is_4ps, is_indigent, is_voter, is_solo_parent, is_ofw, is_osy, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // 1: Senior, PWD, Voter, Purok 1, Active
      insResident.run('R1', 'One', bdaySenior, 'Male', 'Married', 'Purok 1', 1, 0, 0, 1, 0, 0, 0, 0);
      // 2: Youth, 4Ps, Indigent, Purok 1, Active
      insResident.run('R2', 'Two', bdayYouth, 'Female', 'Single', 'Purok 1', 0, 1, 1, 0, 0, 0, 0, 0);
      // 3: Minor, OSY, Purok 2, Active
      insResident.run('R3', 'Three', bdayMinor, 'Male', 'Single', 'Purok 2', 0, 0, 0, 0, 0, 0, 1, 0);
      // 4: Adult, Solo Parent, OFW, Purok 2, Active
      insResident.run('R4', 'Four', bdayAdult, 'Female', 'Separated', 'Purok 2', 0, 0, 0, 0, 1, 1, 0, 0);
      // 5: Senior, Archived (Should NOT be counted in active stats)
      insResident.run('R5', 'Archived', bdaySenior, 'Male', 'Widowed', 'Purok 1', 0, 0, 0, 0, 0, 0, 0, 1);

      // Seed blotters
      const insBlotter = db.prepare(`
        INSERT INTO blotter_records (case_number, complainant_name, respondent_name, incident_type, incident_details, status, is_archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      // Active blotter (counts)
      insBlotter.run('BLT-2026-001', 'Juan', 'Pedro', 'Boundary Dispute', 'Details', 'Active', 0);
      // Under Mediation (counts)
      insBlotter.run('BLT-2026-002', 'Maria', 'Clara', 'Noise', 'Details', 'Under Mediation', 0);
      // CFA Issued (counts)
      insBlotter.run('BLT-2026-003', 'Jose', 'Rizal', 'Threat', 'Details', 'CFA Issued', 0);
      // Settled (does not count)
      insBlotter.run('BLT-2026-004', 'Andres', 'Bonifacio', 'Debt', 'Details', 'Settled', 0);
      // Dismissed (does not count)
      insBlotter.run('BLT-2026-005', 'Emilio', 'Aguinaldo', 'Quarrel', 'Details', 'Dismissed', 0);
      // Active but archived (does not count)
      insBlotter.run('BLT-2026-006', 'Apolinario', 'Mabini', 'Libel', 'Details', 'Active', 1);
    });

    it('returns exact demographic counts and active blotters', async () => {
      const res = await request(app)
        .get('/api/residents/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual({
        total_residents: 4,
        purok_counts: {
          'Purok 1': 2,
          'Purok 2': 2
        },
        seniors: 1,
        pwds: 1,
        four_ps: 1,
        indigents: 1,
        voters: 1,
        solo_parents: 1,
        ofw: 1,
        osy: 1,
        youth: 1,
        minors: 1,
        active_blotters: 3
      });
    });
  });

  // 6. Role-Based Access Control (RBAC)
  describe('6. Role-Based Access Control (RBAC)', () => {
    let testResidentId: number;

    beforeAll(async () => {
      const created = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'RBAC',
          last_name: 'Resident',
          birthdate: '1985-05-15',
          sex: 'Male',
          civil_status: 'Married',
          purok: 'Purok RBAC'
        });
      testResidentId = created.body.id;
    });

    it('GET /api/residents & GET /api/residents/stats allows Admin, Clerk, Treasurer, Lupon (200 OK)', async () => {
      for (const token of [adminToken, clerkToken, treasurerToken, luponToken]) {
        await request(app)
          .get('/api/residents')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        await request(app)
          .get('/api/residents/stats')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });

    it('POST /api/residents allows Admin & Clerk (201), forbids Treasurer & Lupon (403)', async () => {
      // Admin -> 201
      await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Allowed',
          last_name: 'AdminCreated',
          birthdate: '1992-02-02',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(201);

      // Clerk -> 201
      await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          first_name: 'Allowed',
          last_name: 'ClerkCreated',
          birthdate: '1992-02-02',
          sex: 'Female',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(201);

      // Treasurer -> 403
      await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({
          first_name: 'Denied',
          last_name: 'Treasurer',
          birthdate: '1992-02-02',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(403);

      // Lupon -> 403
      await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          first_name: 'Denied',
          last_name: 'Lupon',
          birthdate: '1992-02-02',
          sex: 'Female',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(403);
    });

    it('PUT /api/residents/:id allows Admin & Clerk (200), forbids Treasurer & Lupon (403)', async () => {
      // Clerk updates -> 200
      await request(app)
        .put(`/api/residents/${testResidentId}`)
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({ occupation: 'Technician' })
        .expect(200);

      // Admin updates -> 200
      await request(app)
        .put(`/api/residents/${testResidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ occupation: 'Engineer' })
        .expect(200);

      // Treasurer -> 403
      await request(app)
        .put(`/api/residents/${testResidentId}`)
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({ occupation: 'Hacker' })
        .expect(403);

      // Lupon -> 403
      await request(app)
        .put(`/api/residents/${testResidentId}`)
        .set('Authorization', `Bearer ${luponToken}`)
        .send({ occupation: 'Hacker' })
        .expect(403);
    });

    it('PATCH /api/residents/:id/archive allows Admin strictly (200), forbids Clerk, Treasurer, Lupon (403)', async () => {
      // Clerk -> 403
      await request(app)
        .patch(`/api/residents/${testResidentId}/archive`)
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(403);

      // Treasurer -> 403
      await request(app)
        .patch(`/api/residents/${testResidentId}/archive`)
        .set('Authorization', `Bearer ${treasurerToken}`)
        .expect(403);

      // Lupon -> 403
      await request(app)
        .patch(`/api/residents/${testResidentId}/archive`)
        .set('Authorization', `Bearer ${luponToken}`)
        .expect(403);

      // Admin -> 200
      await request(app)
        .patch(`/api/residents/${testResidentId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // 7. Audit Log Trail Verification
  describe('7. Audit Log Trail Verification', () => {
    let createdId: number;

    it('generates CREATE audit log on POST /api/residents', async () => {
      const res = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Audited',
          last_name: 'Person',
          birthdate: '1988-08-08',
          sex: 'Male',
          civil_status: 'Married',
          purok: 'Purok Audit'
        })
        .expect(201);

      createdId = res.body.id;

      const log = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'resident' AND entity_id = ? AND action = 'CREATE'
        ORDER BY id DESC LIMIT 1
      `).get(createdId) as any;

      expect(log).toBeDefined();
      expect(log.action).toBe('CREATE');
      expect(log.username_snapshot).toBe('admin');
      expect(log.user_role_snapshot).toBe('Admin');
      expect(log.summary_text).toContain('Created resident Audited Person');
      expect(log.new_data_json).toBeDefined();

      const parsedNew = JSON.parse(log.new_data_json);
      expect(parsedNew.first_name).toBe('Audited');
      expect(parsedNew.last_name).toBe('Person');
    });

    it('generates UPDATE audit log with diff JSON containing only modified keys on PUT /api/residents/:id', async () => {
      await request(app)
        .put(`/api/residents/${createdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          occupation: 'Lawyer',
          contact_no: '09123456789'
        })
        .expect(200);

      const log = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'resident' AND entity_id = ? AND action = 'UPDATE'
        ORDER BY id DESC LIMIT 1
      `).get(createdId) as any;

      expect(log).toBeDefined();
      expect(log.action).toBe('UPDATE');
      expect(log.summary_text).toContain('Updated resident Audited Person');

      const oldDiff = JSON.parse(log.old_data_json);
      const newDiff = JSON.parse(log.new_data_json);

      expect(newDiff).toHaveProperty('occupation', 'Lawyer');
      expect(newDiff).toHaveProperty('contact_no', '09123456789');

      // Unchanged fields like first_name, last_name, birthdate must not be in diff
      expect(newDiff.first_name).toBeUndefined();
      expect(newDiff.last_name).toBeUndefined();
      expect(oldDiff.first_name).toBeUndefined();
    });

    it('generates ARCHIVE audit log on PATCH /api/residents/:id/archive', async () => {
      await request(app)
        .patch(`/api/residents/${createdId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const log = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'resident' AND entity_id = ? AND action = 'ARCHIVE'
        ORDER BY id DESC LIMIT 1
      `).get(createdId) as any;

      expect(log).toBeDefined();
      expect(log.action).toBe('ARCHIVE');
      expect(log.summary_text).toContain('Archived resident Audited Person');

      const oldData = JSON.parse(log.old_data_json);
      const newData = JSON.parse(log.new_data_json);
      expect(oldData.is_archived).toBe(0);
      expect(newData.is_archived).toBe(1);
    });
  });

  // 8. Transaction Atomicity, Date Validation & No-Op Update Suppression Tests
  describe('8. Transaction Atomicity, Strict Date Validation & No-Op Audit Suppression', () => {
    it('rolls back resident insertion if audit log fails (ensures zero orphaned rows)', async () => {
      const spy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic power brownout during audit log');
      });

      const res = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Rollback',
          last_name: 'Candidate',
          birthdate: '1991-01-01',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok Atomicity'
        })
        .expect(500);

      expect(res.body.error).toContain('Internal server error');

      // Assert that no row was persisted in residents
      const row = db.prepare('SELECT * FROM residents WHERE first_name = ?').get('Rollback');
      expect(row).toBeUndefined();

      spy.mockRestore();
    });

    it('rejects impossible calendar date birthdate: "2023-02-31" with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Invalid',
          last_name: 'Date31',
          birthdate: '2023-02-31',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(400);

      expect(res.body.error).toBe(
        'Invalid birthdate. Must be a valid calendar date in YYYY-MM-DD format and cannot be in the future'
      );
    });

    it('rejects non-leap year birthdate: "2023-02-29" with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Invalid',
          last_name: 'Date29',
          birthdate: '2023-02-29',
          sex: 'Female',
          civil_status: 'Single',
          purok: 'Purok 1'
        })
        .expect(400);

      expect(res.body.error).toBe(
        'Invalid birthdate. Must be a valid calendar date in YYYY-MM-DD format and cannot be in the future'
      );
    });

    it('suppresses audit log creation on no-op resident update (empty body or identical data)', async () => {
      // First create a resident to update
      const createRes = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'NoOp',
          last_name: 'Tester',
          birthdate: '1995-05-05',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1',
          occupation: 'Driver'
        })
        .expect(201);

      const targetId = createRes.body.id;

      // Count audit logs before
      const countBefore = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE entity_type = 'resident' AND entity_id = ?").get(targetId) as any).count;

      // 1. Send update with empty body
      const resEmpty = await request(app)
        .put(`/api/residents/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(resEmpty.body.first_name).toBe('NoOp');

      // 2. Send update with identical values
      const resIdentical = await request(app)
        .put(`/api/residents/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ occupation: 'Driver' })
        .expect(200);

      expect(resIdentical.body.occupation).toBe('Driver');

      // Count audit logs after
      const countAfter = (db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE entity_type = 'resident' AND entity_id = ?").get(targetId) as any).count;

      expect(countAfter).toBe(countBefore);
    });
  });
});
