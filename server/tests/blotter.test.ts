import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import {
  generateCaseNumber,
  checkResidentBlotter,
  validateBlotterOverride
} from '../src/services/blotter.service';
import * as auditService from '../src/services/audit.service';

describe('Blotter Case Management & Automated Gatekeeper Engine Test Suite (blotter.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_blotter_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;

  let residentAliceId: number;
  let residentBobId: number;
  let residentCharlieId: number;

  beforeAll(async () => {
    // Clean up stale test database
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

    // Create staff users for all 4 roles
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('blotter_clerk', ?, 'Clerk Officer', 'Clerk', 1),
        ('blotter_treasurer', ?, 'Treasurer Officer', 'Treasurer', 1),
        ('blotter_lupon', ?, 'Lupon Officer', 'Lupon', 1)
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
      .send({ username: 'blotter_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'blotter_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'blotter_lupon', password: 'matrix_pass_123' });
    luponToken = luponLogin.body.token;

    // Seed test residents
    const insertResident = db.prepare(`
      INSERT INTO residents (
        first_name, last_name, birthdate, sex, civil_status, purok, is_archived
      ) VALUES (?, ?, '1990-01-01', 'Male', 'Single', 'Purok 1', 0)
    `);

    residentAliceId = Number(insertResident.run('Alice', 'Guilford').lastInsertRowid);
    residentBobId = Number(insertResident.run('Bob', 'Marley').lastInsertRowid);
    residentCharlieId = Number(insertResident.run('Charlie', 'Chaplin').lastInsertRowid);
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

  // --------------------------------------------------------------------------
  // 1. Sequential Case Number Generation Tests
  // --------------------------------------------------------------------------
  describe('1. Sequential Case Number Generation (generateCaseNumber)', () => {
    beforeAll(() => {
      db.prepare('DELETE FROM blotter_records').run();
    });

    it('returns BLT-2026-001 for an empty database/year', () => {
      const caseNo = generateCaseNumber(2026);
      expect(caseNo).toBe('BLT-2026-001');
    });

    it('increments sequence sequentially (BLT-2026-002, BLT-2026-003, etc.)', () => {
      db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_name, incident_type, incident_details, status
        ) VALUES 
          ('BLT-2026-001', 'Complainant 1', 'Respondent 1', 'Noise', 'Details', 'Active'),
          ('BLT-2026-002', 'Complainant 2', 'Respondent 2', 'Boundary', 'Details', 'Active')
      `).run();

      const nextCaseNo = generateCaseNumber(2026);
      expect(nextCaseNo).toBe('BLT-2026-003');
    });

    it('resets counter to 001 when calendar year rolls over (e.g. 2027)', () => {
      const year2027CaseNo = generateCaseNumber(2027);
      expect(year2027CaseNo).toBe('BLT-2027-001');
    });

    it('counts soft-deleted (archived) records to ensure monotonicity and prevent number reuse', () => {
      db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_name, incident_type, incident_details, status, is_archived
        ) VALUES ('BLT-2026-003', 'Complainant 3', 'Respondent 3', 'Threat', 'Details', 'Active', 1)
      `).run();

      const nextCaseNo = generateCaseNumber(2026);
      expect(nextCaseNo).toBe('BLT-2026-004');
    });

    it('formats counts exceeding 999 without truncation (e.g., BLT-2026-1000)', () => {
      db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_name, incident_type, incident_details, status
        ) VALUES ('BLT-2026-999', 'Complainant 999', 'Respondent 999', 'Test', 'Details', 'Active')
      `).run();

      const nextCaseNo = generateCaseNumber(2026);
      expect(nextCaseNo).toBe('BLT-2026-1000');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Automated Gatekeeper Query Accuracy Tests
  // --------------------------------------------------------------------------
  describe('2. Automated Gatekeeper Query Accuracy (checkResidentBlotter & Endpoint)', () => {
    let cleanResidentId: number;
    let activeRespondentId: number;
    let mediationRespondentId: number;
    let cfaRespondentId: number;
    let settledRespondentId: number;
    let dismissedRespondentId: number;
    let archivedRespondentId: number;
    let complainantOnlyId: number;

    beforeAll(() => {
      const insert = db.prepare(`
        INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok)
        VALUES (?, 'Test', '1995-05-05', 'Female', 'Single', 'Purok 2')
      `);

      cleanResidentId = Number(insert.run('CleanResident').lastInsertRowid);
      activeRespondentId = Number(insert.run('ActiveResident').lastInsertRowid);
      mediationRespondentId = Number(insert.run('MediationResident').lastInsertRowid);
      cfaRespondentId = Number(insert.run('CfaResident').lastInsertRowid);
      settledRespondentId = Number(insert.run('SettledResident').lastInsertRowid);
      dismissedRespondentId = Number(insert.run('DismissedResident').lastInsertRowid);
      archivedRespondentId = Number(insert.run('ArchivedResident').lastInsertRowid);
      complainantOnlyId = Number(insert.run('ComplainantOnly').lastInsertRowid);

      const insertBlotter = db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_id, complainant_name, respondent_id, respondent_name, incident_type, status, incident_details, is_archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Details', ?)
      `);

      // Active
      insertBlotter.run('BLT-2026-1001', cleanResidentId, 'Clean', activeRespondentId, 'ActiveResident', 'Physical Injury', 'Active', 0);
      // Under Mediation
      insertBlotter.run('BLT-2026-1002', cleanResidentId, 'Clean', mediationRespondentId, 'MediationResident', 'Property Dispute', 'Under Mediation', 0);
      // CFA Issued
      insertBlotter.run('BLT-2026-1003', cleanResidentId, 'Clean', cfaRespondentId, 'CfaResident', 'Grave Threat', 'CFA Issued', 0);
      // Settled
      insertBlotter.run('BLT-2026-1004', cleanResidentId, 'Clean', settledRespondentId, 'SettledResident', 'Noise Complaint', 'Settled', 0);
      // Dismissed
      insertBlotter.run('BLT-2026-1005', cleanResidentId, 'Clean', dismissedRespondentId, 'DismissedResident', 'Unjust Vexation', 'Dismissed', 0);
      // Active but soft-deleted (archived)
      insertBlotter.run('BLT-2026-1006', cleanResidentId, 'Clean', archivedRespondentId, 'ArchivedResident', 'Theft', 'Active', 1);
      // Resident is complainant only, not respondent
      insertBlotter.run('BLT-2026-1007', complainantOnlyId, 'ComplainantOnly', residentBobId, 'Bob Marley', 'Harassment', 'Active', 0);
    });

    it('returns cleared: true and empty cases for clean resident with 0 blotter cases', async () => {
      const res = checkResidentBlotter(cleanResidentId);
      expect(res.cleared).toBe(true);
      expect(res.cases).toEqual([]);

      const apiRes = await request(app)
        .get(`/api/residents/${cleanResidentId}/blotter-check`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(apiRes.status).toBe(200);
      expect(apiRes.body.cleared).toBe(true);
      expect(apiRes.body.cases).toEqual([]);
    });

    it('returns cleared: false for resident with Active blotter case', async () => {
      const res = checkResidentBlotter(activeRespondentId);
      expect(res.cleared).toBe(false);
      expect(res.cases.length).toBe(1);
      expect(res.cases[0].case_number).toBe('BLT-2026-1001');
      expect(res.cases[0].status).toBe('Active');

      const apiRes = await request(app)
        .get(`/api/residents/${activeRespondentId}/blotter-check`)
        .set('Authorization', `Bearer ${clerkToken}`);
      expect(apiRes.status).toBe(200);
      expect(apiRes.body.cleared).toBe(false);
      expect(apiRes.body.cases.length).toBe(1);
    });

    it('returns cleared: false for resident with Under Mediation blotter case', async () => {
      const res = checkResidentBlotter(mediationRespondentId);
      expect(res.cleared).toBe(false);
      expect(res.cases.length).toBe(1);
      expect(res.cases[0].case_number).toBe('BLT-2026-1002');
      expect(res.cases[0].status).toBe('Under Mediation');
    });

    it('returns cleared: false for resident with CFA Issued blotter case', async () => {
      const res = checkResidentBlotter(cfaRespondentId);
      expect(res.cleared).toBe(false);
      expect(res.cases.length).toBe(1);
      expect(res.cases[0].case_number).toBe('BLT-2026-1003');
      expect(res.cases[0].status).toBe('CFA Issued');
    });

    it('returns cleared: true for resident with Settled blotter case (Settled must not block)', async () => {
      const res = checkResidentBlotter(settledRespondentId);
      expect(res.cleared).toBe(true);
      expect(res.cases).toEqual([]);
    });

    it('returns cleared: true for resident with Dismissed blotter case (Dismissed must not block)', async () => {
      const res = checkResidentBlotter(dismissedRespondentId);
      expect(res.cleared).toBe(true);
      expect(res.cases).toEqual([]);
    });

    it('returns cleared: true for resident with active case that is soft-deleted (is_archived = 1)', async () => {
      const res = checkResidentBlotter(archivedRespondentId);
      expect(res.cleared).toBe(true);
      expect(res.cases).toEqual([]);
    });

    it('returns cleared: true for resident who is complainant_id but NOT respondent_id', async () => {
      const res = checkResidentBlotter(complainantOnlyId);
      expect(res.cleared).toBe(true);
      expect(res.cases).toEqual([]);
    });

    it('returns 404 Not Found for non-existent resident ID', async () => {
      const apiRes = await request(app)
        .get('/api/residents/999999/blotter-check')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(apiRes.status).toBe(404);
      expect(apiRes.body.error).toMatch(/resident not found/i);
    });

    it('returns 400 Bad Request for non-numeric or invalid resident ID', async () => {
      const apiRes = await request(app)
        .get('/api/residents/invalid-id/blotter-check')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(apiRes.status).toBe(400);
      expect(apiRes.body.error).toMatch(/invalid resident id/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Override Reason Validation Engine Tests
  // --------------------------------------------------------------------------
  describe('3. Override Reason Validation Engine (validateBlotterOverride)', () => {
    it('returns valid: true for active blotter with justification >= 10 characters', () => {
      const res = validateBlotterOverride(true, 'Approved by Captain for medical emergency');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('returns valid: false with descriptive error for active blotter with reason < 10 characters', () => {
      const res = validateBlotterOverride(true, 'Medical');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Blotter override reason must be at least 10 characters long');
    });

    it('returns valid: false for active blotter with whitespace-only reason', () => {
      const res = validateBlotterOverride(true, '          ');
      expect(res.valid).toBe(false);
      expect(res.error).toBe('Blotter override reason must be at least 10 characters long');
    });

    it('returns valid: false for active blotter with undefined or empty reason', () => {
      const res1 = validateBlotterOverride(true, undefined);
      expect(res1.valid).toBe(false);
      expect(res1.error).toBe('Blotter override reason must be at least 10 characters long');

      const res2 = validateBlotterOverride(true, '');
      expect(res2.valid).toBe(false);
      expect(res2.error).toBe('Blotter override reason must be at least 10 characters long');
    });

    it('returns valid: true for cleared resident (hadActiveBlotter = false) regardless of reason', () => {
      const res1 = validateBlotterOverride(false);
      expect(res1.valid).toBe(true);

      const res2 = validateBlotterOverride(false, '');
      expect(res2.valid).toBe(true);

      const res3 = validateBlotterOverride(false, 'Any notes');
      expect(res3.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Blotter Creation & Validation (POST /api/blotter) Tests
  // --------------------------------------------------------------------------
  describe('4. Blotter Creation & Validation (POST /api/blotter)', () => {
    it('creates a new valid blotter case as Admin with auto-generated case number and audit log', async () => {
      const payload = {
        complainant_name: 'Dalisay Cruz',
        respondent_name: 'Cardo Dalisay',
        incident_type: 'Physical Injury',
        incident_details: 'Altercation along Purok 1 main road during basketball match',
        incident_location: 'Purok 1 Covered Court',
        complainant_id: residentAliceId,
        respondent_id: residentBobId
      };

      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.case_number).toMatch(/^BLT-\d{4}-\d{3,}$/);
      expect(res.body.status).toBe('Active');
      expect(res.body.complainant_id).toBe(residentAliceId);
      expect(res.body.respondent_id).toBe(residentBobId);
      expect(res.body.is_archived).toBe(0);

      // Verify audit log entry
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'blotter' AND entity_id = ? AND action = 'CREATE'
        ORDER BY id DESC LIMIT 1
      `).get(res.body.id) as any;

      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.username_snapshot).toBe('admin');
      expect(auditLog.user_role_snapshot).toBe('Admin');
      expect(auditLog.summary_text).toContain(res.body.case_number);
      expect(auditLog.new_data_json).toContain('Physical Injury');
    });

    it('creates a valid blotter case as Lupon role', async () => {
      const payload = {
        complainant_name: 'Maria Clara',
        respondent_name: 'Crisostomo Ibarra',
        incident_type: 'Unjust Vexation',
        incident_details: 'Disturbance during midnight mass rehearsal'
      };

      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${luponToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.case_number).toBeDefined();
      expect(res.body.status).toBe('Active');
    });

    it('rejects case creation with 400 if required fields are missing', async () => {
      // Missing complainant_name
      const res1 = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          respondent_name: 'Target Person',
          incident_type: 'Noise',
          incident_details: 'Details here'
        });
      expect(res1.status).toBe(400);

      // Missing incident_details
      const res2 = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complainant_name: 'Complainant',
          respondent_name: 'Target Person',
          incident_type: 'Noise',
          incident_details: '   '
        });
      expect(res2.status).toBe(400);
    });

    it('rejects case creation with 400 if respondent_id does not exist', async () => {
      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complainant_name: 'Complainant',
          respondent_name: 'Target Person',
          incident_type: 'Noise',
          incident_details: 'Details here',
          respondent_id: 888888
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not exist in residents/i);
    });

    it('rejects case creation with 400 if complainant_id does not exist', async () => {
      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complainant_name: 'Complainant',
          respondent_name: 'Target Person',
          incident_type: 'Noise',
          incident_details: 'Details here',
          complainant_id: 888888
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not exist in residents/i);
    });

    it('rejects case creation with 400 if status is invalid', async () => {
      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complainant_name: 'Complainant',
          respondent_name: 'Target Person',
          incident_type: 'Noise',
          incident_details: 'Details here',
          status: 'InvalidStatusString'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid status/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Blotter Listing & Filtering (GET /api/blotter) Tests
  // --------------------------------------------------------------------------
  describe('5. Blotter Listing & Filtering (GET /api/blotter)', () => {
    let filterResidentId: number;

    beforeAll(() => {
      const resRow = db.prepare(`
        INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok)
        VALUES ('Filter', 'Target', '1992-02-02', 'Male', 'Single', 'Purok 3')
      `).run();
      filterResidentId = Number(resRow.lastInsertRowid);

      db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_id, respondent_name, incident_type, status, incident_details, is_archived
        ) VALUES 
          ('BLT-2026-2001', 'Complainant A', ?, 'Filter Target', 'Property Dispute', 'Under Mediation', 'Fence dispute', 0),
          ('BLT-2026-2002', 'Complainant B', ?, 'Filter Target', 'Collection of Sum of Money', 'Settled', 'Debt repaid', 0),
          ('BLT-2026-2003', 'Complainant C', NULL, 'Other Guy', 'Physical Injury Incident', 'Active', 'Bar fight', 0),
          ('BLT-2026-2004', 'Complainant D', NULL, 'Other Guy', 'CFA Escalated Dispute', 'CFA Issued', 'Court referral', 0)
      `).run(filterResidentId, filterResidentId);
    });

    it('filters cases by single status (e.g. ?status=Under Mediation)', async () => {
      const res = await request(app)
        .get('/api/blotter?status=Under Mediation')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const item of res.body.data) {
        expect(item.status).toBe('Under Mediation');
      }
    });

    it('filters cases by comma-separated multi-status (e.g. ?status=Active,CFA Issued)', async () => {
      const res = await request(app)
        .get('/api/blotter?status=Active,CFA Issued')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const item of res.body.data) {
        expect(['Active', 'CFA Issued']).toContain(item.status);
      }
    });

    it('filters cases by search term across incident_type and names', async () => {
      const res = await request(app)
        .get('/api/blotter?search=physical')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].incident_type).toMatch(/Physical/i);
    });

    it('filters cases by specific respondent_id', async () => {
      const res = await request(app)
        .get(`/api/blotter?respondent_id=${filterResidentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      for (const item of res.body.data) {
        expect(item.respondent_id).toBe(filterResidentId);
      }
    });

    it('supports pagination with page, limit, total, and totalPages metadata', async () => {
      const res = await request(app)
        .get('/api/blotter?limit=2&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(res.body.pagination.totalPages).toBe(Math.ceil(res.body.pagination.total / 2));
    });
  });

  // --------------------------------------------------------------------------
  // 6. Single Blotter Retrieval (GET /api/blotter/:id) Tests
  // --------------------------------------------------------------------------
  describe('6. Single Blotter Retrieval (GET /api/blotter/:id)', () => {
    let caseId: number;

    beforeAll(() => {
      const row = db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_name, incident_type, status, incident_details
        ) VALUES ('BLT-2026-3001', 'Inspector', 'Suspect', 'Slander', 'Active', 'Verbal defamation')
      `).run();
      caseId = Number(row.lastInsertRowid);
    });

    it('retrieves full blotter case record for valid ID as Lupon', async () => {
      const res = await request(app)
        .get(`/api/blotter/${caseId}`)
        .set('Authorization', `Bearer ${luponToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(caseId);
      expect(res.body.case_number).toBe('BLT-2026-3001');
      expect(res.body.incident_type).toBe('Slander');
    });

    it('returns 404 for non-existent case ID', async () => {
      const res = await request(app)
        .get('/api/blotter/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 400 for invalid ID format', async () => {
      const res = await request(app)
        .get('/api/blotter/abc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid blotter id/i);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Blotter Status Transition & JSON Diff Audit (PUT /api/blotter/:id) Tests
  // --------------------------------------------------------------------------
  describe('7. Blotter Status Transition & JSON Diff Audit (PUT /api/blotter/:id)', () => {
    let transitionResidentId: number;
    let transitionCaseId: number;

    beforeAll(() => {
      const resRow = db.prepare(`
        INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok)
        VALUES ('Transition', 'Person', '1988-08-08', 'Male', 'Married', 'Purok 4')
      `).run();
      transitionResidentId = Number(resRow.lastInsertRowid);

      const caseRow = db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_id, respondent_name, incident_type, status, incident_details
        ) VALUES ('BLT-2026-4001', 'Neighbor Joe', ?, 'Transition Person', 'Barking Dogs', 'Active', 'Loud barking at 2 AM')
      `).run(transitionResidentId);
      transitionCaseId = Number(caseRow.lastInsertRowid);
    });

    it('verifies respondent is initially blocked by gatekeeper', async () => {
      const check1 = checkResidentBlotter(transitionResidentId);
      expect(check1.cleared).toBe(false);
      expect(check1.cases.length).toBe(1);
    });

    it('transitions case from Active to Settled with settlement notes and creates UPDATE audit diff', async () => {
      const payload = {
        status: 'Settled',
        settlement_notes: 'Both parties agreed to keep dogs indoors after 10 PM. Amicable settlement signed.'
      };

      const res = await request(app)
        .put(`/api/blotter/${transitionCaseId}`)
        .set('Authorization', `Bearer ${luponToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('Settled');
      expect(res.body.settlement_notes).toBe(payload.settlement_notes);

      // Verify immediate gatekeeper check on respondent now returns cleared: true
      const check2 = checkResidentBlotter(transitionResidentId);
      expect(check2.cleared).toBe(true);
      expect(check2.cases).toEqual([]);

      // Verify audit log JSON diff
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'blotter' AND entity_id = ? AND action = 'UPDATE'
        ORDER BY id DESC LIMIT 1
      `).get(transitionCaseId) as any;

      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('UPDATE');
      expect(auditLog.username_snapshot).toBe('blotter_lupon');
      expect(auditLog.user_role_snapshot).toBe('Lupon');

      const oldDiff = JSON.parse(auditLog.old_data_json);
      const newDiff = JSON.parse(auditLog.new_data_json);

      expect(oldDiff.status).toBe('Active');
      expect(newDiff.status).toBe('Settled');
      expect(newDiff.settlement_notes).toBe(payload.settlement_notes);
    });

    it('rejects update with 400 if status is invalid string', async () => {
      const res = await request(app)
        .put(`/api/blotter/${transitionCaseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Pending' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid status/i);
    });

    it('returns 404 for updating non-existent blotter ID', async () => {
      const res = await request(app)
        .put('/api/blotter/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Dismissed' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('suppresses audit log creation on no-op update with identical data', async () => {
      const auditCountBefore = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any).count;

      const res = await request(app)
        .put(`/api/blotter/${transitionCaseId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'Settled' });

      expect(res.status).toBe(200);

      const auditCountAfter = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any).count;
      expect(auditCountAfter).toBe(auditCountBefore);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Blotter Archival (PATCH /api/blotter/:id/archive) Tests
  // --------------------------------------------------------------------------
  describe('8. Blotter Archival (PATCH /api/blotter/:id/archive)', () => {
    let archiveResidentId: number;
    let archiveCaseId: number;

    beforeAll(() => {
      const resRow = db.prepare(`
        INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok)
        VALUES ('Archivable', 'Person', '1993-03-03', 'Female', 'Single', 'Purok 5')
      `).run();
      archiveResidentId = Number(resRow.lastInsertRowid);

      const caseRow = db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_id, respondent_name, incident_type, status, incident_details, is_archived
        ) VALUES ('BLT-2026-5001', 'Elder', ?, 'Archivable Person', 'Trespassing', 'Active', 'Accidental yard crossing', 0)
      `).run(archiveResidentId);
      archiveCaseId = Number(caseRow.lastInsertRowid);
    });

    it('soft-deletes blotter case as Admin and records ARCHIVE audit event', async () => {
      // Prior to archiving, respondent is blocked
      expect(checkResidentBlotter(archiveResidentId).cleared).toBe(false);

      const res = await request(app)
        .patch(`/api/blotter/${archiveCaseId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/archived successfully/i);

      // Verify is_archived = 1 in database
      const row = db.prepare('SELECT is_archived FROM blotter_records WHERE id = ?').get(archiveCaseId) as any;
      expect(row.is_archived).toBe(1);

      // Verify audit log
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE entity_type = 'blotter' AND entity_id = ? AND action = 'ARCHIVE'
        ORDER BY id DESC LIMIT 1
      `).get(archiveCaseId) as any;

      expect(auditLog).toBeDefined();
      expect(auditLog.action).toBe('ARCHIVE');
      expect(auditLog.username_snapshot).toBe('admin');

      // Verify gatekeeper check on respondent is no longer blocked
      expect(checkResidentBlotter(archiveResidentId).cleared).toBe(true);

      // Subsequent GET /api/blotter without is_archived=1 omits the archived case
      const listRes = await request(app)
        .get('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`);
      const found = listRes.body.data.find((c: any) => c.id === archiveCaseId);
      expect(found).toBeUndefined();
    });

    it('returns 404 for archiving non-existent case ID', async () => {
      const res = await request(app)
        .patch('/api/blotter/999999/archive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Role-Based Access Control (RBAC) Matrix Tests
  // --------------------------------------------------------------------------
  describe('9. Role-Based Access Control (RBAC) Matrix Verification', () => {
    let sampleCaseId: number;

    beforeAll(() => {
      const row = db.prepare(`
        INSERT INTO blotter_records (
          case_number, complainant_name, respondent_name, incident_type, status, incident_details
        ) VALUES ('BLT-2026-6001', 'Citizen A', 'Citizen B', 'Public Disturbance', 'Active', 'Details')
      `).run();
      sampleCaseId = Number(row.lastInsertRowid);
    });

    it('permits GET /api/residents/:id/blotter-check for all 4 roles (Admin, Clerk, Treasurer, Lupon)', async () => {
      for (const token of [adminToken, clerkToken, treasurerToken, luponToken]) {
        const res = await request(app)
          .get(`/api/residents/${residentAliceId}/blotter-check`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
      }
    });

    it('permits POST /api/blotter for Admin and Lupon; forbids Clerk and Treasurer (403)', async () => {
      // Permitted: Admin & Lupon
      for (const token of [adminToken, luponToken]) {
        const res = await request(app)
          .post('/api/blotter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            complainant_name: 'RBAC Complainant',
            respondent_name: 'RBAC Respondent',
            incident_type: 'Verbal Spat',
            incident_details: 'Incident details'
          });
        expect(res.status).toBe(201);
      }

      // Forbidden: Clerk & Treasurer
      for (const token of [clerkToken, treasurerToken]) {
        const res = await request(app)
          .post('/api/blotter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            complainant_name: 'RBAC Complainant',
            respondent_name: 'RBAC Respondent',
            incident_type: 'Verbal Spat',
            incident_details: 'Incident details'
          });
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
      }
    });

    it('permits GET /api/blotter & GET /api/blotter/:id for Admin and Lupon; forbids Clerk and Treasurer (403)', async () => {
      // Permitted: Admin & Lupon
      for (const token of [adminToken, luponToken]) {
        const listRes = await request(app)
          .get('/api/blotter')
          .set('Authorization', `Bearer ${token}`);
        expect(listRes.status).toBe(200);

        const itemRes = await request(app)
          .get(`/api/blotter/${sampleCaseId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(itemRes.status).toBe(200);
      }

      // Forbidden: Clerk & Treasurer
      for (const token of [clerkToken, treasurerToken]) {
        const listRes = await request(app)
          .get('/api/blotter')
          .set('Authorization', `Bearer ${token}`);
        expect(listRes.status).toBe(403);

        const itemRes = await request(app)
          .get(`/api/blotter/${sampleCaseId}`)
          .set('Authorization', `Bearer ${token}`);
        expect(itemRes.status).toBe(403);
      }
    });

    it('permits PUT /api/blotter/:id for Admin and Lupon; forbids Clerk and Treasurer (403)', async () => {
      // Forbidden: Clerk & Treasurer
      for (const token of [clerkToken, treasurerToken]) {
        const res = await request(app)
          .put(`/api/blotter/${sampleCaseId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ incident_location: 'Updated Location' });
        expect(res.status).toBe(403);
      }

      // Permitted: Lupon
      const luponRes = await request(app)
        .put(`/api/blotter/${sampleCaseId}`)
        .set('Authorization', `Bearer ${luponToken}`)
        .send({ incident_location: 'Updated by Lupon' });
      expect(luponRes.status).toBe(200);
    });

    it('restricts PATCH /api/blotter/:id/archive strictly to Admin (forbids Lupon, Clerk, Treasurer)', async () => {
      // Forbidden: Lupon, Clerk, Treasurer
      for (const token of [luponToken, clerkToken, treasurerToken]) {
        const res = await request(app)
          .patch(`/api/blotter/${sampleCaseId}/archive`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/forbidden/i);
      }

      // Permitted: Admin
      const adminRes = await request(app)
        .patch(`/api/blotter/${sampleCaseId}/archive`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
    });

    it('rejects unauthenticated requests with 401 across all blotter endpoints', async () => {
      const endpoints = [
        { method: 'get', url: '/api/blotter' },
        { method: 'get', url: `/api/blotter/${sampleCaseId}` },
        { method: 'post', url: '/api/blotter' },
        { method: 'put', url: `/api/blotter/${sampleCaseId}` },
        { method: 'patch', url: `/api/blotter/${sampleCaseId}/archive` },
        { method: 'get', url: `/api/residents/${residentAliceId}/blotter-check` }
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.url);
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/unauthorized/i);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 10. Atomic Rollback on Audit Failure (Zero Orphaned Records)
  // --------------------------------------------------------------------------
  describe('10. Atomic Rollback on Audit Failure (Adversarial Power-Loss Simulation)', () => {
    it('rolls back blotter case insertion if audit logging throws an error', async () => {
      const countBefore = (db.prepare('SELECT COUNT(*) as count FROM blotter_records').get() as any).count;

      const logAuditSpy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic power brownout during audit log');
      });

      const res = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          complainant_name: 'Crash Test',
          respondent_name: 'Rollback Person',
          incident_type: 'Atomic Test',
          incident_details: 'Should never persist if audit fails'
        });

      expect(res.status).toBe(500);

      const countAfter = (db.prepare('SELECT COUNT(*) as count FROM blotter_records').get() as any).count;
      expect(countAfter).toBe(countBefore);

      logAuditSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // 11. Blotter Print Preview & MS Word (.docx) Export
  // --------------------------------------------------------------------------
  describe('11. Blotter Print Preview & MS Word (.docx) Export', () => {
    it('renders interpolated Blotter/KP print preview HTML and exports valid .docx for Admin and Lupon', async () => {
      const firstCase = db.prepare('SELECT * FROM blotter_records ORDER BY id ASC LIMIT 1').get() as any;
      expect(firstCase).toBeDefined();

      const previewRes = await request(app)
        .post(`/api/blotter/${firstCase.id}/print-preview`)
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          template_code: 'KP_SUMMONS',
          paper_size: 'long',
          hearing_date: 'November 15, 2026 at 10:00 AM',
          log_print: true
        });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.template_code).toBe('KP_SUMMONS');
      expect(previewRes.body.paper_size).toBe('long');
      expect(previewRes.body.html).toContain(firstCase.complainant_name.toUpperCase());
      expect(previewRes.body.html).toContain(firstCase.respondent_name.toUpperCase());
      expect(previewRes.body.html).toContain('November 15, 2026 at 10:00 AM');
      expect(previewRes.body.header_html).toMatch(/Lupong Tagapamayapa/i);

      const docxRes = await request(app)
        .post(`/api/blotter/${firstCase.id}/export-docx`)
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          template_code: 'BLOTTER_EXTRACT',
          paper_size: 'short'
        })
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(docxRes.status).toBe(200);
      expect(docxRes.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const docxBuf = docxRes.body as Buffer;
      expect(Buffer.isBuffer(docxBuf)).toBe(true);
      expect(docxBuf.subarray(0, 2).toString('utf8')).toBe('PK');
    });
  });
});
