import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';

describe('Server Health Check Integration Test', () => {
  it('GET /api/health returns HTTP 200 with JSON payload and valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');

    // Asserts HTTP status code equals 200
    expect(res.status).toBe(200);

    // Asserts response header content-type matches /application\/json/
    expect(res.headers['content-type']).toMatch(/application\/json/);

    // Asserts response body contains { status: "ok" }
    expect(res.body).toHaveProperty('status', 'ok');

    // Asserts response body contains a valid ISO timestamp string
    expect(res.body).toHaveProperty('timestamp');
    const parsedDate = Date.parse(res.body.timestamp);
    expect(Number.isNaN(parsedDate)).toBe(false);
    expect(new Date(parsedDate).toISOString()).toBe(res.body.timestamp);
  });
});
