import { describe, it, expect } from 'vitest';
import { formatDuration, formatJson, freeResult, killResultToJson } from '../src/format.js';
import type { PortHolder } from '../src/types.js';

describe('formatDuration', () => {
  it('0ms → 0s', () => expect(formatDuration(0)).toBe('0s'));
  it('500ms → 0s (floor)', () => expect(formatDuration(500)).toBe('0s'));
  it('1000ms → 1s', () => expect(formatDuration(1000)).toBe('1s'));
  it('59 999ms → 59s', () => expect(formatDuration(59_999)).toBe('59s'));
  it('60 000ms → 1m', () => expect(formatDuration(60_000)).toBe('1m'));
  it('90 000ms → 1m 30s', () => expect(formatDuration(90_000)).toBe('1m 30s'));
  it('3 600 000ms → 1h', () => expect(formatDuration(3_600_000)).toBe('1h'));
  it('5 400 000ms → 1h 30m', () => expect(formatDuration(5_400_000)).toBe('1h 30m'));
  it('86 400 000ms → 1d', () => expect(formatDuration(86_400_000)).toBe('1d'));
  it('90 061 000ms → 1d 1h', () => expect(formatDuration(90_061_000)).toBe('1d 1h'));
  it('172 800 000ms → 2d', () => expect(formatDuration(172_800_000)).toBe('2d'));
});

describe('formatJson', () => {
  it('produces valid JSON', () => {
    const out = formatJson({ results: [freeResult(3000)] });
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it('free result has status "free" and no process field', () => {
    const parsed = JSON.parse(formatJson({ results: [freeResult(8080)] })) as {
      results: Array<{ port: number; status: string; process?: unknown }>;
    };
    expect(parsed.results[0]?.status).toBe('free');
    expect(parsed.results[0]?.process).toBeUndefined();
  });

  it('killed result has process, signal, durationMs', () => {
    const holder: PortHolder = {
      port: 3000,
      processes: [{ pid: 42, name: 'node', user: 'alex', command: 'node' }],
    };
    const kr = { ok: true as const, pid: 42, signal: 'SIGTERM' as const, durationMs: 55 };
    const result = killResultToJson(3000, holder, kr);
    expect(result.status).toBe('killed');
    expect(result.signal).toBe('SIGTERM');
    expect(result.durationMs).toBe(55);
    expect(result.process?.pid).toBe(42);
  });

  it('permission-denied result sets status correctly', () => {
    const holder: PortHolder = {
      port: 80,
      processes: [{ pid: 1, name: 'nginx', user: 'root', command: 'nginx' }],
    };
    const kr = { ok: false as const, pid: 1, reason: 'permission' as const };
    const result = killResultToJson(80, holder, kr);
    expect(result.status).toBe('permission-denied');
    expect(result.process?.name).toBe('nginx');
  });
});
