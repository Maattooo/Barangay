import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import { authenticate } from '../src/middleware/auth.middleware';
import { requireRole } from '../src/middleware/rbac.middleware';

describe('Role-Based Access Control (RBAC) Guard Suite (rbac.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_rbac_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;
  const mockApp = express();

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

    // Register a mock multi-role endpoint for testing requireRole('Clerk', 'Admin')
    mockApp.use(cookieParser());
    mockApp.use(express.json());
    mockApp.get(
      '/api/test-guard/clerk-or-admin',
      authenticate,
      requireRole('Clerk', 'Admin'),
      (_req, res) => {
        res.status(200).json({ allowed: true });
      }
    );

    // Seed test users for each role in the 4-role matrix
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);

    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('test_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('test_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('test_lupon', ?, 'Lupon Member', 'Lupon', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        is_active = excluded.is_active
    `).run(passHash, passHash, passHash);

    // Authenticate all 4 roles to acquire valid JWT tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const clerkLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test_lupon', password: 'matrix_pass_123' });
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

  // 1. Admin Route Protection Test
  describe('1. Admin Route Protection Test (GET /api/users)', () => {
    it('Admin role succeeds with HTTP 200', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].password_hash).toBeUndefined();
    });

    it('Clerk role is forbidden with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(403);

      expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' });
    });

    it('Treasurer role is forbidden with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .expect(403);

      expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' });
    });

    it('Lupon role is forbidden with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${luponToken}`)
        .expect(403);

      expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' });
    });

    it('Unauthenticated request is rejected with HTTP 401', async () => {
      const res = await request(app)
        .get('/api/users')
        .expect(401);

      expect(res.body).toEqual({ error: 'Unauthorized: No token provided' });
    });
  });

  // 2. Multi-Role Guard Test
  describe('2. Multi-Role Guard Test (requireRole("Clerk", "Admin"))', () => {
    it('Admin succeeds with HTTP 200', async () => {
      const res = await request(mockApp)
        .get('/api/test-guard/clerk-or-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual({ allowed: true });
    });

    it('Clerk succeeds with HTTP 200', async () => {
      const res = await request(mockApp)
        .get('/api/test-guard/clerk-or-admin')
        .set('Authorization', `Bearer ${clerkToken}`)
        .expect(200);

      expect(res.body).toEqual({ allowed: true });
    });

    it('Treasurer is rejected with HTTP 403', async () => {
      const res = await request(mockApp)
        .get('/api/test-guard/clerk-or-admin')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .expect(403);

      expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' });
    });

    it('Lupon is rejected with HTTP 403', async () => {
      const res = await request(mockApp)
        .get('/api/test-guard/clerk-or-admin')
        .set('Authorization', `Bearer ${luponToken}`)
        .expect(403);

      expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' });
    });

    it('Unauthenticated request is rejected with HTTP 401', async () => {
      const res = await request(mockApp)
        .get('/api/test-guard/clerk-or-admin')
        .expect(401);

      expect(res.body).toEqual({ error: 'Unauthorized: No token provided' });
    });
  });

  // 3. Direct Guard Function Adversarial Test
  describe('3. Guard Invocations without req.user', () => {
    it('Returns HTTP 401 when req.user is undefined', () => {
      const guard = requireRole('Admin');
      const req: any = {};
      let statusValue = 0;
      let jsonValue: any = null;
      const res: any = {
        status: (s: number) => {
          statusValue = s;
          return {
            json: (j: any) => {
              jsonValue = j;
            }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      guard(req, res, next);
      expect(statusValue).toBe(401);
      expect(jsonValue).toEqual({ error: 'Unauthorized: Authentication required' });
      expect(nextCalled).toBe(false);
    });
  });
});
