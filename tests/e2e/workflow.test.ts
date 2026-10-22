import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import http from 'http';
import Database from 'better-sqlite3';
import { app, startServer } from '../../server/src/index';
import { db, initDb, closeDb } from '../../server/src/db/connection';
import { initSchema } from '../../server/src/db/init';
import { seed } from '../../server/src/db/seed';

describe('Phase 13: End-to-End System Integration, LAN & Offline Verification', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const testDbFile = path.resolve(rootDir, 'data/test_e2e_workflow.sqlite');
  const backupsDir = path.resolve(rootDir, 'data/backups');

  let adminToken: string;
  let clerkToken: string;
  let luponToken: string;
  let treasurerToken: string;

  let elenaResidentId: number;
  let activeBlotterId: number;
  let generatedCaseNumber: string;
  let clearanceTemplateId: number;
  let captainOfficialId: number;
  let issuedCertId: number;
  let generatedControlNumber: string;

  const createdBackupFiles: string[] = [];

  function cleanTestDbFiles() {
    const files = [
      testDbFile,
      `${testDbFile}-wal`,
      `${testDbFile}-shm`
    ];
    for (const f of files) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore Windows file lock race
        }
      }
    }
  }

  beforeAll(async () => {
    cleanTestDbFiles();

    // Initialize isolated SQLite database
    initDb(testDbFile);
    initSchema();
    seed();

    // Step 1: Admin Staff Provisioning via API
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = adminLoginRes.body.token;

    // Create staff users: Clerk, Lupon, Treasurer
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'e2e_clerk',
        password: 'ClerkPass123!',
        full_name: 'E2E Clerk Officer',
        role: 'Clerk'
      })
      .expect(201);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'e2e_lupon',
        password: 'LuponPass123!',
        full_name: 'E2E Lupon Officer',
        role: 'Lupon'
      })
      .expect(201);

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'e2e_treasurer',
        password: 'TreasurerPass123!',
        full_name: 'E2E Barangay Treasurer',
        role: 'Treasurer'
      })
      .expect(201);

    // Authenticate all created roles
    const clerkLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'e2e_clerk', password: 'ClerkPass123!' })
      .expect(200);
    clerkToken = clerkLoginRes.body.token;

    const luponLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'e2e_lupon', password: 'LuponPass123!' })
      .expect(200);
    luponToken = luponLoginRes.body.token;

    const treasurerLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'e2e_treasurer', password: 'TreasurerPass123!' })
      .expect(200);
    treasurerToken = treasurerLoginRes.body.token;

    // Retrieve Barangay Clearance template and Punong Barangay official
    const tplRow = db.prepare("SELECT id FROM certificate_templates WHERE template_code = 'BRGY_CLEARANCE'").get() as any;
    clearanceTemplateId = tplRow.id;

    const offRow = db.prepare("SELECT id FROM barangay_officials WHERE position = 'Punong Barangay' AND is_active = 1").get() as any;
    captainOfficialId = offRow.id;
  });

  afterAll(() => {
    closeDb();

    // Clean up created backups during test run
    for (const b of createdBackupFiles) {
      if (fs.existsSync(b)) {
        try {
          fs.unlinkSync(b);
        } catch {
          // Ignore
        }
      }
    }

    cleanTestDbFiles();
  });

  // ==========================================================================
  // Test 1: Full Lifecycle E2E Workflow Test
  // ==========================================================================
  describe('1. Full Lifecycle E2E Workflow Test', () => {
    it('Step 1 (Staff Provisioning): verifies Admin successfully provisioned Clerk, Lupon, and Treasurer tokens', () => {
      expect(adminToken).toBeDefined();
      expect(clerkToken).toBeDefined();
      expect(luponToken).toBeDefined();
      expect(treasurerToken).toBeDefined();
    });

    it('Step 2 (Resident Registration & Combinatorial Sector Query): Clerk registers senior resident and queries dynamic sector tags', async () => {
      const residentPayload = {
        first_name: 'Elena',
        middle_name: 'Santos',
        last_name: 'Marasigan',
        suffix: '',
        birthdate: '1958-04-15', // Senior citizen (>= 60)
        sex: 'Female',
        civil_status: 'Married',
        purok: 'Purok 2',
        house_no_street: '45 Orchid Street',
        contact_no: '09171234567',
        occupation: 'Dressmaker',
        nationality: 'Filipino',
        residency_status: 'Active',
        is_pwd: 1,
        pwd_id_no: 'PWD-E2E-001',
        is_4ps: 1,
        is_voter: 1,
        precinct_no: '0042A'
      };

      const createRes = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${clerkToken}`)
        .set('X-Forwarded-For', '192.168.1.21')
        .send(residentPayload)
        .expect(201);

      expect(createRes.body.id).toBeDefined();
      elenaResidentId = createRes.body.id;
      expect(createRes.body.first_name).toBe('Elena');
      expect(createRes.body.last_name).toBe('Marasigan');

      // Query combinatorial sectors: senior, pwd, 4ps, voter in Purok 2
      const filterRes = await request(app)
        .get('/api/residents?sectors=senior,pwd,4ps,voter&purok=Purok+2')
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      const foundElena = filterRes.body.data.find((r: any) => r.id === elenaResidentId);
      expect(foundElena).toBeDefined();
      expect(foundElena.first_name).toBe('Elena');
      expect(foundElena.last_name).toBe('Marasigan');
      expect(foundElena.age).toBeGreaterThanOrEqual(60);
      expect(foundElena.is_senior).toBe(true);
      expect(foundElena.is_pwd).toBe(1);
      expect(foundElena.is_4ps).toBe(1);
      expect(foundElena.is_voter).toBe(1);

      // Fine-grained update: update occupation and contact_no
      const updateRes = await request(app)
        .put(`/api/residents/${elenaResidentId}`)
        .set('Authorization', `Bearer ${clerkToken}`)
        .set('X-Forwarded-For', '192.168.1.21')
        .send({
          occupation: 'Master Dressmaker',
          contact_no: '09179998888'
        })
        .expect(200);

      expect(updateRes.body.occupation).toBe('Master Dressmaker');
      expect(updateRes.body.contact_no).toBe('09179998888');
    });

    it('Step 3 (Blotter Case Filing): Lupon files an Active blotter case with sequential case number', async () => {
      const blotterPayload = {
        complainant_name: 'Rodrigo Duterte',
        respondent_name: 'Elena Marasigan',
        incident_type: 'Property Boundary Dispute',
        incident_details: 'Dispute regarding concrete fence encroaching on Purok 2 lot boundary',
        incident_location: 'Purok 2 Orchid Street',
        respondent_id: elenaResidentId
      };

      const blotterRes = await request(app)
        .post('/api/blotter')
        .set('Authorization', `Bearer ${luponToken}`)
        .set('X-Forwarded-For', '192.168.1.22')
        .send(blotterPayload)
        .expect(201);

      expect(blotterRes.body.id).toBeDefined();
      activeBlotterId = blotterRes.body.id;
      generatedCaseNumber = blotterRes.body.case_number;
      expect(generatedCaseNumber).toMatch(/^BLT-\d{4}-\d{3,}$/);
      expect(blotterRes.body.status).toBe('Active');
      expect(blotterRes.body.respondent_id).toBe(elenaResidentId);
    });

    it('Step 4 (Blotter Gatekeeper Block Verification): Gatekeeper detects pending case and rejects issuance without valid override', async () => {
      // 1. Blotter check endpoint
      const checkRes = await request(app)
        .get(`/api/residents/${elenaResidentId}/blotter-check`)
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      expect(checkRes.body.cleared).toBe(false);
      expect(Array.isArray(checkRes.body.cases)).toBe(true);
      expect(checkRes.body.cases.length).toBeGreaterThanOrEqual(1);
      const caseMatch = checkRes.body.cases.find((c: any) => c.case_number === generatedCaseNumber);
      expect(caseMatch).toBeDefined();
      expect(caseMatch.incident_type).toBe('Property Boundary Dispute');

      // Count issuances before attempts
      const countBefore = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;

      // 2. Issuance attempt without override
      const noOverrideRes = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: elenaResidentId,
          template_id: clearanceTemplateId,
          purpose: 'Overseas Employment',
          signatory_official_id: captainOfficialId
        })
        .expect(400);

      expect(noOverrideRes.body.error).toMatch(/active blotter records.*override required/i);
      expect(noOverrideRes.body.cases).toBeDefined();

      // 3. Issuance attempt with insufficient override reason (< 10 chars)
      const shortOverrideRes = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({
          resident_id: elenaResidentId,
          template_id: clearanceTemplateId,
          purpose: 'Overseas Employment',
          signatory_official_id: captainOfficialId,
          is_override: true,
          blotter_override_reason: 'Too short'
        })
        .expect(400);

      expect(shortOverrideRes.body.error).toMatch(/must be at least 10 characters long/i);

      // Verify zero orphaned records in certificate_issuances
      const countAfter = (db.prepare('SELECT COUNT(*) as c FROM certificate_issuances').get() as any).c;
      expect(countAfter).toBe(countBefore);
    });

    it('Step 5 (Authorized Override & Certificate Issuance): Clerk provides valid override justification and issues certificate', async () => {
      const validOverrideReason = 'Approved by Punong Barangay for urgent medical hospitalization assistance';

      const issueRes = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${clerkToken}`)
        .set('X-Forwarded-For', '192.168.1.21')
        .send({
          resident_id: elenaResidentId,
          template_id: clearanceTemplateId,
          purpose: 'Emergency Hospital Assistance',
          signatory_official_id: captainOfficialId,
          is_override: true,
          blotter_override_reason: validOverrideReason
        })
        .expect(201);

      expect(issueRes.body.issuance).toBeDefined();
      expect(issueRes.body.html).toBeDefined();

      issuedCertId = issueRes.body.issuance.id;
      generatedControlNumber = issueRes.body.issuance.control_number;
      expect(generatedControlNumber).toMatch(/^CERT-\d{4}-\d{5}$/);
      expect(issueRes.body.issuance.had_active_blotter).toBe(1);
      expect(issueRes.body.issuance.blotter_override_reason).toBe(validOverrideReason);
      expect(issueRes.body.issuance.signatory_name_snapshot).toBe('HON. ROBERTO C. SANTOS');
      expect(issueRes.body.issuance.signatory_position_snapshot).toBe('Punong Barangay');

      // Check interpolated HTML printable output
      const htmlOutput = issueRes.body.html;
      expect(htmlOutput).toMatch(/ELENA/i);
      expect(htmlOutput).toMatch(/MARASIGAN/i);
      // Zero unreplaced template placeholders
      expect(/\{\{\s*[\w.]+\s*\}\}/.test(htmlOutput)).toBe(false);
    });

    it('Step 6 (Blotter Settlement & Gatekeeper Clearance): Lupon settles blotter case and Gatekeeper clears resident', async () => {
      // Settle case
      const settleRes = await request(app)
        .put(`/api/blotter/${activeBlotterId}`)
        .set('Authorization', `Bearer ${luponToken}`)
        .set('X-Forwarded-For', '192.168.1.22')
        .send({
          status: 'Settled',
          settlement_notes: 'Amicably settled during Lupon mediation hearing with agreed boundary survey'
        })
        .expect(200);

      expect(settleRes.body.status).toBe('Settled');
      expect(settleRes.body.settlement_notes).toContain('Amicably settled during Lupon mediation');

      // Re-query blotter gatekeeper check for resident
      const recheckRes = await request(app)
        .get(`/api/residents/${elenaResidentId}/blotter-check`)
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      expect(recheckRes.body.cleared).toBe(true);
      expect(recheckRes.body.cases).toEqual([]);
    });

    it('Step 7 (Admin Transparency Audit Trail & JSON Diff Verification): Admin inspects audit trail and validates immutability', async () => {
      const logsRes = await request(app)
        .get('/api/audit-logs?limit=50')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logs = logsRes.body.data;
      expect(Array.isArray(logs)).toBe(true);

      // 0. LOGIN audit log entries for authenticated staff accounts
      const loginLogs = logs.filter((l: any) => l.action === 'LOGIN' && l.entity_type === 'user');
      expect(loginLogs.length).toBeGreaterThanOrEqual(1);

      const loggedInUsers = loginLogs.map((l: any) => l.username_snapshot);
      expect(loggedInUsers).toContain('admin');
      expect(loggedInUsers).toContain('e2e_clerk');
      expect(loggedInUsers).toContain('e2e_lupon');
      expect(loggedInUsers).toContain('e2e_treasurer');

      // 1. Resident CREATE log
      const resCreateLog = logs.find((l: any) => l.entity_type === 'resident' && l.action === 'CREATE' && l.entity_id === elenaResidentId);
      expect(resCreateLog).toBeDefined();
      expect(resCreateLog.client_ip).toBe('192.168.1.21');

      // 2. Resident UPDATE log with fine-grained JSON diff
      const resUpdateLog = logs.find((l: any) => l.entity_type === 'resident' && l.action === 'UPDATE' && l.entity_id === elenaResidentId);
      expect(resUpdateLog).toBeDefined();
      const oldDiff = JSON.parse(resUpdateLog.old_data_json);
      const newDiff = JSON.parse(resUpdateLog.new_data_json);

      expect(oldDiff).toHaveProperty('occupation');
      expect(oldDiff).toHaveProperty('contact_no');
      expect(newDiff).toHaveProperty('occupation', 'Master Dressmaker');
      expect(newDiff).toHaveProperty('contact_no', '09179998888');

      // Assert unchanged fields are strictly excluded
      expect(oldDiff.first_name).toBeUndefined();
      expect(newDiff.first_name).toBeUndefined();
      expect(oldDiff.birthdate).toBeUndefined();
      expect(newDiff.birthdate).toBeUndefined();

      // 3. Blotter CREATE and UPDATE logs
      const blotterCreateLog = logs.find((l: any) => l.entity_type === 'blotter' && l.action === 'CREATE' && l.entity_id === activeBlotterId);
      expect(blotterCreateLog).toBeDefined();
      expect(blotterCreateLog.client_ip).toBe('192.168.1.22');

      const blotterUpdateLog = logs.find((l: any) => l.entity_type === 'blotter' && l.action === 'UPDATE' && l.entity_id === activeBlotterId);
      expect(blotterUpdateLog).toBeDefined();
      const blotterNewDiff = JSON.parse(blotterUpdateLog.new_data_json);
      expect(blotterNewDiff.status).toBe('Settled');

      // 4. Issuance PRINT_CERTIFICATE and BLOTTER_OVERRIDE logs
      const printLog = logs.find((l: any) => l.entity_type === 'issuance' && l.action === 'PRINT_CERTIFICATE' && l.entity_id === issuedCertId);
      expect(printLog).toBeDefined();
      expect(printLog.summary_text).toContain(generatedControlNumber);

      const overrideLog = logs.find((l: any) => l.entity_type === 'issuance' && l.action === 'BLOTTER_OVERRIDE' && l.entity_id === issuedCertId);
      expect(overrideLog).toBeDefined();
      expect(overrideLog.new_data_json).toContain('urgent medical hospitalization');

      // 5. Immutability checks: PUT & DELETE on audit-logs must be rejected
      await request(app)
        .put(`/api/audit-logs/${resCreateLog.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ summary_text: 'Tampered summary' })
        .expect((res) => {
          expect([404, 405]).toContain(res.status);
        });

      await request(app)
        .delete(`/api/audit-logs/${resCreateLog.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect((res) => {
          expect([404, 405]).toContain(res.status);
        });
    });
  });

  // ==========================================================================
  // Test 2: Multi-Desk LAN Concurrency & Distinct Workstation IP Attribution Test
  // ==========================================================================
  describe('2. Multi-Desk LAN Concurrency & Distinct Workstation IP Attribution Test', () => {
    it('verifies server binds to 0.0.0.0 and serves endpoints over network interface', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const tempServer = startServer(0, '0.0.0.0');
      await new Promise<void>((resolve) => {
        tempServer.on('listening', () => resolve());
      });
      const address = tempServer.address() as any;
      expect(address).not.toBeNull();
      const assignedPort = address.port;

      expect(address.address).toBe('0.0.0.0');
      expect(assignedPort).toBeGreaterThan(0);

      try {
        function makeGetRequest(reqPath: string, headers: http.OutgoingHttpHeaders = {}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
          return new Promise((resolve, reject) => {
            const req = http.request(
              {
                hostname: '127.0.0.1',
                port: assignedPort,
                path: reqPath,
                method: 'GET',
                headers
              },
              (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                  resolve({
                    statusCode: res.statusCode || 0,
                    headers: res.headers,
                    body: data
                  });
                });
              }
            );
            req.on('error', reject);
            req.end();
          });
        }

        // 1. Verify GET /api/health returns HTTP 200 with { status: 'ok' }
        const healthRes = await makeGetRequest('/api/health');
        expect(healthRes.statusCode).toBe(200);
        const parsedHealth = JSON.parse(healthRes.body);
        expect(parsedHealth.status).toBe('ok');

        // 2. Verify GET /api/system/info with admin token returns 200 with lan_ips, db_size_bytes, and settings
        const infoRes = await makeGetRequest('/api/system/info', {
          Authorization: `Bearer ${adminToken}`
        });
        expect(infoRes.statusCode).toBe(200);
        const parsedInfo = JSON.parse(infoRes.body);
        expect(parsedInfo).toHaveProperty('lan_ips');
        expect(Array.isArray(parsedInfo.lan_ips)).toBe(true);
        expect(parsedInfo).toHaveProperty('db_size_bytes');
        expect(parsedInfo).toHaveProperty('settings');

        // 3. Verify production SPA routes (/, /residents, /issue-certificate, /audit-logs) return 200 HTML
        const spaRoutes = ['/', '/residents', '/issue-certificate', '/audit-logs'];
        for (const route of spaRoutes) {
          const spaRes = await makeGetRequest(route);
          expect(spaRes.statusCode).toBe(200);
          expect(spaRes.headers['content-type']).toMatch(/text\/html/);
        }
      } finally {
        process.env.NODE_ENV = origEnv;
        await new Promise<void>((resolve) => tempServer.close(() => resolve()));
      }
    });

    it('simulates concurrent multi-desk requests from distinct workstation LAN IPs and asserts atomic non-colliding control numbers and exact client_ip attribution', async () => {
      // 1. Create 3 clean test residents for concurrent issuances
      const res1 = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'SimDesk1',
          last_name: 'Resident',
          birthdate: '1990-01-01',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1'
        });

      const res2 = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'SimDesk2',
          last_name: 'Resident',
          birthdate: '1992-02-02',
          sex: 'Female',
          civil_status: 'Single',
          purok: 'Purok 2'
        });

      const res3 = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'SimDesk3',
          last_name: 'Resident',
          birthdate: '1994-03-03',
          sex: 'Male',
          civil_status: 'Married',
          purok: 'Purok 3'
        });

      const id1 = res1.body.id;
      const id2 = res2.body.id;
      const id3 = res3.body.id;

      // 2. Dispatch parallel requests from 4 distinct simulated LAN workstations
      const [issue1, issue2, issue3, blotter4] = await Promise.all([
        request(app)
          .post('/api/issuances')
          .set('Authorization', `Bearer ${clerkToken}`)
          .set('X-Forwarded-For', '192.168.1.101')
          .send({
            resident_id: id1,
            template_id: clearanceTemplateId,
            purpose: 'LAN Workstation 1 Application',
            signatory_official_id: captainOfficialId
          }),
        request(app)
          .post('/api/issuances')
          .set('Authorization', `Bearer ${treasurerToken}`)
          .set('X-Forwarded-For', '192.168.1.102')
          .send({
            resident_id: id2,
            template_id: clearanceTemplateId,
            purpose: 'LAN Workstation 2 Application',
            signatory_official_id: captainOfficialId
          }),
        request(app)
          .post('/api/issuances')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('X-Forwarded-For', '192.168.1.103')
          .send({
            resident_id: id3,
            template_id: clearanceTemplateId,
            purpose: 'LAN Workstation 3 Application',
            signatory_official_id: captainOfficialId
          }),
        request(app)
          .post('/api/blotter')
          .set('Authorization', `Bearer ${luponToken}`)
          .set('X-Forwarded-For', '192.168.1.104')
          .send({
            complainant_name: 'LAN Workstation 4 Complainant',
            respondent_name: 'SimDesk1 Resident',
            incident_type: 'Public Disturbance',
            incident_details: 'Simulated parallel noise dispute from Workstation 4',
            respondent_id: id1
          })
      ]);

      expect(issue1.status).toBe(201);
      expect(issue2.status).toBe(201);
      expect(issue3.status).toBe(201);
      expect(blotter4.status).toBe(201);

      const ctrl1 = issue1.body.issuance.control_number;
      const ctrl2 = issue2.body.issuance.control_number;
      const ctrl3 = issue3.body.issuance.control_number;

      // Assert all 3 control numbers are strictly unique and non-colliding
      const controlSet = new Set([ctrl1, ctrl2, ctrl3]);
      expect(controlSet.size).toBe(3);

      // Verify exact per-workstation client_ip attribution in audit_logs for all 4 workstations
      const auditLog1 = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE entity_type = 'issuance' AND entity_id = ? AND action = 'PRINT_CERTIFICATE'
      `).get(issue1.body.issuance.id) as any;
      expect(auditLog1.client_ip).toBe('192.168.1.101');

      const auditLog2 = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE entity_type = 'issuance' AND entity_id = ? AND action = 'PRINT_CERTIFICATE'
      `).get(issue2.body.issuance.id) as any;
      expect(auditLog2.client_ip).toBe('192.168.1.102');

      const auditLog3 = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE entity_type = 'issuance' AND entity_id = ? AND action = 'PRINT_CERTIFICATE'
      `).get(issue3.body.issuance.id) as any;
      expect(auditLog3.client_ip).toBe('192.168.1.103');

      const auditLog4 = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE entity_type = 'blotter' AND entity_id = ? AND action = 'CREATE'
      `).get(blotter4.body.id) as any;
      expect(auditLog4.client_ip).toBe('192.168.1.104');
    });
  });

  // ==========================================================================
  // Test 3: Cross-Role RBAC Matrix Enforcement E2E Test
  // ==========================================================================
  describe('3. Cross-Role RBAC Matrix Enforcement E2E Test', () => {
    it('enforces RBAC barriers for Lupon role (blocks resident creation, certificate issuance, and excel export with 403 Forbidden)', async () => {
      // 1. Lupon blocked from creating residents
      const residentRes = await request(app)
        .post('/api/residents')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          first_name: 'Unauthorized',
          last_name: 'LuponAttempt',
          birthdate: '1990-01-01',
          sex: 'Male',
          civil_status: 'Single',
          purok: 'Purok 1'
        });
      expect(residentRes.status).toBe(403);

      // 2. Lupon blocked from issuing certificates
      const issuanceRes = await request(app)
        .post('/api/issuances')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({
          resident_id: elenaResidentId,
          template_id: clearanceTemplateId,
          purpose: 'Unauthorized Issuance',
          signatory_official_id: captainOfficialId
        });
      expect(issuanceRes.status).toBe(403);

      // 3. Lupon blocked from exporting Excel masterlist
      const excelRes = await request(app)
        .get('/api/residents/export-excel')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(excelRes.status).toBe(403);
    });

    it('enforces RBAC barriers for Clerk and Treasurer roles (blocks blotter creation, template updates, official roster, audit logs, and backups with 403 Forbidden)', async () => {
      for (const token of [clerkToken, treasurerToken]) {
        // 1. Blocked from filing blotter cases
        const blotterRes = await request(app)
          .post('/api/blotter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            complainant_name: 'Test Complainant',
            respondent_name: 'Test Respondent',
            incident_type: 'Noise Complaint',
            incident_details: 'Unauthorized filing attempt'
          });
        expect(blotterRes.status).toBe(403);

        // 2. Blocked from modifying certificate templates
        const templateRes = await request(app)
          .put(`/api/templates/${clearanceTemplateId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ template_name: 'Hacked Template Name' });
        expect(templateRes.status).toBe(403);

        // 3. Blocked from adding barangay officials
        const officialRes = await request(app)
          .post('/api/officials')
          .set('Authorization', `Bearer ${token}`)
          .send({
            full_name: 'HON. IMPOSTOR OFFICIAL',
            position: 'Sangguniang Barangay Member',
            rank_order: 99
          });
        expect(officialRes.status).toBe(403);

        // 4. Blocked from viewing transparency audit logs
        const auditRes = await request(app)
          .get('/api/audit-logs')
          .set('Authorization', `Bearer ${token}`);
        expect(auditRes.status).toBe(403);

        // 5. Blocked from triggering system database hot backups
        const backupRes = await request(app)
          .post('/api/system/backup')
          .set('Authorization', `Bearer ${token}`);
        expect(backupRes.status).toBe(403);
      }
    });

    it('enforces authentication barrier for unauthenticated requests with 401 Unauthorized', async () => {
      const endpoints = [
        { method: 'get', url: '/api/residents' },
        { method: 'post', url: '/api/residents' },
        { method: 'post', url: '/api/issuances' },
        { method: 'get', url: '/api/audit-logs' },
        { method: 'post', url: '/api/blotter' },
        { method: 'post', url: '/api/system/backup' }
      ];

      for (const ep of endpoints) {
        const res = await (request(app) as any)[ep.method](ep.url);
        expect(res.status).toBe(401);
      }
    });
  });

  // ==========================================================================
  // Test 4: 100% Offline Air-Gapped Production Bundle & Static Serving Audit Test
  // ==========================================================================
  describe('4. 100% Offline Air-Gapped Production Bundle & Static Serving Audit Test', () => {
    it('scans client/index.html, client/src/**/ and client/dist/**/ to assert zero remote CDNs, font URLs, or external asset links exist', () => {
      const clientDir = path.resolve(rootDir, 'client');
      const clientDistDir = path.join(clientDir, 'dist');
      const clientSrcDir = path.join(clientDir, 'src');
      const clientIndexHtml = path.join(clientDir, 'index.html');

      expect(fs.existsSync(clientDistDir)).toBe(true);
      expect(fs.existsSync(clientSrcDir)).toBe(true);
      expect(fs.existsSync(clientIndexHtml)).toBe(true);

      function getAllFiles(dir: string, fileList: string[] = []): string[] {
        if (!fs.existsSync(dir)) return fileList;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            getAllFiles(fullPath, fileList);
          } else {
            fileList.push(fullPath);
          }
        }
        return fileList;
      }

      const filesToScan = [
        clientIndexHtml,
        ...getAllFiles(clientSrcDir),
        ...getAllFiles(clientDistDir)
      ];
      expect(filesToScan.length).toBeGreaterThanOrEqual(10);

      const htmlAttrRegex = /(?:href|src|url)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
      const cssUrlRegex = /url\s*\(\s*['"]?(https?:\/\/[^'")]+)['"]?\)/gi;
      const cssImportRegex = /@import\s+['"](https?:\/\/[^'"]+)['"]/gi;

      const fontCdnPatterns = [
        /fonts\.googleapis\.com/i,
        /fonts\.gstatic\.com/i,
        /cdnjs\.cloudflare\.com/i,
        /cdn\.jsdelivr\.net/i,
        /unpkg\.com/i
      ];

      const violations: { file: string; match: string }[] = [];

      for (const filePath of filesToScan) {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.html', '.js', '.css', '.ts', '.tsx'].includes(ext)) continue;

        const content = fs.readFileSync(filePath, 'utf-8');

        // 1. Check for remote CDN hostnames anywhere in file
        for (const pat of fontCdnPatterns) {
          if (pat.test(content)) {
            violations.push({ file: path.relative(rootDir, filePath), match: pat.toString() });
          }
        }

        // 2. Check for remote URLs in HTML attributes
        let match: RegExpExecArray | null;
        htmlAttrRegex.lastIndex = 0;
        while ((match = htmlAttrRegex.exec(content)) !== null) {
          const url = match[1];
          if (url.includes('www.w3.org/2000/svg')) continue;
          if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
            violations.push({ file: path.relative(rootDir, filePath), match: url });
          }
        }

        // 3. Check for CSS url(...) declarations
        cssUrlRegex.lastIndex = 0;
        while ((match = cssUrlRegex.exec(content)) !== null) {
          const url = match[1];
          if (url.includes('www.w3.org/2000/svg')) continue;
          if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
            violations.push({ file: path.relative(rootDir, filePath), match: url });
          }
        }

        // 4. Check for CSS @import statements
        cssImportRegex.lastIndex = 0;
        while ((match = cssImportRegex.exec(content)) !== null) {
          const url = match[1];
          if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
            violations.push({ file: path.relative(rootDir, filePath), match: url });
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('in production mode, serves production SPA index.html for client routes and returns 404 JSON for unknown API routes', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const spaRoutes = [
          '/',
          '/residents',
          '/issue-certificate',
          '/blotter',
          '/officials',
          '/templates',
          '/audit-logs',
          '/settings'
        ];

        for (const route of spaRoutes) {
          const res = await request(app).get(route);
          expect(res.status).toBe(200);
          expect(res.headers['content-type']).toMatch(/text\/html/);
        }

        // Unknown API route returns 404 JSON
        const unknownApiRes = await request(app).get('/api/nonexistent-route');
        expect(unknownApiRes.status).toBe(404);
        expect(unknownApiRes.headers['content-type']).toMatch(/application\/json/);
        expect(unknownApiRes.body).toEqual({ error: 'Endpoint not found' });
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ==========================================================================
  // Test 5: Concurrent Read Load Hot Backup & Standalone SQLite Restoration Test
  // ==========================================================================
  describe('5. Concurrent Read Load Hot Backup & Standalone SQLite Restoration Test', () => {
    it('triggers hot backup during concurrent read operations, asserting zero corruption, valid streaming headers, and 100% data fidelity on standalone restore', async () => {
      // 1. Execute concurrent read requests alongside the hot backup operation
      const [backupRes, readRes1, readRes2, readRes3] = await Promise.all([
        request(app)
          .post('/api/system/backup')
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .get('/api/residents?limit=10')
          .set('Authorization', `Bearer ${clerkToken}`),
        request(app)
          .get('/api/residents/stats')
          .set('Authorization', `Bearer ${clerkToken}`),
        request(app)
          .get('/api/issuances?limit=10')
          .set('Authorization', `Bearer ${clerkToken}`)
      ]);

      // Assert concurrent reads succeeded with HTTP 200
      expect(readRes1.status).toBe(200);
      expect(readRes2.status).toBe(200);
      expect(readRes3.status).toBe(200);

      // Assert backup response headers
      expect(backupRes.status).toBe(200);
      expect(backupRes.headers['content-type']).toBe('application/x-sqlite3');
      expect(backupRes.headers['content-disposition']).toMatch(/attachment;\s*filename="barangay_backup_\d{8}_\d{6}\.sqlite"/);

      // Extract backup filename and path
      const match = backupRes.headers['content-disposition'].match(/filename="([^"]+)"/);
      expect(match).toBeTruthy();
      const backupFilename = match![1];
      const candidatePaths = [
        path.join(process.cwd(), 'data/backups', backupFilename),
        path.join(rootDir, 'data/backups', backupFilename),
        path.join(rootDir, 'server/data/backups', backupFilename)
      ];
      const backupFilePath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
      createdBackupFiles.push(backupFilePath);

      // Assert backup file physically created on disk with size > 0
      expect(fs.existsSync(backupFilePath)).toBe(true);
      const stats = fs.statSync(backupFilePath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify SYSTEM_BACKUP audit log in live database
      const backupAudit = db.prepare(`
        SELECT action, entity_type, summary_text
        FROM audit_logs
        WHERE action = 'SYSTEM_BACKUP'
        ORDER BY id DESC LIMIT 1
      `).get() as any;
      expect(backupAudit).toBeDefined();
      expect(backupAudit.action).toBe('SYSTEM_BACKUP');
      expect(backupAudit.summary_text).toContain(backupFilename);

      // 2. Open generated backup file as independent standalone database (Restoration Drill)
      const standaloneDb = new Database(backupFilePath, { readonly: true });

      // Run PRAGMA integrity_check
      const integrity = standaloneDb.pragma('integrity_check') as any[];
      expect(integrity.length).toBe(1);
      expect(integrity[0].integrity_check).toBe('ok');

      // Verify all 8 core tables exist and retain exact data
      const tables = [
        'barangay_officials',
        'users',
        'residents',
        'blotter_records',
        'certificate_templates',
        'certificate_issuances',
        'audit_logs',
        'system_settings'
      ];

      for (const table of tables) {
        const countRow = standaloneDb.prepare(`SELECT count(*) as count FROM ${table}`).get() as any;
        expect(countRow.count).toBeGreaterThan(0);
      }

      // Assert newly created resident exists in backup
      const elenaInBackup = standaloneDb.prepare('SELECT * FROM residents WHERE id = ?').get(elenaResidentId) as any;
      expect(elenaInBackup).toBeDefined();
      expect(elenaInBackup.first_name).toBe('Elena');
      expect(elenaInBackup.last_name).toBe('Marasigan');
      expect(elenaInBackup.occupation).toBe('Master Dressmaker');

      // Assert newly created blotter record exists in backup
      const blotterInBackup = standaloneDb.prepare('SELECT * FROM blotter_records WHERE id = ?').get(activeBlotterId) as any;
      expect(blotterInBackup).toBeDefined();
      expect(blotterInBackup.case_number).toBe(generatedCaseNumber);
      expect(blotterInBackup.status).toBe('Settled');

      // Assert newly created certificate issuance exists in backup
      const certInBackup = standaloneDb.prepare('SELECT * FROM certificate_issuances WHERE id = ?').get(issuedCertId) as any;
      expect(certInBackup).toBeDefined();
      expect(certInBackup.control_number).toBe(generatedControlNumber);
      expect(certInBackup.had_active_blotter).toBe(1);

      standaloneDb.close();
    });
  });

  // ==========================================================================
  // Test 6: Windows 1-Click Launcher & Documentation Integrity Test
  // ==========================================================================
  describe('6. Windows 1-Click Launcher & Documentation Integrity Test', () => {
    it('verifies start-server.bat exists and contains node detection, browser trigger, and production startup', () => {
      const batPath = path.join(rootDir, 'start-server.bat');
      expect(fs.existsSync(batPath)).toBe(true);

      const content = fs.readFileSync(batPath, 'utf-8');
      expect(content).toContain('where node');
      expect(content).toContain('http://localhost:3000');
      expect(content).toContain('node server\\dist\\index.js');
      expect(content).toContain('set NODE_ENV=production');
    });

    it('verifies start-hidden.vbs exists and launches start-server.bat silently with hidden window', () => {
      const vbsPath = path.join(rootDir, 'start-hidden.vbs');
      expect(fs.existsSync(vbsPath)).toBe(true);

      const content = fs.readFileSync(vbsPath, 'utf-8');
      expect(content).toContain('WshShell.Run');
      expect(content).toContain('start-server.bat');
      expect(content).toContain(', 0, False');
    });

    it('verifies README.md exists and contains comprehensive thesis demonstration and operational documentation', () => {
      const readmePath = path.join(rootDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content.length).toBeGreaterThan(500);

      const requiredSections = [
        'Offline',
        'Registry of Barangay Inhabitants',
        'Blotter Gatekeeper',
        '0.0.0.0:3000',
        'start-server.bat',
        'Role-Based Access Control',
        'admin123',
        'WAL',
        'Hot Backup',
        'Thesis'
      ];

      for (const sec of requiredSections) {
        expect(content.toLowerCase()).toContain(sec.toLowerCase());
      }
    });
  });
});
