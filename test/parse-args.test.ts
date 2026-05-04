import { describe, it, expect } from 'vitest';
import { parsePorts } from '../src/parse-args.js';

describe('parsePorts — valid inputs', () => {
  it('single port', () => {
    const r = parsePorts(['3000']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000]);
  });

  it('port with leading colon (:3000)', () => {
    const r = parsePorts([':3000']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000]);
  });

  it('range (3000-3005)', () => {
    const r = parsePorts(['3000-3005']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000, 3001, 3002, 3003, 3004, 3005]);
  });

  it('comma list (3000,8080,5432)', () => {
    const r = parsePorts(['3000,8080,5432']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000, 8080, 5432]);
  });

  it('multiple space-separated args', () => {
    const r = parsePorts(['3000', '8080']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000, 8080]);
  });

  it('mixed: range + single arg', () => {
    const r = parsePorts(['3000-3002', '8080']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000, 3001, 3002, 8080]);
  });

  it('port 1 (minimum)', () => {
    const r = parsePorts(['1']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([1]);
  });

  it('port 65535 (maximum)', () => {
    const r = parsePorts(['65535']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([65535]);
  });

  it('deduplicates repeated ports', () => {
    const r = parsePorts(['3000', '3000', '8080']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([3000, 8080]);
  });

  it('colon prefix with comma list (:3000)', () => {
    const r = parsePorts([':80']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ports).toEqual([80]);
  });
});

describe('parsePorts — invalid inputs', () => {
  it('no args returns error', () => {
    const r = parsePorts([]);
    expect(r.ok).toBe(false);
  });

  it('port 0 is out of range', () => {
    const r = parsePorts(['0']);
    expect(r.ok).toBe(false);
  });

  it('port 65536 is out of range', () => {
    const r = parsePorts(['65536']);
    expect(r.ok).toBe(false);
  });

  it('negative port is rejected', () => {
    const r = parsePorts(['-1']);
    expect(r.ok).toBe(false);
  });

  it('non-numeric string is rejected', () => {
    const r = parsePorts(['abc']);
    expect(r.ok).toBe(false);
  });

  it('range where lo > hi is rejected', () => {
    const r = parsePorts(['3010-3000']);
    expect(r.ok).toBe(false);
  });

  it('range with out-of-range end is rejected', () => {
    const r = parsePorts(['65530-65540']);
    expect(r.ok).toBe(false);
  });

  it('comma list with invalid entry is rejected', () => {
    const r = parsePorts(['3000,abc,8080']);
    expect(r.ok).toBe(false);
  });
});
