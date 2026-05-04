import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { killProcess } from '../src/kill.js';

// Fake PID that won't collide with a real process.
const FAKE_PID = 99999999;

// Capture calls to process.kill
let killCalls: Array<{ pid: number; signal: string | number }> = [];
// Control whether the fake process is "alive"
let processAlive = true;

beforeEach(() => {
  killCalls = [];
  processAlive = true;

  vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    killCalls.push({ pid, signal: signal ?? 0 });

    // Signal 0 = existence check
    if (signal === 0 || signal === undefined) {
      if (!processAlive) {
        const err = Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
        throw err;
      }
      return true;
    }

    // SIGKILL immediately kills in our mock
    if (signal === 'SIGKILL') {
      processAlive = false;
      return true;
    }

    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('killProcess — success paths', () => {
  it('process dies immediately on SIGTERM → ok: true, signal: SIGTERM', async () => {
    // Process dies on SIGTERM (polling immediately returns dead)
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 'SIGTERM') processAlive = false;
      if (signal === 0) {
        if (!processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      }
      return true;
    });

    processAlive = true;
    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 200 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signal).toBe('SIGTERM');
      expect(result.pid).toBe(FAKE_PID);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('process dies during grace period → ok: true, signal: SIGTERM', async () => {
    let signalCallCount = 0;
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (signal === 'SIGTERM') {
        signalCallCount++;
        // Die after first poll
      }
      if (signal === 0) {
        if (signalCallCount >= 1) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      }
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 300 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGTERM');
  });

  it('process survives grace → SIGKILL → ok: true, signal: SIGKILL', async () => {
    // Process ignores SIGTERM, dies on SIGKILL
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (signal === 'SIGKILL') processAlive = false;
      if (signal === 0) {
        if (!processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      }
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 60 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGKILL');
  });

  it('SIGKILL sent directly → ok: true, signal: SIGKILL', async () => {
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (signal === 'SIGKILL') processAlive = false;
      if (signal === 0) {
        if (!processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      }
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGKILL', graceMs: 200 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGKILL');
  });
});

describe('killProcess — error paths', () => {
  it('EPERM on initial signal → ok: false, reason: permission', async () => {
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal !== 0) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 200 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('permission');
      expect(result.pid).toBe(FAKE_PID);
    }
  });

  it('ESRCH on initial signal (race: process died) → ok: false, reason: not-found', async () => {
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal !== 0) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 200 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });
});
