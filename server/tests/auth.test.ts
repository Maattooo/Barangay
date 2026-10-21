import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import { JWT_SECRET } from '../src/middleware/auth.middleware';

describe('Authentication & User Management Security Suite (auth.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_auth_suite.sqlite');

  beforeAll(() => {
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

  // 1. Authentication Flow Tests
  describe('1. Authentication Flow Tests', () => {
    let adminToken: string;
    let authCookie: string;

    it('Successful Login Test: Authenticates with seeded admin / admin123', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      adminToken = res.body.token;

      // Assert Set-Cookie header present with HttpOnly
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);
      const cookieStr = cookies[0];
      expect(cookieStr).toContain('token=');
      expect(cookieStr).toContain('HttpOnly');
      authCookie = cookieStr.split(';')[0]; // token=...

      // Assert user object returned without password_hash
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('Admin');
      expect(res.body.user.password_hash).toBeUndefined();

      // Assert last_login_at updated in database
      const userRow = db.prepare('SELECT last_login_at FROM users WHERE username = ?').get('admin') as any;
      expect(userRow.last_login_at).not.toBeNull();

      // Assert audit_logs contains LOGIN record with client IP
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'LOGIN' AND username_snapshot = 'admin'
        ORDER BY id DESC LIMIT 1
      `).get() as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.entity_type).toBe('user');
      expect(auditLog.summary_text).toContain('User admin logged in');
      expect(auditLog.client_ip).toBeDefined();
    });

    it('Invalid Password Test: Authenticates with admin and wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'WrongPassword123!' })
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Invalid username or password');
    });

    it('Non-Existent User Test: Authenticates with non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ghost_user_9999', password: 'adminpassword' })
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Invalid username or password');
    });

    it('Deactivated Account Test: Sets is_active = 0; login attempt asserts HTTP 403', async () => {
      // Temporarily deactivate admin
      db.prepare('UPDATE users SET is_active = 0 WHERE username = ?').run('admin');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })
        .expect(403);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Account is deactivated. Contact Administrator.');

      // Restore active status
      db.prepare('UPDATE users SET is_active = 1 WHERE username = ?').run('admin');
    });

    it('Token Verification Test (/api/auth/me): Valid Bearer token asserts HTTP 200', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('Admin');
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('Token Verification Test (/api/auth/me): Valid cookie asserts HTTP 200', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', authCookie)
        .expect(200);

      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('admin');
    });

    it('Token Verification Test (/api/auth/me): Forged/invalid token asserts HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged.token.signature')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Unauthorized: Invalid or expired token');
    });

    it('Token Verification Test (/api/auth/me): Expired token asserts HTTP 401', async () => {
      // Generate an already expired token
      const expiredToken = jwt.sign(
        { id: 1, username: 'admin', role: 'Admin' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Unauthorized: Invalid or expired token');
    });

    it('Token Verification Test (/api/auth/me): Request without token asserts HTTP 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Unauthorized: No token provided');
    });

    it('Token Verification Test (/api/auth/me): Valid token but deactivated account asserts HTTP 403', async () => {
      // Create active user, generate token, then deactivate user
      db.prepare(`
        INSERT INTO users (username, password_hash, full_name, role, is_active)
        VALUES ('temp_deactivated', 'hash', 'Temp User', 'Clerk', 1)
      `).run();
      const tempUser = db.prepare("SELECT id FROM users WHERE username = 'temp_deactivated'").get() as any;
      const tempToken = jwt.sign(
        { id: tempUser.id, username: 'temp_deactivated', role: 'Clerk' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Deactivate user in database
      db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(tempUser.id);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(403);

      expect(res.body.error).toBe('Forbidden: Account is deactivated');
    });

    it('Logout Test: Calls POST /api/auth/logout, asserts HTTP 200 and cleared cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(res.body).toEqual({ message: 'Logged out successfully' });
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies[0];
      // Cleared cookie either expires in 1970 or is empty
      expect(cookieStr).toMatch(/token=;|Expires=Thu, 01 Jan 1970/);
    });
  });

  // 2. User Management Endpoint Tests
  describe('2. User Management Endpoint Tests', () => {
    let adminToken: string;
    let createdClerkId: number;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      adminToken = res.body.token;
    });

    it('Create User Test: Admin creates a new Clerk user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'maria_clerk',
          password: 'clerkpassword123',
          full_name: 'Maria Clerk Dela Cruz',
          role: 'Clerk'
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      createdClerkId = res.body.id;
      expect(res.body.username).toBe('maria_clerk');
      expect(res.body.role).toBe('Clerk');
      expect(res.body.is_active).toBe(1);
      expect(res.body.password_hash).toBeUndefined();

      // Verify SQLite row has salted bcrypt hash starting with $2
      const dbRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(createdClerkId) as any;
      expect(dbRow.password_hash).toBeDefined();
      expect(dbRow.password_hash.startsWith('$2')).toBe(true);

      // Verify CREATE audit log
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'CREATE' AND entity_type = 'user' AND entity_id = ?
      `).get(createdClerkId) as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.summary_text).toContain('Created user maria_clerk with role Clerk');
    });

    it('Duplicate Username Conflict Test: Admin attempts to create user with existing username', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'maria_clerk',
          password: 'anotherpassword',
          full_name: 'Duplicate Maria',
          role: 'Clerk'
        })
        .expect(409);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Username already exists');
    });

    it('Invalid Role Rejection Test: Admin attempts to create user with role: SuperUser', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'superuser_test',
          password: 'password123',
          full_name: 'Invalid Role User',
          role: 'SuperUser'
        })
        .expect(400);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Invalid role specified');
    });

    it('Update User & Password Reset Test: Admin updates role and resets password', async () => {
      const res = await request(app)
        .put(`/api/users/${createdClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          role: 'Treasurer',
          password: 'new_treasurer_pass_2026'
        })
        .expect(200);

      expect(res.body.role).toBe('Treasurer');
      expect(res.body.password_hash).toBeUndefined();

      // Verify SQLite updated fields
      const dbRow = db.prepare('SELECT role, password_hash FROM users WHERE id = ?').get(createdClerkId) as any;
      expect(dbRow.role).toBe('Treasurer');
      expect(dbRow.password_hash.startsWith('$2')).toBe(true);

      // Verify new password works for login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'maria_clerk',
          password: 'new_treasurer_pass_2026'
        })
        .expect(200);

      expect(loginRes.body.user.role).toBe('Treasurer');

      // Verify old password fails
      await request(app)
        .post('/api/auth/login')
        .send({
          username: 'maria_clerk',
          password: 'clerkpassword123'
        })
        .expect(401);

      // Verify UPDATE audit log exists
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'UPDATE' AND entity_type = 'user' AND entity_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(createdClerkId) as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.summary_text).toContain('Updated user maria_clerk');
    });

    it('Update Non-Existent User Test: Returns HTTP 404', async () => {
      const res = await request(app)
        .put('/api/users/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ full_name: 'Nobody' })
        .expect(404);

      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('User not found');
    });
  });

  // 3. LAN IP Sanitization & Attribution Test
  describe('3. LAN IP Sanitization & Attribution Test', () => {
    it('Extracts and attributes X-Forwarded-For: 192.168.1.100 into audit_logs', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.100')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      const log = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE action = 'LOGIN' AND username_snapshot = 'admin'
        ORDER BY id DESC LIMIT 1
      `).get() as any;

      expect(log.client_ip).toBe('192.168.1.100');
    });

    it('Sanitizes IPv6-mapped IPv4 X-Forwarded-For: ::ffff:192.168.1.150 into pure IPv4', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '::ffff:192.168.1.150')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      const log = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE action = 'LOGIN' AND username_snapshot = 'admin'
        ORDER BY id DESC LIMIT 1
      `).get() as any;

      expect(log.client_ip).toBe('192.168.1.150');
    });

    it('Normalizes IPv6 loopback X-Forwarded-For: ::1 into 127.0.0.1', async () => {
      await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '::1')
        .send({ username: 'admin', password: 'admin123' })
        .expect(200);

      const log = db.prepare(`
        SELECT client_ip FROM audit_logs
        WHERE action = 'LOGIN' AND username_snapshot = 'admin'
        ORDER BY id DESC LIMIT 1
      `).get() as any;

      expect(log.client_ip).toBe('127.0.0.1');
    });
  });

  // 4. Hardening, Validation & Self-Lockout Regression Tests (Phase 03 Fix)
  describe('4. Hardening, Validation & Self-Lockout Regression Tests', () => {
    let adminToken: string;
    let adminId: number;
    let targetClerkId: number;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      adminToken = loginRes.body.token;
      adminId = loginRes.body.user.id;

      // Create a test user for update tests
      const userRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'hardening_clerk',
          password: 'password123',
          full_name: 'Hardening Test Clerk',
          role: 'Clerk'
        });
      targetClerkId = userRes.body.id;
    });

    it('POST /api/auth/login rejects numeric and non-string passwords with HTTP 401 without crashing', async () => {
      // Numeric password
      const numRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 123456 })
        .expect(401);
      expect(numRes.body.error).toBe('Invalid username or password');

      // Numeric username
      const numUserRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 12345, password: 'admin123' })
        .expect(401);
      expect(numUserRes.body.error).toBe('Invalid username or password');

      // Whitespace-only password
      const emptyPassRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: '   ' })
        .expect(401);
      expect(emptyPassRes.body.error).toBe('Invalid username or password');
    });

    it('POST /api/users rejects numeric/non-string passwords and fields with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'bad_type_user',
          password: 123456,
          full_name: 'Bad Type User',
          role: 'Clerk'
        })
        .expect(400);

      expect(res.body.error).toBe('Missing required fields or invalid data types');
    });

    it('PUT /api/users/:id rejects invalid official_id with HTTP 400', async () => {
      // Non-existent official_id
      const res = await request(app)
        .put(`/api/users/${targetClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ official_id: 999999 })
        .expect(400);

      expect(res.body.error).toBe('Invalid official ID specified');

      // Invalid format official_id
      const invalidFormatRes = await request(app)
        .put(`/api/users/${targetClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ official_id: 'not_a_number' })
        .expect(400);

      expect(invalidFormatRes.body.error).toBe('Invalid official ID specified');
    });

    it('PUT /api/users/:id rejects non-string or whitespace-only password with HTTP 400', async () => {
      const res = await request(app)
        .put(`/api/users/${targetClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 123456 })
        .expect(400);

      expect(res.body.error).toBe('Password must be a non-empty string');

      const whitespaceRes = await request(app)
        .put(`/api/users/${targetClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: '   ' })
        .expect(400);

      expect(whitespaceRes.body.error).toBe('Password must be a non-empty string');
    });

    it('PUT /api/users/:id rejects self-deactivation when sole active Admin exists with HTTP 400', async () => {
      // Verify only 1 active Admin exists in database
      const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Admin' AND is_active = 1").get() as any;
      expect(adminCount.count).toBe(1);

      // Attempt self-deactivation
      const res = await request(app)
        .put(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_active: 0 })
        .expect(400);

      expect(res.body.error).toBe('Cannot deactivate or demote the sole remaining active Admin account');
    });

    it('PUT /api/users/:id rejects self-demotion when sole active Admin exists with HTTP 400', async () => {
      // Attempt self-demotion to Clerk
      const res = await request(app)
        .put(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'Clerk' })
        .expect(400);

      expect(res.body.error).toBe('Cannot deactivate or demote the sole remaining active Admin account');
    });

    it('Admin updating another user with valid data continues to succeed with HTTP 200', async () => {
      // Update target clerk's full_name and valid official_id (official 1 exists from seed)
      const res = await request(app)
        .put(`/api/users/${targetClerkId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          full_name: 'Updated Hardening Clerk',
          official_id: 1
        })
        .expect(200);

      expect(res.body.full_name).toBe('Updated Hardening Clerk');
      expect(res.body.official_id).toBe(1);
      expect(res.body.password_hash).toBeUndefined();

      // Verify audit log entry was created
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs
        WHERE action = 'UPDATE' AND entity_type = 'user' AND entity_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(targetClerkId) as any;
      expect(auditLog).toBeDefined();
      expect(auditLog.summary_text).toContain('Updated user hardening_clerk');
    });
  });
});
