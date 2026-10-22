import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import { generateControlNumber } from '../src/services/issuance.service';
import * as auditService from '../src/services/audit.service';

describe('Transactional Certificate Issuance API & Audit Linkage Test Suite (issuances.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_issuances_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;

  let residentCleanId: number;
  let residentBlotteredId: number;
  let templateClearanceId: number;
  let templateIndigencyId: number;
  let officialCaptainId: number;
  let officialKagawadId: number;

  beforeAll(async () => {
    // 1. Clean up any stale test database
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

    // 2. Initialize database, schema, and base seed
    initDb(testDbFile);
    initSchema();
    seed();

    // 3. Create staff users for all 4 roles to test RBAC
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('issuance_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('issuance_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('issuance_lupon', ?, 'Lupon Member', 'Lupon', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        is_active = excluded.is_active
    `).run(passHash, passHash, passHash);

    // 4. Authenticate each role and retrieve JWT tokens
    const adminLogin = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;

    const clerkLogin = await request(app).post('/api/auth/login').send({
      username: 'issuance_clerk',
      password: 'matrix_pass_123'
    });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app).post('/api/auth/login').send({
      username: 'issuance_treasurer',
      password: 'matrix_pass_123'
    });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app).post('/api/auth/login').send({
      username: 'issuance_lupon',
      password: 'matrix_pass_123'
    });
    luponToken = luponLogin.body.token;

    // 5. Seed dedicated residents: one clean, one with an active blotter case
    const cleanRes = db.prepare(`
      INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok, house_no_street)
      VALUES ('JUAN', 'DELA CRUZ', '1990-05-15', 'Male', 'Single', 'Purok 1', '123 Main St')
    `).run();
    residentCleanId = Number(cleanRes.lastInsertRowid);

    const blotteredRes = db.prepare(`
      INSERT INTO residents (first_name, last_name, birthdate, sex, civil_status, purok, house_no_street)
      VALUES ('MARIA', 'SANTOS', '1988-10-20', 'Female', 'Married', 'Purok 2', '456 Sampaguita St')
    `).run();
    residentBlotteredId = Number(blotteredRes.lastInsertRowid);

    // Seed active blotter case for Maria Santos
    db.prepare(`
      INSERT INTO blotter_records (
        case_number, complainant_name, respondent_id, respondent_name, incident_type, incident_details, status
      ) VALUES (
        'BLT-2026-999', 'Pedro Penduko', ?, 'MARIA SANTOS', 'Physical Injury', 'Altercation near market', 'Active'
      )
    `).run(residentBlotteredId);

    // Retrieve seeded templates
    const tplClearance = db.prepare("SELECT id FROM certificate_templates WHERE template_code = 'BRGY_CLEARANCE'").get() as any;
    templateClearanceId = tplClearance.id;

    const tplIndigency = db.prepare("SELECT id FROM certificate_templates WHERE template_code = 'INDIGENCY'").get() as any;
    templateIndigencyId = tplIndigency.id;

    // Retrieve seeded officials
    const pb = db.prepare("SELECT id FROM barangay_officials WHERE position = 'Punong Barangay' AND is_active = 1").get() as any;
    officialCaptainId = pb.id;

    const kag = db.prepare("SELECT id FROM barangay_officials WHERE position = 'Sangguniang Barangay Member' AND is_active = 1 LIMIT 1").get() as any;
    officialKagawadId = kag.id;
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
  // 1. Sequential Control Number Generation
  // --------------------------------------------------------------------------
  describe('1. Sequential Control Number Generation', () => {
    it('initial generation for target year 2026 formats as CERT-2026-00001 when table is empty', () => {
      // Clean certificate_issuances for clean sequence testing
      db.prepare("DELETE FROM certificate_issuances WHERE control_number LIKE 'CERT-2026-%'").run();
      const code = generateControlNumber(2026);
      expect(code).toBe('CERT-2026-00001');
    });

    it('contiguous incrementation tracks MAX + 1 sequentially', () => {
      // Simulate existing records in database
      db.prepare(`
        INSERT INTO certificate_issuances (
          control_number, resident_id, template_id, purpose, signatory_official_id,
          signatory_name_snapshot, signatory_position_snapshot, issued_by_user_id
        ) VALUES 
          ('CERT-2026-00001', ?, ?, 'Test Purpose', ?, 'Cap', 'PB', 1),
          ('CERT-2026-00002', ?, ?, 'Test Purpose', ?, 'Cap', 'PB', 1)
      `).run(
        residentCleanId, templateClearanceId, officialCaptainId,
        residentCleanId, templateClearanceId, officialCaptainId
      );

      const nextCode = generateControlNumber(2026);
      expect(nextCode).toBe('CERT-2026-00003');
    });

    it('calendar year rollover resets counter back to 00001 for new year', () => {
      const code2027 = generateControlNumber(2027);
      expect(code2027).toBe('CERT-2027-00001');
    });

    it('monotonicity tracks MAX + 1 even if earlier sequence slots have gaps', () => {
      // Insert a higher number to create a gap
      db.prepare(`
        INSERT INTO certificate_issuances (
          control_number, resident_id, template_id, purpose, signatory_official_id,
          signatory_name_snapshot, signatory_position_snapshot, issued_by_user_id
        ) VALUES ('CERT-2026-00042', ?, ?, 'Gap Test', ?, 'Cap', 'PB', 1)
      `).run(residentCleanId, templateClearanceId, officialCaptainId);

      const nextCode = generateControlNumber(2026);
      expect(nextCode).toBe('CERT-2026-00043');
    });

    it('formats without truncation if sequence exceeds 99999', () => {
      db.prepare(`
        INSERT INTO certificate_issuances (
          control_number, resident_id, template_id, purpose, signatory_official_id,
          signatory_name_snapshot, signatory_position_snapshot, issued_by_user_id
        ) VALUES ('CERT-2026-99999', ?, ?, 'Overflow Test', ?, 'Cap', 'PB', 1)
      `).run(residentCleanId, templateClearanceId, officialCaptainId);

      const overflowCode = generateControlNumber(2026);
      expect(overflowCode).toBe('CERT-2026-100000');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Certificate Preview Endpoint (POST /api/issuances/preview)
  // --------------------------------------------------------------------------
  describe('2. Certificate Preview Endpoint (POST /api/issuances/preview)', () => {
    it('valid preview returns 200 with interpolated HTML, preview control number, roster, and blotter status', async () => {
      const issuancesCountBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountBefore = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;

      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          purpose: 'Employment Application',
          signatory_official_id: officialCaptainId,
          is_oic_signing: false
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('html');
      expect(res.body).toHaveProperty('title_header');
      expect(res.body).toHaveProperty('show_officials_sidebar');
      expect(res.body).toHaveProperty('control_number_preview');
      expect(res.body.control_number_preview).toMatch(/^CERT-\d{4}-PREVIEW$/);
      expect(res.body).toHaveProperty('sidebar_officials');
      expect(Array.isArray(res.body.sidebar_officials)).toBe(true);
      expect(res.body.blotter_status).toEqual({ cleared: true, cases: [] });

      // Verifies interpolated text contains resident name and purpose
      expect(res.body.html).toContain('JUAN DELA CRUZ');
      expect(res.body.html).toContain('Employment Application');

      // Strictly verifies read-only guarantee: ZERO writes to certificate_issuances and audit_logs
      const issuancesCountAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountAfter = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;
      expect(issuancesCountAfter).toBe(issuancesCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it('preview for resident with pending blotter returns blotter_status with cleared = false and cases array', async () => {
      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Business Permit',
          signatory_official_id: officialCaptainId
        });

      expect(res.status).toBe(200);
      expect(res.body.blotter_status.cleared).toBe(false);
      expect(res.body.blotter_status.cases.length).toBeGreaterThanOrEqual(1);
      expect(res.body.blotter_status.cases[0].case_number).toBe('BLT-2026-999');
      expect(res.body.blotter_status.cases[0].status).toBe('Active');
    });

    it('returns 404 if resident_id does not exist', async () => {
      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: 999999,
          template_id: templateClearanceId,
          signatory_official_id: officialCaptainId
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/resident not found/i);
    });

    it('returns 404 if template_id does not exist', async () => {
      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: 999999,
          signatory_official_id: officialCaptainId
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/template not found/i);
    });

    it('returns 404 if signatory_official_id does not exist', async () => {
      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          signatory_official_id: 999999
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/signatory official not found/i);
    });

    it('returns 400 if signatory official is inactive (is_active = 0)', async () => {
      const inactiveOfficial = db.prepare(`
        INSERT INTO barangay_officials (full_name, position, rank_order, is_active)
        VALUES ('HON. INACTIVE OFFICIAL', 'Sangguniang Barangay Member', 99, 0)
      `).run();
      const inactiveId = Number(inactiveOfficial.lastInsertRowid);

      const res = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          signatory_official_id: inactiveId
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signatory official is not active/i);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Gatekeeper Enforcement — Block Without Override
  // --------------------------------------------------------------------------
  describe('3. Gatekeeper Enforcement — Block Without Override', () => {
    it('aborts issuance with 400 Bad Request when resident has active blotter and is_override is omitted', async () => {
      const issuancesCountBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountBefore = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;

      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Local Employment',
          signatory_official_id: officialCaptainId
          // is_override omitted
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/active blotter records.*override required/i);
      expect(res.body.cases).toBeDefined();
      expect(res.body.cases.length).toBeGreaterThanOrEqual(1);

      // Verify ZERO records inserted into certificate_issuances and audit_logs
      const issuancesCountAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountAfter = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;
      expect(issuancesCountAfter).toBe(issuancesCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it('aborts issuance with 400 Bad Request when is_override is explicitly false', async () => {
      const issuancesCountBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;

      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Passport Application',
          signatory_official_id: officialCaptainId,
          is_override: false
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/active blotter records.*override required/i);

      const issuancesCountAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      expect(issuancesCountAfter).toBe(issuancesCountBefore);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Gatekeeper Enforcement — Block on Insufficient Override Justification
  // --------------------------------------------------------------------------
  describe('4. Gatekeeper Enforcement — Block on Insufficient Override Justification', () => {
    it('aborts with 400 when is_override is true but blotter_override_reason is shorter than 10 characters', async () => {
      const issuancesCountBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountBefore = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;

      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Bank Loan',
          signatory_official_id: officialCaptainId,
          is_override: true,
          blotter_override_reason: 'Urgent' // Only 6 characters
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be at least 10 characters long/i);

      // Verify ZERO records created
      const issuancesCountAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountAfter = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;
      expect(issuancesCountAfter).toBe(issuancesCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it('aborts with 400 when blotter_override_reason is whitespace only', async () => {
      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Scholarship',
          signatory_official_id: officialCaptainId,
          is_override: true,
          blotter_override_reason: '          ' // 10 spaces
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/must be at least 10 characters long/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Overridden Issuance & Dual Audit Log Linkage
  // --------------------------------------------------------------------------
  describe('5. Overridden Issuance & Dual Audit Log Linkage', () => {
    it('succeeds with 201 Created and records BOTH PRINT_CERTIFICATE and BLOTTER_OVERRIDE audit logs', async () => {
      const overrideReason = 'Approved by Punong Barangay for urgent hospitalization';

      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: residentBlotteredId,
          template_id: templateClearanceId,
          purpose: 'Hospital Assistance',
          signatory_official_id: officialCaptainId,
          is_override: true,
          blotter_override_reason: overrideReason
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('issuance');
      expect(res.body).toHaveProperty('html');
      expect(res.body.issuance.had_active_blotter).toBe(1);
      expect(res.body.issuance.blotter_override_reason).toBe(overrideReason);

      const issuanceId = res.body.issuance.id;
      const controlNum = res.body.issuance.control_number;

      // Query audit logs generated for this issuance
      const logs = db.prepare(`
        SELECT action, entity_type, entity_id, summary_text, new_data_json
        FROM audit_logs
        WHERE entity_type = 'issuance' AND entity_id = ?
        ORDER BY id ASC
      `).all(issuanceId) as any[];

      expect(logs.length).toBe(2);

      // Log 1: PRINT_CERTIFICATE
      const printLog = logs.find(l => l.action === 'PRINT_CERTIFICATE');
      expect(printLog).toBeDefined();
      expect(printLog.summary_text).toContain(controlNum);
      expect(printLog.summary_text).toContain('MARIA SANTOS');

      // Log 2: BLOTTER_OVERRIDE
      const overrideLog = logs.find(l => l.action === 'BLOTTER_OVERRIDE');
      expect(overrideLog).toBeDefined();
      expect(overrideLog.summary_text).toContain(`Blotter override authorized for ${controlNum}`);
      expect(overrideLog.summary_text).toContain(overrideReason);

      const overrideData = JSON.parse(overrideLog.new_data_json);
      expect(overrideData.control_number).toBe(controlNum);
      expect(overrideData.blotter_override_reason).toBe(overrideReason);
      expect(overrideData.pending_cases).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Clean Issuance (No Blotter Records)
  // --------------------------------------------------------------------------
  describe('6. Clean Issuance (No Blotter Records)', () => {
    it('succeeds with 201 Created and logs ONLY PRINT_CERTIFICATE, without BLOTTER_OVERRIDE', async () => {
      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateIndigencyId,
          purpose: 'Medical Assistance',
          signatory_official_id: officialCaptainId,
          amount_paid: 0,
          or_number: 'EXEMPT'
        });

      expect(res.status).toBe(201);
      expect(res.body.issuance.had_active_blotter).toBe(0);
      expect(res.body.issuance.blotter_override_reason).toBe('');

      const issuanceId = res.body.issuance.id;

      const logs = db.prepare(`
        SELECT action, entity_type, entity_id, summary_text
        FROM audit_logs
        WHERE entity_type = 'issuance' AND entity_id = ?
      `).all(issuanceId) as any[];

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('PRINT_CERTIFICATE');

      // Assert NO BLOTTER_OVERRIDE audit record exists
      const overrideLog = logs.find(l => l.action === 'BLOTTER_OVERRIDE');
      expect(overrideLog).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Signatory Snapshot Preservation (Election Protection)
  // --------------------------------------------------------------------------
  describe('7. Signatory Snapshot Preservation (Election Protection)', () => {
    it('preserves signatory_name_snapshot and signatory_position_snapshot permanently after official is modified', async () => {
      // 1. Create a dedicated official for snapshot testing
      const officialRes = db.prepare(`
        INSERT INTO barangay_officials (full_name, position, rank_order, is_active)
        VALUES ('HON. JUAN DELA CRUZ', 'Punong Barangay', 1, 1)
      `).run();
      const testOfficialId = Number(officialRes.lastInsertRowid);

      // 2. Issue a certificate selecting this official
      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          purpose: 'Election Snapshot Test',
          signatory_official_id: testOfficialId
        });

      expect(res.status).toBe(201);
      const issuanceId = res.body.issuance.id;
      expect(res.body.issuance.signatory_name_snapshot).toBe('HON. JUAN DELA CRUZ');
      expect(res.body.issuance.signatory_position_snapshot).toBe('Punong Barangay');

      // 3. Simulate council election / official update in barangay_officials
      db.prepare(`
        UPDATE barangay_officials
        SET full_name = 'HON. PEDRO SANTOS',
            is_active = 0
        WHERE id = ?
      `).run(testOfficialId);

      // 4. Re-fetch the issued certificate via GET /api/issuances/:id
      const getRes = await request(app)
        .get(`/api/issuances/${issuanceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.signatory_name_snapshot).toBe('HON. JUAN DELA CRUZ');
      expect(getRes.body.signatory_position_snapshot).toBe('Punong Barangay');
      expect(getRes.body.issuance.signatory_name_snapshot).toBe('HON. JUAN DELA CRUZ');
      expect(getRes.body.issuance.signatory_position_snapshot).toBe('Punong Barangay');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Transactional Rollback Verification
  // --------------------------------------------------------------------------
  describe('8. Transactional Rollback Verification', () => {
    it('rolls back completely if error occurs during transaction, with zero orphan rows and unburned control number', async () => {
      // Clean 2028 space to test unburned control number isolation
      db.prepare("DELETE FROM certificate_issuances WHERE control_number LIKE 'CERT-2028-%'").run();

      const issuancesCountBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountBefore = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;

      // Spy on logAuditEvent to simulate catastrophic database error mid-transaction
      const auditSpy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic brownout mid-transaction during audit logging');
      });

      const res = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          purpose: 'Rollback Atomicity Test',
          signatory_official_id: officialCaptainId
        });

      expect(res.status).toBe(500);

      // Assert database has ZERO orphan records in certificate_issuances and audit_logs
      const issuancesCountAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      const auditCountAfter = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c;
      expect(issuancesCountAfter).toBe(issuancesCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);

      auditSpy.mockRestore();

      // Subsequent attempt succeeds and receives the unburned contiguous control number
      const nextAttempt = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          purpose: 'Successful Subsequent Issuance',
          signatory_official_id: officialCaptainId
        });

      expect(nextAttempt.status).toBe(201);
      expect(nextAttempt.body.issuance.control_number).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Issuance History Filtering & Pagination (GET /api/issuances)
  // --------------------------------------------------------------------------
  describe('9. Issuance History Filtering & Pagination (GET /api/issuances)', () => {
    beforeAll(async () => {
      // Seed a couple more records for filtering verification
      await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateIndigencyId,
          purpose: 'Filter Check Indigency',
          signatory_official_id: officialCaptainId
        });
    });

    it('returns paginated list with pagination metadata', async () => {
      const res = await request(app)
        .get('/api/issuances?page=1&limit=2')
        .set('Authorization', `Bearer ${clerkToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('filters by template_id', async () => {
      const res = await request(app)
        .get(`/api/issuances?template_id=${templateIndigencyId}`)
        .set('Authorization', `Bearer ${clerkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data) {
        expect(item.template_id).toBe(templateIndigencyId);
      }
    });

    it('filters by had_active_blotter = 1 (overridden issuances only)', async () => {
      const res = await request(app)
        .get('/api/issuances?had_active_blotter=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data) {
        expect(item.had_active_blotter).toBe(1);
      }
    });

    it('filters by search term matching resident name or control number', async () => {
      const res = await request(app)
        .get('/api/issuances?search=MARIA')
        .set('Authorization', `Bearer ${clerkToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].resident_name).toContain('MARIA SANTOS');
    });

    it('filters by date interval (start_date, end_date)', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      const res = await request(app)
        .get(`/api/issuances?start_date=${today}&end_date=${today}`)
        .set('Authorization', `Bearer ${treasurerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Role-Based Access Control (RBAC) & Immutability Protection
  // --------------------------------------------------------------------------
  describe('10. Role-Based Access Control (RBAC) & Immutability Protection', () => {
    it('Admin, Clerk, and Treasurer can successfully preview, issue, and query certificates', async () => {
      for (const token of [adminToken, clerkToken, treasurerToken]) {
        const previewRes = await request(app)
          .post('/api/issuances/preview')
          .set('Authorization', `Bearer ${token}`)
          .send({
            resident_id: residentCleanId,
            template_id: templateClearanceId,
            signatory_official_id: officialCaptainId
          });
        expect(previewRes.status).toBe(200);

        const listRes = await request(app)
          .get('/api/issuances')
          .set('Authorization', `Bearer ${token}`);
        expect(listRes.status).toBe(200);
      }
    });

    it('Lupon role is strictly forbidden (HTTP 403) across all issuance endpoints', async () => {
      const previewRes = await request(app)
        .post('/api/issuances/preview')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          signatory_official_id: officialCaptainId
        });
      expect(previewRes.status).toBe(403);
      expect(previewRes.body.error).toMatch(/forbidden/i);

      const issueRes = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          resident_id: residentCleanId,
          template_id: templateClearanceId,
          purpose: 'Lupon Attempt',
          signatory_official_id: officialCaptainId
        });
      expect(issueRes.status).toBe(403);
      expect(issueRes.body.error).toMatch(/forbidden/i);

      const listRes = await request(app)
        .get('/api/issuances')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(listRes.status).toBe(403);
      expect(listRes.body.error).toMatch(/forbidden/i);

      const getByIdRes = await request(app)
        .get('/api/issuances/1')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(getByIdRes.status).toBe(403);
      expect(getByIdRes.body.error).toMatch(/forbidden/i);
    });

    it('Unauthenticated requests are rejected with HTTP 401 Unauthorized', async () => {
      const previewRes = await request(app).post('/api/issuances/preview').send({});
      expect(previewRes.status).toBe(401);

      const issueRes = await request(app).post('/api/issuances').send({});
      expect(issueRes.status).toBe(401);

      const listRes = await request(app).get('/api/issuances');
      expect(listRes.status).toBe(401);

      const getByIdRes = await request(app).get('/api/issuances/1');
      expect(getByIdRes.status).toBe(401);
    });

    it('Strict Immutability: PUT, PATCH, and DELETE on /api/issuances/:id return 404 (endpoint not found)', async () => {
      const putRes = await request(app)
        .put('/api/issuances/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ purpose: 'Hacked' });
      expect(putRes.status).toBe(404);

      const patchRes = await request(app)
        .patch('/api/issuances/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount_paid: 999 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete('/api/issuances/1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deleteRes.status).toBe(404);
    });
  });
});
