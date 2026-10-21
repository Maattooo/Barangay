import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Offline Static Asset Audit Test', () => {
  function getAllFiles(dir: string, fileList: string[] = []): string[] {
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

  // Regex patterns per Acceptance Criterion 2
  const htmlAttributeRegex = /(?:href|src|url)\s*=\s*['"](https?:\/\/[^'"]+)['"]/gi;
  const cssUrlRegex = /url\s*\(\s*['"]?(https?:\/\/[^'")]+)['"]?\)/gi;
  const cssImportRegex = /@import\s+['"](https?:\/\/[^'"]+)['"]/gi;

  const fontCdnPatterns = [
    /fonts\.googleapis\.com/i,
    /fonts\.gstatic\.com/i,
    /cdnjs\.cloudflare\.com/i,
    /cdn\.jsdelivr\.net/i,
    /unpkg\.com/i
  ];

  function findViolations(content: string, filename: string): { file: string; match: string }[] {
    const violations: { file: string; match: string }[] = [];

    // 1. HTML attribute links
    let match: RegExpExecArray | null;
    htmlAttributeRegex.lastIndex = 0;
    while ((match = htmlAttributeRegex.exec(content)) !== null) {
      const url = match[1];
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        violations.push({ file: filename, match: url });
      }
    }

    // 2. CSS url(...) declarations
    cssUrlRegex.lastIndex = 0;
    while ((match = cssUrlRegex.exec(content)) !== null) {
      const url = match[1];
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        violations.push({ file: filename, match: url });
      }
    }

    // 3. CSS @import statements
    cssImportRegex.lastIndex = 0;
    while ((match = cssImportRegex.exec(content)) !== null) {
      const url = match[1];
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        violations.push({ file: filename, match: url });
      }
    }

    // 4. Known CDN domain patterns anywhere in the file
    for (const pattern of fontCdnPatterns) {
      if (pattern.test(content)) {
        violations.push({ file: filename, match: pattern.toString() });
      }
    }

    return violations;
  }

  it('scans client/index.html and client/src/ to ensure zero external CDN/font URLs exist', () => {
    const clientDir = path.resolve(__dirname, '../../client');
    const indexPath = path.join(clientDir, 'index.html');
    const srcDir = path.join(clientDir, 'src');

    const filesToScan = [indexPath, ...getAllFiles(srcDir)];
    expect(filesToScan.length).toBeGreaterThan(1);

    const allViolations: { file: string; match: string }[] = [];

    for (const filePath of filesToScan) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileViolations = findViolations(content, path.relative(clientDir, filePath));
      allViolations.push(...fileViolations);
    }

    expect(allViolations).toEqual([]);
  });

  it('regex detection accurately catches remote HTML attributes, CSS url(...), and CSS @import statements', () => {
    const testHtmlSnippet = `<link rel="stylesheet" href="https://external-cdn.com/style.css" />`;
    const testCssUrlSnippet = `body { background-image: url('https://external-cdn.com/bg.png'); }`;
    const testCssImportSnippet = `@import "https://fonts.googleapis.com/css2?family=Inter";`;
    const testSafeSnippet = `
      <link rel="stylesheet" href="/assets/index.css" />
      body { background-image: url('/assets/local-logo.svg'); }
      @import "./variables.css";
    `;

    expect(findViolations(testHtmlSnippet, 'test.html')).toEqual([
      { file: 'test.html', match: 'https://external-cdn.com/style.css' }
    ]);

    expect(findViolations(testCssUrlSnippet, 'test.css')).toEqual([
      { file: 'test.css', match: 'https://external-cdn.com/bg.png' }
    ]);

    const importViolations = findViolations(testCssImportSnippet, 'test.css');
    expect(importViolations.length).toBeGreaterThanOrEqual(1);
    expect(importViolations.some((v) => v.match.includes('https://fonts.googleapis.com'))).toBe(true);

    expect(findViolations(testSafeSnippet, 'safe.css')).toEqual([]);
  });
});
