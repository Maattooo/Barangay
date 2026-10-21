import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import { computeJsonDiff, logAuditEvent } from '../src/services/audit.service';
import { AuditLogEntry } from '../src/types/audit';

describe('Transparency Audit Interceptor & JSON Diff Service Suite (audit.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_audit_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;
  let adminUserId: number;

  beforeAll(async () => {
    // Ensure clean isolated test database
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

    // Create accounts for all 4 roles
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('audit_clerk', ?, 'Audit Clerk', 'Clerk', 1),
        ('audit_treasurer', ?, 'Audit Treasurer', 'Treasurer', 1),
        ('audit_lupon', ?, 'Audit Lupon', 'Lupon', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        is_active = excluded.is_active
    `).run(passHash, passHash, passHash);

    // Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;
    adminUserId = adminLogin.body.user.id;

    // Authenticate Clerk
    const clerkLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'audit_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    // Authenticate Treasurer
    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'audit_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    // Authenticate Lupon
    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'audit_lupon', password: 'matrix_pass_123' });
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

  // =========================================================================
  // 1. JSON Diff Service Unit Tests (computeJsonDiff)
  // =========================================================================
  describe('1. JSON Diff Service Unit Tests (computeJsonDiff)', () => {
    it('Single Field Change Test: Compares { full_name: "Juan", role: "Clerk" } and { full_name: "Juanito", role: "Clerk" }', () => {
      const oldObj = { full_name: 'Juan', role: 'Clerk' };
      const newObj = { full_name: 'Juanito', role: 'Clerk' };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys).toEqual(['full_name']);
      expect(diff.oldDiff).toEqual({ full_name: 'Juan' });
      expect(diff.newDiff).toEqual({ full_name: 'Juanito' });
    });

    it('Multiple Fields Change Test: Changes multiple fields; asserts only changed fields appear in both diff objects', () => {
      const oldObj = {
        full_name: 'Juan Dela Cruz',
        role: 'Clerk',
        is_active: 1,
        purok: 'Purok 1'
      };
      const newObj = {
        full_name: 'Juanito Dela Cruz',
        role: 'Treasurer',
        is_active: 1,
        purok: 'Purok 3'
      };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys.sort()).toEqual(['full_name', 'purok', 'role'].sort());
      expect(diff.oldDiff).toEqual({
        full_name: 'Juan Dela Cruz',
        role: 'Clerk',
        purok: 'Purok 1'
      });
      expect(diff.newDiff).toEqual({
        full_name: 'Juanito Dela Cruz',
        role: 'Treasurer',
        purok: 'Purok 3'
      });
      // Unchanged fields like is_active must NOT be present
      expect(diff.oldDiff).not.toHaveProperty('is_active');
      expect(diff.newDiff).not.toHaveProperty('is_active');
    });

    it('Identical Values Test: Compares identical objects; asserts oldDiff and newDiff are null and changedKeys is empty', () => {
      const oldObj = { full_name: 'Maria Santos', role: 'Admin', is_active: 1 };
      const newObj = { full_name: 'Maria Santos', role: 'Admin', is_active: 1 };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys).toEqual([]);
      expect(diff.oldDiff).toBeNull();
      expect(diff.newDiff).toBeNull();
    });

    it('Sensitive Key Omission Test: Updates an object containing password_hash; asserts password_hash is completely omitted from both diffs', () => {
      const oldObj = {
        full_name: 'Pedro Penduko',
        password_hash: '$2a$10$old_salted_hash_here',
        role: 'Lupon'
      };
      const newObj = {
        full_name: 'Pedro Penduko Updated',
        password_hash: '$2a$10$new_salted_hash_here',
        role: 'Lupon'
      };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys).toEqual(['full_name']);
      expect(diff.oldDiff).toEqual({ full_name: 'Pedro Penduko' });
      expect(diff.newDiff).toEqual({ full_name: 'Pedro Penduko Updated' });
      expect(diff.oldDiff).not.toHaveProperty('password_hash');
      expect(diff.newDiff).not.toHaveProperty('password_hash');
    });

    it('Type Discrepancy & Null Handling Test: Modifies a field from null to a string or number; asserts diff accurately captures the transition', () => {
      const oldObj = {
        official_id: null,
        notes: null,
        count: 0
      };
      const newObj = {
        official_id: 5,
        notes: 'Assigned official',
        count: 10
      };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys.sort()).toEqual(['count', 'notes', 'official_id'].sort());
      expect(diff.oldDiff).toEqual({
        official_id: null,
        notes: null,
        count: 0
      });
      expect(diff.newDiff).toEqual({
        official_id: 5,
        notes: 'Assigned official',
        count: 10
      });
    });

    it('Key Order Invariance Test: Compares { meta: { x: 10, y: 20 } } and { meta: { y: 20, x: 10 } }', () => {
      const oldObj = { meta: { x: 10, y: 20 } };
      const newObj = { meta: { y: 20, x: 10 } };

      const diff = computeJsonDiff(oldObj, newObj);

      expect(diff.changedKeys).toEqual([]);
      expect(diff.oldDiff).toBeNull();
      expect(diff.newDiff).toBeNull();
    });

    it('Null vs Undefined Normalization Test: Handles null vs undefined omission without phantom diffs', () => {
      const diff1 = computeJsonDiff({ official_id: null }, {});
      expect(diff1.changedKeys).toEqual([]);
      expect(diff1.oldDiff).toBeNull();
      expect(diff1.newDiff).toBeNull();

      const diff2 = computeJsonDiff({ official_id: 5 }, {});
      expect(diff2.changedKeys).toEqual(['official_id']);
      expect(diff2.oldDiff).toEqual({ official_id: 5 });
      expect(diff2.newDiff).toEqual({ official_id: null });
    });

    it('NaN and Undefined/Null Normalization Test: Handles NaN values and missing vs null fields correctly', () => {
      const oldObj = { count: NaN, unassigned: undefined };
      const newObj = { count: NaN, unassigned: null };

      const diff = computeJsonDiff(oldObj, newObj);
      expect(diff.changedKeys).toEqual([]);
      expect(diff.oldDiff).toBeNull();
      expect(diff.newDiff).toBeNull();
    });
  });

  // =========================================================================
  // 2. Audit Logging Service Unit Tests (logAuditEvent)
  // =========================================================================
  describe('2. Audit Logging Service Unit Tests (logAuditEvent)', () => {
    it('Valid Insert Test: Calls logAuditEvent with action: "CREATE", entity_type: "user". Asserts SQLite row created with correct snapshots, IP, and timestamp', () => {
      const insertId = logAuditEvent({
        userId: adminUserId,
        username: 'admin',
        userRole: 'Admin',
        action: 'CREATE',
        entityType: 'user',
        entityId: 999,
        summaryText: 'Created user test_unit with role Clerk',
        newData: { username: 'test_unit', full_name: 'Unit Tester', role: 'Clerk' },
        clientIp: '192.168.1.50'
      });

      expect(typeof insertId).toBe('number');
      expect(insertId).toBeGreaterThan(0);

      const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(insertId) as AuditLogEntry;
      expect(row).toBeDefined();
      expect(row.user_id).toBe(adminUserId);
      expect(row.username_snapshot).toBe('admin');
      expect(row.user_role_snapshot).toBe('Admin');
      expect(row.action).toBe('CREATE');
      expect(row.entity_type).toBe('user');
      expect(row.entity_id).toBe(999);
      expect(row.summary_text).toBe('Created user test_unit with role Clerk');
      expect(row.old_data_json).toBeNull();
      expect(row.new_data_json).toBe(JSON.stringify({ username: 'test_unit', full_name: 'Unit Tester', role: 'Clerk' }));
      expect(row.client_ip).toBe('192.168.1.50');
      expect(row.created_at).toBeDefined();
    });

    it('Invalid Enum Rejection Test: Attempts to log an invalid action (e.g. "DESTROY"); asserts error is thrown and no row is inserted', () => {
      const countBefore = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;

      expect(() => {
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'DESTROY' as any,
          entityType: 'user',
          summaryText: 'Attempting invalid action'
        });
      }).toThrow(/Invalid audit action/);

      expect(() => {
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'CREATE',
          entityType: 'non_existent_entity' as any,
          summaryText: 'Attempting invalid entity type'
        });
      }).toThrow(/Invalid audit entity_type/);

      const countAfter = (db.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as { count: number }).count;
      expect(countAfter).toBe(countBefore);
    });

    it('Missing/Invalid Required Parameters Test: Rejects missing userId, username, or summaryText', () => {
      expect(() => {
        logAuditEvent({
          userId: 'invalid' as any,
          username: 'admin',
          userRole: 'Admin',
          action: 'CREATE',
          entityType: 'user',
          summaryText: 'Test'
        });
      }).toThrow(/valid numeric userId/);

      expect(() => {
        logAuditEvent({
          userId: adminUserId,
          username: '',
          userRole: 'Admin',
          action: 'CREATE',
          entityType: 'user',
          summaryText: 'Test'
        });
      }).toThrow(/valid username snapshot/);

      expect(() => {
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'CREATE',
          entityType: 'user',
          summaryText: '   '
        });
      }).toThrow(/valid summaryText/);
    });
  });

  // =========================================================================
  // 3. Audit Log Inspection Endpoint Tests (GET /api/audit-logs)
  // =========================================================================
  describe('3. Audit Log Inspection Endpoint Tests (GET /api/audit-logs)', () => {
    describe('RBAC Protection Test', () => {
      it('Authenticated Admin asserts HTTP 200', async () => {
        const res = await request(app)
          .get('/api/audit-logs')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
      });

      it('Authenticated Clerk asserts HTTP 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/audit-logs')
          .set('Authorization', `Bearer ${clerkToken}`)
          .expect(403);

        expect(res.body).toHaveProperty('error');
      });

      it('Authenticated Treasurer asserts HTTP 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/audit-logs')
          .set('Authorization', `Bearer ${treasurerToken}`)
          .expect(403);

        expect(res.body).toHaveProperty('error');
      });

      it('Authenticated Lupon asserts HTTP 403 Forbidden', async () => {
        const res = await request(app)
          .get('/api/audit-logs')
          .set('Authorization', `Bearer ${luponToken}`)
          .expect(403);

        expect(res.body).toHaveProperty('error');
      });

      it('Unauthenticated request asserts HTTP 401 Unauthorized', async () => {
        const res = await request(app)
          .get('/api/audit-logs')
          .expect(401);

        expect(res.body).toHaveProperty('error');
      });
    });

    describe('Pagination Test', () => {
      beforeAll(() => {
        // Clear table and insert exactly 25 known audit entries
        db.prepare('DELETE FROM audit_logs').run();

        const insertStmt = db.prepare(`
          INSERT INTO audit_logs (
            user_id, username_snapshot, user_role_snapshot, action, entity_type, entity_id,
            summary_text, client_ip, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `);

        for (let i = 1; i <= 25; i++) {
          insertStmt.run(
            adminUserId,
            'admin',
            'Admin',
            'UPDATE',
            'resident',
            i,
            `Pagination Seed Record #${i}`,
            '127.0.0.1'
          );
        }
      });

      it('Requests page=1&limit=10; asserts 10 items returned with { page: 1, limit: 10, total: 25, totalPages: 3 }', async () => {
        const res = await request(app)
          .get('/api/audit-logs?page=1&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBe(10);
        expect(res.body.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3
        });
      });

      it('Requests page=3&limit=10; asserts 5 items returned', async () => {
        const res = await request(app)
          .get('/api/audit-logs?page=3&limit=10')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBe(5);
        expect(res.body.pagination).toEqual({
          page: 3,
          limit: 10,
          total: 25,
          totalPages: 3
        });
      });
    });

    describe('Filtering Test', () => {
      beforeAll(() => {
        // Clear and seed specific entries for each filter test
        db.prepare('DELETE FROM audit_logs').run();

        // 1. LOGIN action by admin
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'LOGIN',
          entityType: 'user',
          entityId: adminUserId,
          summaryText: 'User admin logged in from terminal'
        });

        // 2. CREATE resident by admin
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'CREATE',
          entityType: 'resident',
          entityId: 101,
          summaryText: 'Created resident Juan Dela Cruz',
          newData: { first_name: 'Juan', last_name: 'Dela Cruz' }
        });

        // 3. UPDATE blotter by another user (clerk)
        const clerkUser = db.prepare("SELECT id FROM users WHERE username = 'audit_clerk'").get() as { id: number };
        logAuditEvent({
          userId: clerkUser.id,
          username: 'audit_clerk',
          userRole: 'Clerk',
          action: 'UPDATE',
          entityType: 'blotter',
          entityId: 202,
          summaryText: 'Updated blotter case #202 status to Settled',
          oldData: { status: 'Active' },
          newData: { status: 'Settled' }
        });

        // 4. PRINT_CERTIFICATE issuance by admin
        logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'PRINT_CERTIFICATE',
          entityType: 'issuance',
          entityId: 303,
          summaryText: 'Issued Certificate of Residency for resident 101'
        });
      });

      it('Filter by action=LOGIN: Asserts all returned records have action === "LOGIN"', async () => {
        const res = await request(app)
          .get('/api/audit-logs?action=LOGIN')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        for (const log of res.body.data) {
          expect(log.action).toBe('LOGIN');
        }
      });

      it('Filter by entity_type=user: Asserts all returned records have entity_type === "user"', async () => {
        const res = await request(app)
          .get('/api/audit-logs?entity_type=user')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        for (const log of res.body.data) {
          expect(log.entity_type).toBe('user');
        }
      });

      it('Filter by user_id: Asserts only records created by that user are returned', async () => {
        const clerkUser = db.prepare("SELECT id FROM users WHERE username = 'audit_clerk'").get() as { id: number };

        const res = await request(app)
          .get(`/api/audit-logs?user_id=${clerkUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].user_id).toBe(clerkUser.id);
        expect(res.body.data[0].username_snapshot).toBe('audit_clerk');
      });

      it('Filter by date range (start_date, end_date): Asserts timestamps fall within boundary', async () => {
        const today = (db.prepare("SELECT date('now', 'localtime') as today").get() as any).today;

        const res = await request(app)
          .get(`/api/audit-logs?start_date=${today}&end_date=${today}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBe(4);
        for (const log of res.body.data) {
          expect(log.created_at.startsWith(today)).toBe(true);
        }

        // Test boundary that yields no records (past year)
        const pastRes = await request(app)
          .get('/api/audit-logs?start_date=2020-01-01&end_date=2020-01-02')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(pastRes.body.data.length).toBe(0);
        expect(pastRes.body.pagination.total).toBe(0);
      });

      it('Search query (search=admin): Asserts matching summary_text or username_snapshot', async () => {
        const res = await request(app)
          .get('/api/audit-logs?search=admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.length).toBeGreaterThan(0);
        for (const log of res.body.data) {
          const matched =
            log.summary_text.toLowerCase().includes('admin') ||
            log.username_snapshot.toLowerCase().includes('admin');
          expect(matched).toBe(true);
        }
      });

      it('Adversarial Query Parameters Test: Rejects invalid action, entity_type, user_id, and malformed dates with HTTP 400', async () => {
        await request(app)
          .get('/api/audit-logs?action=DESTROY')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(app)
          .get('/api/audit-logs?entity_type=superhero')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(app)
          .get('/api/audit-logs?user_id=invalid_id')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(app)
          .get('/api/audit-logs?user_id=-5')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(app)
          .get('/api/audit-logs?start_date=not-a-valid-date')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        await request(app)
          .get('/api/audit-logs?end_date=2026-13-45')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });
    });

    describe('Single Log Retrieval Test (GET /api/audit-logs/:id)', () => {
      let sampleLogId: number;

      beforeAll(() => {
        sampleLogId = logAuditEvent({
          userId: adminUserId,
          username: 'admin',
          userRole: 'Admin',
          action: 'SYSTEM_BACKUP',
          entityType: 'official',
          entityId: 1,
          summaryText: 'Single log retrieval fixture'
        });
      });

      it('Valid ID returns HTTP 200 with entry details', async () => {
        const res = await request(app)
          .get(`/api/audit-logs/${sampleLogId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.id).toBe(sampleLogId);
        expect(res.body.action).toBe('SYSTEM_BACKUP');
        expect(res.body.summary_text).toBe('Single log retrieval fixture');
      });

      it('Invalid ID returns HTTP 404', async () => {
        const res = await request(app)
          .get('/api/audit-logs/999999')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);

        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toContain('not found');
      });

      it('Malformed non-integer ID returns HTTP 400', async () => {
        const res = await request(app)
          .get('/api/audit-logs/not-a-number')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);

        expect(res.body).toHaveProperty('error');
      });
    });
  });

  // =========================================================================
  // 4. Integration with User Mutation Endpoints
  // =========================================================================
  describe('4. Integration with User Mutation Endpoints', () => {
    it('Admin calls PUT /api/users/:id changing only full_name; verifies diff only contains changed property', async () => {
      // 1. Create a user to test fine-grained update
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'diff_target_user',
          password: 'Password123!',
          full_name: 'Original Full Name',
          role: 'Clerk'
        })
        .expect(201);

      const targetUserId = createRes.body.id;

      // 2. Update ONLY full_name
      const updateRes = await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Updated Unique Full Name'
        })
        .expect(200);

      expect(updateRes.body.full_name).toBe('Updated Unique Full Name');

      // 3. Query GET /api/audit-logs for the latest UPDATE entry for this user
      const logsRes = await request(app)
        .get(`/api/audit-logs?action=UPDATE&entity_type=user`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updateLog = logsRes.body.data.find(
        (log: AuditLogEntry) => log.entity_id === targetUserId
      );

      expect(updateLog).toBeDefined();
      expect(updateLog.action).toBe('UPDATE');
      expect(updateLog.entity_type).toBe('user');
      expect(updateLog.entity_id).toBe(targetUserId);

      // 4. Asserts old_data_json contains strictly {"full_name":"<old>"}
      // and new_data_json contains strictly {"full_name":"<new>"}
      // (excluding role, is_active, official_id, and password_hash)
      const parsedOld = JSON.parse(updateLog.old_data_json);
      const parsedNew = JSON.parse(updateLog.new_data_json);

      expect(parsedOld).toEqual({ full_name: 'Original Full Name' });
      expect(parsedNew).toEqual({ full_name: 'Updated Unique Full Name' });

      expect(parsedOld).not.toHaveProperty('role');
      expect(parsedOld).not.toHaveProperty('is_active');
      expect(parsedOld).not.toHaveProperty('official_id');
      expect(parsedOld).not.toHaveProperty('password_hash');

      expect(parsedNew).not.toHaveProperty('role');
      expect(parsedNew).not.toHaveProperty('is_active');
      expect(parsedNew).not.toHaveProperty('official_id');
      expect(parsedNew).not.toHaveProperty('password_hash');
    });

    it('Password Reset Audit Summary Test: Admin resets password; summary records (password reset) and diffs remain null', async () => {
      // 1. Create a user to test password reset audit
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'pw_reset_user',
          password: 'OldPassword123!',
          full_name: 'Password Reset Target',
          role: 'Clerk'
        })
        .expect(201);

      const targetUserId = createRes.body.id;

      // 2. Call PUT /api/users/:id with ONLY password
      await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          password: 'newpassword123'
        })
        .expect(200);

      // 3. Retrieve audit log entry
      const logsRes = await request(app)
        .get(`/api/audit-logs?action=UPDATE&entity_type=user`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updateLog = logsRes.body.data.find(
        (log: AuditLogEntry) => log.entity_id === targetUserId
      );

      expect(updateLog).toBeDefined();
      expect(updateLog.summary_text).toContain('(password reset)');
      expect(updateLog.old_data_json).toBeNull();
      expect(updateLog.new_data_json).toBeNull();
    });

    it('Combined Profile & Password Reset Test: Admin updates full_name and password; summary records (profile & password reset)', async () => {
      // 1. Create a user
      const createRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'both_reset_user',
          password: 'OldPassword123!',
          full_name: 'Both Target',
          role: 'Clerk'
        })
        .expect(201);

      const targetUserId = createRes.body.id;

      // 2. Call PUT /api/users/:id with full_name AND password
      await request(app)
        .put(`/api/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Both Target Renamed',
          password: 'newpassword456'
        })
        .expect(200);

      // 3. Retrieve audit log entry
      const logsRes = await request(app)
        .get(`/api/audit-logs?action=UPDATE&entity_type=user`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const updateLog = logsRes.body.data.find(
        (log: AuditLogEntry) => log.entity_id === targetUserId
      );

      expect(updateLog).toBeDefined();
      expect(updateLog.summary_text).toContain('(profile & password reset)');
      expect(JSON.parse(updateLog.old_data_json)).toEqual({ full_name: 'Both Target' });
      expect(JSON.parse(updateLog.new_data_json)).toEqual({ full_name: 'Both Target Renamed' });
      expect(updateLog.old_data_json).not.toContain('password');
      expect(updateLog.new_data_json).not.toContain('password');
    });
  });

  // =========================================================================
  // 5. Immutability Enforcement Test
  // =========================================================================
  describe('5. Immutability Enforcement Test', () => {
    let rowOneId: number;

    beforeAll(() => {
      // Ensure row with id 1 exists
      const existing = db.prepare('SELECT id FROM audit_logs WHERE id = 1').get() as { id: number } | undefined;
      if (!existing) {
        db.prepare(`
          INSERT INTO audit_logs (
            id, user_id, username_snapshot, user_role_snapshot, action, entity_type,
            entity_id, summary_text, client_ip
          ) VALUES (1, ?, 'admin', 'Admin', 'LOGIN', 'user', ?, 'Initial audit log for immutability check', '127.0.0.1')
        `).run(adminUserId, adminUserId);
      }
      rowOneId = 1;
    });

    it('Dispatches DELETE /api/audit-logs/1 and PUT /api/audit-logs/1; asserts HTTP 405 (or 404)', async () => {
      const deleteRes = await request(app)
        .delete(`/api/audit-logs/${rowOneId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([404, 405]).toContain(deleteRes.status);

      const putRes = await request(app)
        .put(`/api/audit-logs/${rowOneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ summary_text: 'Tampered summary text' });

      expect([404, 405]).toContain(putRes.status);
    });

    it('Dispatches POST /api/audit-logs and PATCH /api/audit-logs/1; asserts HTTP 405 (or 404)', async () => {
      const postRes = await request(app)
        .post('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'LOGIN' });

      expect([404, 405]).toContain(postRes.status);

      const patchRes = await request(app)
        .patch(`/api/audit-logs/${rowOneId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ summary_text: 'Patched summary' });

      expect([404, 405]).toContain(patchRes.status);
    });

    it('Verifies that the audit row with ID 1 remains intact in the database', () => {
      const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(rowOneId) as AuditLogEntry;
      expect(row).toBeDefined();
      expect(row.id).toBe(rowOneId);
      expect(row.summary_text).not.toBe('Tampered summary text');
    });

    it('Static Code Analysis: Verifies zero UPDATE or DELETE queries targeting audit_logs exist in server/src', () => {
      const srcDir = path.resolve(__dirname, '../src');

      function scanDir(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            results = results.concat(scanDir(filePath));
          } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            results.push(filePath);
          }
        }
        return results;
      }

      const files = scanDir(srcDir);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(/UPDATE\s+audit_logs/i);
        expect(content).not.toMatch(/DELETE\s+FROM\s+audit_logs/i);
      }
    });
  });
});
