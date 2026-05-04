import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseLsof } from '../src/lookup/parsers/lsof.js';
import { parseNetstat } from '../src/lookup/parsers/netstat.js';
import { parseTasklist } from '../src/lookup/parsers/tasklist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, 'fixtures');

function fixture(rel: string): string {
  return readFileSync(resolve(fixturesDir, rel), 'utf-8');
}

interface LsofCase {
  name: string;
  fixture: string;
  expected: Array<{ pid: number; name: string; user: string; command: string }>;
}

interface NetstatCase {
  name: string;
  fixture: string;
  expected: Array<{ port: number; pid: number }>;
}

interface TasklistCase {
  name: string;
  fixture: string;
  expected: Array<{ pid: number; name: string; user: string }>;
}

interface Cases {
  lsof: LsofCase[];
  netstat: NetstatCase[];
  tasklist: TasklistCase[];
}

const cases = JSON.parse(readFileSync(resolve(fixturesDir, 'cases.json'), 'utf-8')) as Cases;

describe('lsof parser', () => {
  for (const tc of cases.lsof) {
    it(tc.name, () => {
      const output = fixture(tc.fixture);
      const result = parseLsof(output);
      expect(result).toHaveLength(tc.expected.length);
      for (let i = 0; i < tc.expected.length; i++) {
        const exp = tc.expected[i];
        const got = result[i];
        expect(got).toBeDefined();
        if (!exp || !got) continue;
        expect(got.pid).toBe(exp.pid);
        expect(got.name).toBe(exp.name);
        expect(got.user).toBe(exp.user);
        expect(got.command).toBe(exp.command);
      }
    });
  }
});

describe('netstat parser', () => {
  for (const tc of cases.netstat) {
    it(tc.name, () => {
      const output = fixture(tc.fixture);
      const result = parseNetstat(output);
      expect(result).toHaveLength(tc.expected.length);
      for (let i = 0; i < tc.expected.length; i++) {
        const exp = tc.expected[i];
        const got = result[i];
        expect(got).toBeDefined();
        if (!exp || !got) continue;
        expect(got.port).toBe(exp.port);
        expect(got.pid).toBe(exp.pid);
      }
    });
  }
});

describe('tasklist parser', () => {
  for (const tc of cases.tasklist) {
    it(tc.name, () => {
      const output = fixture(tc.fixture);
      const result = parseTasklist(output);
      expect(result).toHaveLength(tc.expected.length);
      for (let i = 0; i < tc.expected.length; i++) {
        const exp = tc.expected[i];
        const got = result[i];
        expect(got).toBeDefined();
        if (!exp || !got) continue;
        expect(got.pid).toBe(exp.pid);
        expect(got.name).toBe(exp.name);
        expect(got.user).toBe(exp.user);
      }
    });
  }
});
