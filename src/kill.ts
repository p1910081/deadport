import { execFile } from 'child_process';
import { promisify } from 'util';
import type { KillResult, Signal } from './types.js';

const execFileAsync = promisify(execFile);

export interface KillOptions {
  signal: Signal;
  /** Grace period in milliseconds before escalating to forced kill. */
  graceMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check whether a process is still alive.
 * Works identically on all platforms — process.kill(pid, 0) throws ESRCH when dead.
 */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === 'EPERM'; // EPERM = alive but unpermissioned; ESRCH = dead
  }
}

async function waitForDeath(pid: number, maxMs: number): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await sleep(50);
  }
  return !isAlive(pid);
}

/**
 * Platform-unified forced (immediate) kill.
 * Windows: taskkill /F — terminates the process unconditionally.
 * Unix:    SIGKILL via process.kill.
 */
async function forcedKill(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/F']);
  } else {
    process.kill(pid, 'SIGKILL');
  }
}

/**
 * Send a signal to a process and wait for it to die, escalating to a forced kill
 * after the grace period if needed.
 *
 * Signal semantics per platform:
 *   SIGKILL (any platform)    → forcedKill immediately (taskkill /F on Windows)
 *   non-SIGKILL on Windows    → process.kill(pid) with no signal arg, which sends
 *                               WM_CLOSE — lets the process handle a clean shutdown
 *   non-SIGKILL on Unix       → process.kill(pid, signal) — standard POSIX
 *
 * KillResult.signal reflects what actually killed the process:
 *   'SIGTERM' → process exited during the grace period (graceful)
 *   'SIGKILL' → we had to force it (or user explicitly requested SIGKILL)
 */
export async function killProcess(pid: number, opts: KillOptions): Promise<KillResult> {
  const start = Date.now();

  // -- 1. Send initial signal ------------------------------------------------
  try {
    if (opts.signal === 'SIGKILL') {
      await forcedKill(pid);
    } else if (process.platform === 'win32') {
      // No signal arg → Node sends WM_CLOSE on Windows, allowing clean shutdown.
      process.kill(pid);
    } else {
      process.kill(pid, opts.signal);
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM') return { ok: false, pid, reason: 'permission' };
    if (code === 'ESRCH') return { ok: false, pid, reason: 'not-found' };
    throw err;
  }

  // -- 2. SIGKILL path: no grace period, just poll until dead ----------------
  if (opts.signal === 'SIGKILL') {
    const died = await waitForDeath(pid, 500);
    if (!died) return { ok: false, pid, reason: 'timeout' };
    return { ok: true, pid, signal: 'SIGKILL', durationMs: Date.now() - start };
  }

  // -- 3. Graceful path: wait for the process to exit on its own -------------
  const diedInGrace = await waitForDeath(pid, opts.graceMs);
  if (diedInGrace) {
    return { ok: true, pid, signal: 'SIGTERM', durationMs: Date.now() - start };
  }

  // -- 4. Escalate: grace expired, force kill --------------------------------
  try {
    await forcedKill(pid);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    // Unix: SIGKILL throws ESRCH if the process died between last poll and escalation.
    // Windows: taskkill exits non-zero if PID no longer exists — check liveness instead.
    if (code === 'ESRCH' || !isAlive(pid)) {
      return { ok: true, pid, signal: 'SIGTERM', durationMs: Date.now() - start };
    }
    if (code === 'EPERM') return { ok: false, pid, reason: 'permission' };
    throw err;
  }

  const diedAfterKill = await waitForDeath(pid, 500);
  if (!diedAfterKill) return { ok: false, pid, reason: 'timeout' };
  return { ok: true, pid, signal: 'SIGKILL', durationMs: Date.now() - start };
}
