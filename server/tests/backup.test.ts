import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';

describe('System Information & SQLite Hot Backup Test Suite (backup.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_backup_suite.sqlite');
  const backupsDir = path.resolve(process.cwd(), 'data/backups');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;
  const createdBackups: string[] = [];

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

    // Ensure staff roles exist
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('sys_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('sys_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('sys_lupon', ?, 'Lupon Member', 'Lupon', 1)
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
      .send({ username: 'sys_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sys_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sys_lupon', password: 'matrix_pass_123' });
    luponToken = luponLogin.body.token;
  });

  afterAll(() => {
    closeDb();

    // Clean up created backups during tests
    for (const b of createdBackups) {
      if (fs.existsSync(b)) {
        try {
          fs.unlinkSync(b);
        } catch {
          // Ignore
        }
      }
    }

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

  describe('1. GET /api/system/info Endpoint', () => {
    it('returns 200 OK with lan_ips, db_size_bytes > 0, and default metadata settings', async () => {
      const res = await request(app)
        .get('/api/system/info')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lan_ips');
      expect(Array.isArray(res.body.lan_ips)).toBe(true);
      expect(res.body.lan_ips.length).toBeGreaterThanOrEqual(1);

      // Validate IPv4 format
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      for (const ip of res.body.lan_ips) {
        expect(ip).toMatch(ipv4Regex);
      }

      expect(res.body).toHaveProperty('db_size_bytes');
      expect(typeof res.body.db_size_bytes).toBe('number');
      expect(res.body.db_size_bytes).toBeGreaterThan(0);

      expect(res.body).toHaveProperty('settings');
      expect(res.body.settings).toHaveProperty('barangay_name');
      expect(res.body.settings).toHaveProperty('municipality_name');
      expect(res.body.settings).toHaveProperty('province_name');
      expect(res.body.settings.barangay_name).toBe('Barangay San Jose');
      expect(res.body.settings.municipality_name).toBe('Antipolo City');
      expect(res.body.settings.province_name).toBe('Rizal');
    });

    it('accessible to all authenticated staff (Clerk, Treasurer, Lupon)', async () => {
      const clerkRes = await request(app)
        .get('/api/system/info')
        .set('Authorization', `Bearer ${clerkToken}`);
      expect(clerkRes.status).toBe(200);

      const treasurerRes = await request(app)
        .get('/api/system/info')
        .set('Authorization', `Bearer ${treasurerToken}`);
      expect(treasurerRes.status).toBe(200);

      const luponRes = await request(app)
        .get('/api/system/info')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(luponRes.status).toBe(200);
    });

    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/system/info');
      expect(res.status).toBe(401);
    });
  });

  describe('2. POST /api/system/backup Endpoint', () => {
    it('creates a non-corrupt SQLite hot backup and streams file with headers', async () => {
      const res = await request(app)
        .post('/api/system/backup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/x-sqlite3');
      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="barangay_backup_\d{8}_\d{6}\.sqlite"/);

      // Extract filename from header
      const match = res.headers['content-disposition'].match(/filename="([^"]+)"/);
      expect(match).toBeTruthy();
      const backupFilename = match![1];
      const backupFilePath = path.join(backupsDir, backupFilename);
      createdBackups.push(backupFilePath);

      // Assert backup file physically created on disk
      expect(fs.existsSync(backupFilePath)).toBe(true);
      const stat = fs.statSync(backupFilePath);
      expect(stat.size).toBeGreaterThan(0);

      // Assert backup file is a valid, readable SQLite database
      const backupDb = new Database(backupFilePath);
      const userCountRow = backupDb.prepare('SELECT count(*) as count FROM users').get() as { count: number };
      expect(userCountRow.count).toBeGreaterThanOrEqual(4);
      backupDb.close();

      // Assert SYSTEM_BACKUP audit log entry created
      const auditRow = db.prepare(`
        SELECT action, entity_type, summary_text
        FROM audit_logs
        WHERE action = 'SYSTEM_BACKUP'
        ORDER BY id DESC LIMIT 1
      `).get() as { action: string; entity_type: string; summary_text: string } | undefined;

      expect(auditRow).toBeDefined();
      expect(auditRow!.action).toBe('SYSTEM_BACKUP');
      expect(auditRow!.entity_type).toBe('user');
      expect(auditRow!.summary_text).toContain(backupFilename);
    });

    it('RBAC: non-admin roles cannot trigger POST /api/system/backup (403 Forbidden)', async () => {
      const clerkRes = await request(app)
        .post('/api/system/backup')
        .set('Authorization', `Bearer ${clerkToken}`);
      expect(clerkRes.status).toBe(403);

      const treasurerRes = await request(app)
        .post('/api/system/backup')
        .set('Authorization', `Bearer ${treasurerToken}`);
      expect(treasurerRes.status).toBe(403);

      const luponRes = await request(app)
        .post('/api/system/backup')
        .set('Authorization', `Bearer ${luponToken}`);
      expect(luponRes.status).toBe(403);
    });

    it('responds with HTTP 500 if fileStream encounters a read error before streaming', async () => {
      const mockStream = new EventEmitter() as any;
      mockStream.pipe = vi.fn();

      const spy = vi.spyOn(fs, 'createReadStream').mockImplementationOnce(() => {
        setTimeout(() => {
          mockStream.emit('error', new Error('Simulated disk read I/O error'));
        }, 10);
        return mockStream;
      });

      const res = await request(app)
        .post('/api/system/backup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to stream backup file');
      expect(res.body.details).toContain('Simulated disk read I/O error');

      spy.mockRestore();
    });
  });
});
