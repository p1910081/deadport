import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must be hoisted before the module under test is imported so that kill.ts
// receives the mocked execFile when it calls promisify(execFile) at load time.
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { killProcess } from '../src/kill.js';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

const FAKE_PID = 99999999;

type ExecFileCb = (err: Error | null, stdout: string, stderr: string) => void;
const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

// Control whether the fake process is "alive" (shared across mocks).
let processAlive = true;

beforeEach(() => {
  processAlive = true;
  mockExecFile.mockReset();
  // Default: taskkill succeeds and the process is now dead.
  // This makes the Windows escalation path succeed in tests that don't
  // configure it explicitly.
  mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: ExecFileCb) => {
    processAlive = false;
    cb(null, '', '');
  });

  vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
    // Signal 0 = existence check
    if (signal === 0 || signal === undefined) {
      if (signal === 0 && !processAlive) {
        throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      }
      return true;
    }
    // SIGKILL immediately kills in the mock
    if (signal === 'SIGKILL') {
      processAlive = false;
    }
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Cross-platform success paths
// ---------------------------------------------------------------------------

describe('killProcess — success paths', () => {
  it('process dies immediately on SIGTERM → ok: true, signal: SIGTERM', async () => {
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 'SIGTERM' || signal === undefined) processAlive = false;
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
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 'SIGTERM' || signal === undefined) {
        signalCallCount++;
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

  it('process survives grace → escalates to forced kill → ok: true, signal: SIGKILL', async () => {
    // Process ignores SIGTERM; dies when forced kill is applied.
    // On Unix the forced kill is process.kill(pid, 'SIGKILL').
    // On Windows it's execFile('taskkill', ...) — both are mocked.
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
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
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
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

// ---------------------------------------------------------------------------
// Cross-platform error paths
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Windows-specific behavior (platform mocked to 'win32')
// ---------------------------------------------------------------------------

describe('killProcess — Windows behavior (platform mocked to win32)', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatformDescriptor);
  });

  it('SIGTERM: calls process.kill(pid) with no signal arg (WM_CLOSE)', async () => {
    const killArgs: Array<[number, string | number | undefined]> = [];
    vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
      killArgs.push([pid as number, signal]);
      if (signal === undefined) processAlive = false; // WM_CLOSE kills process
      if (signal === 0 && !processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 200 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGTERM');

    // WM_CLOSE: called with pid only (signal arg is undefined)
    const wmClose = killArgs.find(([, sig]) => sig === undefined);
    expect(wmClose).toBeDefined();
    expect(wmClose![0]).toBe(FAKE_PID);

    // SIGKILL must NOT have been sent via process.kill on Windows
    const directSigkill = killArgs.find(([, sig]) => sig === 'SIGKILL');
    expect(directSigkill).toBeUndefined();
  });

  it('SIGTERM graceful: does NOT call execFile (taskkill) when process dies in grace period', async () => {
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === undefined) processAlive = false; // dies on WM_CLOSE
      if (signal === 0 && !processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return true;
    });

    await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 200 });

    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('SIGTERM grace expired: calls taskkill /F and returns signal: SIGKILL', async () => {
    // Process survives WM_CLOSE; taskkill /F kills it (default mockExecFile kills it)
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      // WM_CLOSE (undefined signal) does NOT kill the process in this test
      if (signal === 0 && !processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGTERM', graceMs: 60 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGKILL');
    expect(mockExecFile).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', String(FAKE_PID), '/F'],
      expect.any(Function),
    );
  });

  it('SIGKILL: calls taskkill /F directly (no grace period)', async () => {
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 0 && !processAlive) throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' });
      return true;
    });

    const result = await killProcess(FAKE_PID, { signal: 'SIGKILL', graceMs: 200 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal).toBe('SIGKILL');
    expect(mockExecFile).toHaveBeenCalledWith(
      'taskkill',
      ['/PID', String(FAKE_PID), '/F'],
      expect.any(Function),
    );
    // process.kill with SIGKILL must NOT be used on Windows
    const calls = vi.mocked(process.kill).mock.calls;
    const directSigkill = calls.find(([, sig]) => sig === 'SIGKILL');
    expect(directSigkill).toBeUndefined();
  });
});
