import { describe, it, expect } from 'vitest';
import { formatDate, formatInr } from '../../web/src/lib/formatters.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 1d Formatters & Source-scan', () => {
  it('formatDate formats dates to en-IN without weekday (e.g. 3 Sep 2026)', () => {
    const table = [
      { input: '2026-09-03', expected: '3 Sep 2026' },
      { input: '2026-01-15T12:00:00', expected: '15 Jan 2026' },
      { input: '2026-12-31T12:00:00', expected: '31 Dec 2026' },
      { input: new Date(2026, 8, 3), expected: '3 Sep 2026' },
    ];

    for (const { input, expected } of table) {
      expect(formatDate(input)).toBe(expected);
    }
  });

  it('formatInr formats numbers to Indian Rupee representation (e.g. ₹1,200)', () => {
    const table = [
      { input: 1200, expected: '₹1,200' },
      { input: 0, expected: '₹0' },
      { input: 500, expected: '₹500' },
      { input: 100000, expected: '₹1,00,000' },
      { input: 2500000, expected: '₹25,00,000' },
    ];

    for (const { input, expected } of table) {
      expect(formatInr(input)).toBe(expected);
    }
  });

  it('source-scan fails if toLocaleDateString( is used without explicit locale', () => {
    function walkDir(dir: string, fileList: string[] = []): string[] {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath, fileList);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const allSourceFiles = walkDir('web/src');
    const violations: string[] = [];

    // regex to find toLocaleDateString without an explicit locale argument
    const badRegex = /\.toLocaleDateString\s*\(\s*(\)|undefined)/;

    for (const filePath of allSourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (badRegex.test(content)) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
