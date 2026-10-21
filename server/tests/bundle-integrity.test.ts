import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Frontend Build & Bundle Integrity Test', () => {
  it('executes npm run build in client/ with exit code 0 and verifies dist assets exist', () => {
    const clientDir = path.resolve(__dirname, '../../client');
    const distDir = path.resolve(clientDir, 'dist');
    const assetsDir = path.resolve(distDir, 'assets');

    // Executes npm run build in client/
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const buildOutput = execSync(`${npmCmd} run build`, {
      cwd: clientDir,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    expect(buildOutput).toBeDefined();

    // Asserts client/dist/index.html exists
    const indexPath = path.join(distDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent.length).toBeGreaterThan(0);

    // Asserts corresponding JS/CSS assets exist in client/dist/assets/
    expect(fs.existsSync(assetsDir)).toBe(true);
    const assetFiles = fs.readdirSync(assetsDir);

    const hasJsAsset = assetFiles.some((f) => f.endsWith('.js'));
    const hasCssAsset = assetFiles.some((f) => f.endsWith('.css'));

    expect(hasJsAsset).toBe(true);
    expect(hasCssAsset).toBe(true);
  });
});
