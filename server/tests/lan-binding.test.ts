import { describe, it, expect, afterAll } from 'vitest';
import http from 'http';
import { app, startServer } from '../src/index';
import type { AddressInfo } from 'net';

describe('LAN Binding Verification Test', () => {
  let testServer: ReturnType<typeof app.listen> | null = null;

  afterAll(async () => {
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer!.close(() => resolve());
      });
    }
  });

  it('starts server and verifies host binds explicitly to 0.0.0.0 and accepts connections', async () => {
    // Start on port 0 to dynamically allocate an open port while explicitly binding to 0.0.0.0
    testServer = startServer(0, '0.0.0.0');

    await new Promise<void>((resolve) => {
      testServer!.on('listening', () => resolve());
    });

    const address = testServer.address() as AddressInfo;
    expect(address).not.toBeNull();

    // Verify network socket assertion: host address is bound to 0.0.0.0
    expect(address.address).toBe('0.0.0.0');
    expect(address.port).toBeGreaterThan(0);

    // Verify server accepts inbound requests
    const testUrl = `http://127.0.0.1:${address.port}/api/health`;
    const response = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
      http.get(testUrl, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, data: rawData });
        });
      }).on('error', reject);
    });

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.data);
    expect(parsed.status).toBe('ok');
  });
});
