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
import { BarangayOfficial } from '../src/types/officials';

describe('Barangay Officials Roster Test Suite (officials.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_officials_suite.sqlite');

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

    // Create staff users for role testing
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('officials_clerk', ?, 'Clerk Staff', 'Clerk', 1),
        ('officials_treasurer', ?, 'Treasurer Staff', 'Treasurer', 1),
        ('officials_lupon', ?, 'Lupon Staff', 'Lupon', 1)
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
      .send({ username: 'officials_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'officials_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'officials_lupon', password: 'matrix_pass_123' });
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

  describe('1. Hierarchy Ordering & Retrieval', () => {
    it('GET /api/officials returns council members strictly ordered by rank_order ASC', async () => {
      const res = await request(app)
        .get('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(11);

      const officials: BarangayOfficial[] = res.body;

      // Verify strictly ascending order
      for (let i = 0; i < officials.length - 1; i++) {
        expect(officials[i].rank_order).toBeLessThanOrEqual(officials[i + 1].rank_order);
      }

      // Check hierarchy anchors
      expect(officials[0].rank_order).toBe(1);
      expect(officials[0].position).toBe('Punong Barangay');

      const sk = officials.find(o => o.position === 'SK Chairperson');
      expect(sk).toBeDefined();
      expect(sk!.rank_order).toBe(9);

      const sec = officials.find(o => o.position === 'Barangay Secretary');
      expect(sec).toBeDefined();
      expect(sec!.rank_order).toBe(10);

      const treas = officials.find(o => o.position === 'Barangay Treasurer');
      expect(treas).toBeDefined();
      expect(treas!.rank_order).toBe(11);
    });

    it('GET /api/officials is accessible to non-admin staff roles (Clerk, Treasurer, Lupon)', async () => {
      const clerkRes = await request(app)
        .get('/api/officials')
        .set('Authorization', `Bearer ${clerkToken}`);
      expect(clerkRes.status).toBe(200);

      const treasurerRes = await request(app)
        .get('/api/officials')
        .set('Authorization', `Bearer ${treasurerToken}`);
      expect(treasurerRes.status).toBe(200);

      const luponRes = await request(app)
        .get('/api/officials')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(luponRes.status).toBe(200);
    });
  });

  describe('2. Inactive Filtering', () => {
    it('excludes inactive officials by default, but includes them with include_inactive=true', async () => {
      // Create an inactive official
      const insertRes = db.prepare(`
        INSERT INTO barangay_officials (
          full_name, position, rank_order, is_active
        ) VALUES (
          'FORMER OFFICIAL TEST', 'Sangguniang Barangay Member', 99, 0
        )
      `).run();
      const inactiveId = Number(insertRes.lastInsertRowid);

      // Default GET: should NOT include inactive official
      const defaultRes = await request(app)
        .get('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(defaultRes.status).toBe(200);
      const foundDefault = defaultRes.body.find((o: BarangayOfficial) => o.id === inactiveId);
      expect(foundDefault).toBeUndefined();

      // With include_inactive=true: should include inactive official
      const includeRes = await request(app)
        .get('/api/officials?include_inactive=true')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(includeRes.status).toBe(200);
      const foundIncluded = includeRes.body.find((o: BarangayOfficial) => o.id === inactiveId);
      expect(foundIncluded).toBeDefined();
      expect(foundIncluded.full_name).toBe('FORMER OFFICIAL TEST');
      expect(foundIncluded.is_active).toBe(0);
    });
  });

  describe('3. Create Official & Audit Logging', () => {
    it('Admin can add a new official and writes a CREATE audit log', async () => {
      const newOfficialPayload = {
        full_name: 'HON. PEDRO A. PENDUKO',
        position: 'Sangguniang Barangay Member',
        committee: 'Committee on Environmental Protection',
        rank_order: 12,
        term_start: '2023-11-01',
        term_end: '2026-11-01',
        is_active: 1
      };

      const res = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newOfficialPayload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.full_name).toBe('HON. PEDRO A. PENDUKO');
      expect(res.body.position).toBe('Sangguniang Barangay Member');
      expect(res.body.committee).toBe('Committee on Environmental Protection');
      expect(res.body.rank_order).toBe(12);

      // Verify audit log entry
      const auditLog = db.prepare(`
        SELECT action, entity_type, entity_id, summary_text, new_data_json
        FROM audit_logs
        WHERE entity_type = 'official' AND entity_id = ? AND action = 'CREATE'
      `).get(res.body.id) as {
        action: string;
        entity_type: string;
        entity_id: number;
        summary_text: string;
        new_data_json: string;
      } | undefined;

      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe('CREATE');
      expect(auditLog!.entity_type).toBe('official');
      expect(auditLog!.summary_text).toContain('HON. PEDRO A. PENDUKO');
      const parsedNew = JSON.parse(auditLog!.new_data_json);
      expect(parsedNew.full_name).toBe('HON. PEDRO A. PENDUKO');
    });

    it('rejects creation when required fields are missing or invalid', async () => {
      // Missing full_name
      const res1 = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          position: 'Sangguniang Barangay Member',
          rank_order: 15
        });
      expect(res1.status).toBe(400);

      // Invalid position enum
      const res2 = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'TEST PERSON',
          position: 'Invalid Position',
          rank_order: 15
        });
      expect(res2.status).toBe(400);

      // Non-positive or non-integer rank_order
      const res3 = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'TEST PERSON',
          position: 'SK Chairperson',
          rank_order: -5
        });
      expect(res3.status).toBe(400);
    });
  });

  describe('4. Update Official & Audit Diff', () => {
    it('Admin can update official committee and rank_order with accurate audit diff', async () => {
      // Find an existing official
      const target = db.prepare(`
        SELECT id, full_name, committee, rank_order
        FROM barangay_officials
        WHERE position = 'Sangguniang Barangay Member' AND rank_order = 2
      `).get() as BarangayOfficial;

      expect(target).toBeDefined();

      const updatePayload = {
        committee: 'Committee on Ways and Means (Updated)',
        rank_order: 2
      };

      const res = await request(app)
        .put(`/api/officials/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.committee).toBe('Committee on Ways and Means (Updated)');

      // Verify audit log has diff
      const auditLog = db.prepare(`
        SELECT action, entity_type, entity_id, old_data_json, new_data_json
        FROM audit_logs
        WHERE entity_type = 'official' AND entity_id = ? AND action = 'UPDATE'
        ORDER BY id DESC
        LIMIT 1
      `).get(target.id) as {
        action: string;
        entity_type: string;
        entity_id: number;
        old_data_json: string;
        new_data_json: string;
      } | undefined;

      expect(auditLog).toBeDefined();
      const oldDiff = JSON.parse(auditLog!.old_data_json);
      const newDiff = JSON.parse(auditLog!.new_data_json);

      expect(oldDiff.committee).toBe(target.committee);
      expect(newDiff.committee).toBe('Committee on Ways and Means (Updated)');
      // Untouched properties like full_name should NOT appear in the diff
      expect(oldDiff.full_name).toBeUndefined();
      expect(newDiff.full_name).toBeUndefined();
    });

    it('returns 404 when updating non-existent official ID', async () => {
      const res = await request(app)
        .put('/api/officials/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ full_name: 'Non Existent' });

      expect(res.status).toBe(404);
    });
  });

  describe('5. RBAC Enforcement', () => {
    it('Clerk, Treasurer, and Lupon cannot POST /api/officials (403 Forbidden)', async () => {
      const payload = {
        full_name: 'UNAUTHORIZED OFFICIAL',
        position: 'Sangguniang Barangay Member',
        rank_order: 14
      };

      const clerkRes = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send(payload);
      expect(clerkRes.status).toBe(403);

      const treasurerRes = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send(payload);
      expect(treasurerRes.status).toBe(403);

      const luponRes = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${luponToken}`)
        .send(payload);
      expect(luponRes.status).toBe(403);
    });

    it('Clerk, Treasurer, and Lupon cannot PUT /api/officials/:id (403 Forbidden)', async () => {
      const clerkRes = await request(app)
        .put('/api/officials/1')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({ committee: 'Hacked Committee' });
      expect(clerkRes.status).toBe(403);

      const treasurerRes = await request(app)
        .put('/api/officials/1')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({ committee: 'Hacked Committee' });
      expect(treasurerRes.status).toBe(403);

      const luponRes = await request(app)
        .put('/api/officials/1')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({ committee: 'Hacked Committee' });
      expect(luponRes.status).toBe(403);
    });
  });

  describe('6. Transaction Atomicity & Rollback Guarantees', () => {
    it('rolls back official creation if audit logging throws an error', async () => {
      const spy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic power brownout during official audit log');
      });

      const payload = {
        full_name: 'HON. ROLLBACK CANDIDATE',
        position: 'Sangguniang Barangay Member',
        rank_order: 25,
        is_active: 1
      };

      const res = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to create official');

      // Verify no row was inserted into barangay_officials
      const row = db.prepare(`
        SELECT id FROM barangay_officials WHERE full_name = 'HON. ROLLBACK CANDIDATE'
      `).get();
      expect(row).toBeUndefined();

      spy.mockRestore();
    });

    it('rolls back official update if audit logging throws an error', async () => {
      const target = db.prepare(`
        SELECT id, full_name, committee FROM barangay_officials WHERE rank_order = 3
      `).get() as BarangayOfficial;
      expect(target).toBeDefined();

      const originalCommittee = target.committee;

      const spy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic power failure during official update audit');
      });

      const res = await request(app)
        .put(`/api/officials/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ committee: 'COMMITTED_OR_ROLLED_BACK' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update official');

      // Verify official properties remain unchanged in database
      const reFetched = db.prepare(`
        SELECT id, committee FROM barangay_officials WHERE id = ?
      `).get(target.id) as BarangayOfficial;
      expect(reFetched.committee).toBe(originalCommittee);

      spy.mockRestore();
    });
  });

  describe('7. No-Op Update Suppression', () => {
    it('sending PUT /api/officials/:id with empty {} or identical values returns 200 without creating an audit log', async () => {
      const target = db.prepare(`
        SELECT id, full_name, position, committee, rank_order, is_active FROM barangay_officials WHERE rank_order = 1
      `).get() as BarangayOfficial;
      expect(target).toBeDefined();

      const initialAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;

      // 1. Send empty object {}
      const resEmpty = await request(app)
        .put(`/api/officials/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body.id).toBe(target.id);

      const afterEmptyAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;
      expect(afterEmptyAuditCount).toBe(initialAuditCount);

      // 2. Send identical values
      const resIdentical = await request(app)
        .put(`/api/officials/${target.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: target.full_name,
          position: target.position,
          committee: target.committee,
          rank_order: target.rank_order,
          is_active: target.is_active
        });

      expect(resIdentical.status).toBe(200);
      const afterIdenticalAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;
      expect(afterIdenticalAuditCount).toBe(initialAuditCount);
    });
  });

  describe('8. Strict is_active Validation', () => {
    it('POST /api/officials with is_active: "false" returns HTTP 400', async () => {
      const res = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'TEST PERSON STRING FLAG',
          position: 'Sangguniang Barangay Member',
          rank_order: 30,
          is_active: 'false'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('is_active must be 0, 1, true, or false');
    });

    it('PUT /api/officials/:id with is_active: "invalid" returns HTTP 400', async () => {
      const res = await request(app)
        .put('/api/officials/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('is_active must be 0, 1, true, or false');
    });

    it('POST /api/officials with is_active: false returns HTTP 201 with is_active: 0', async () => {
      const res = await request(app)
        .post('/api/officials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'HON. STRICT BOOLEAN FALSE',
          position: 'Sangguniang Barangay Member',
          rank_order: 31,
          is_active: false
        });

      expect(res.status).toBe(201);
      expect(res.body.is_active).toBe(0);

      // Verify in DB
      const row = db.prepare('SELECT is_active FROM barangay_officials WHERE id = ?').get(res.body.id) as { is_active: number };
      expect(row.is_active).toBe(0);
    });

    it('PUT /api/officials/:id with is_active: false returns HTTP 200 with is_active: 0', async () => {
      // Create active official first
      const insert = db.prepare(`
        INSERT INTO barangay_officials (full_name, position, rank_order, is_active)
        VALUES ('HON. ACTIVE TO DEACTIVATE', 'Sangguniang Barangay Member', 32, 1)
      `).run();
      const id = Number(insert.lastInsertRowid);

      const res = await request(app)
        .put(`/api/officials/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.is_active).toBe(0);

      const row = db.prepare('SELECT is_active FROM barangay_officials WHERE id = ?').get(id) as { is_active: number };
      expect(row.is_active).toBe(0);
    });
  });
});
