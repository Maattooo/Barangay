import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('Production Static Serving & SPA Fallback Test', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv ?? 'test';
  });

  it('serves client/dist/index.html on root path in production mode', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('Barangay Management');
  });

  it('falls back to index.html for unknown non-API routes (SPA routing)', async () => {
    const res = await request(app).get('/residents/add');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
  });

  it('returns 404 JSON for unknown /api/* routes instead of serving index.html', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Endpoint not found');
  });
});
