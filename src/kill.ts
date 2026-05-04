import { execFile } from 'child_process';
import { promisify } from 'util';
import type { KillResult, Signal } from './types.js';

const execFileAsync = promisify(execFile);

export interface KillOptions {
  signal: Signal;
  /** Grace period in milliseconds before escalating to SIGKILL. */
  graceMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check whether a process is still alive.
 * - Returns true  if alive (signal 0 succeeds, or EPERM — alive but unpermissioned)
 * - Returns false if dead (ESRCH)
 */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === 'EPERM'; // EPERM = alive, cannot signal; ESRCH = dead
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

async function killWindowsSigkill(pid: number): Promise<void> {
  // TODO(v0.2): revisit when windows.ts lookup is wired; for now force-terminate.
  await execFileAsync('taskkill', ['/PID', String(pid), '/F']);
}

/**
 * Send a signal to a process and wait for it to die, escalating to SIGKILL after
 * the grace period if needed.
 *
 * Signal mapping on Windows (Node translates most signals to TerminateProcess):
 * - SIGKILL → taskkill /F (immediate)
 * - everything else → process.kill (graceful-ish; no POSIX semantics)
 *
 * TODO(v0.2): Windows: properly use taskkill for SIGTERM-style with a grace period.
 */
export async function killProcess(pid: number, opts: KillOptions): Promise<KillResult> {
  const start = Date.now();
  const isWindows = process.platform === 'win32';

  // -- 1. Send initial signal ------------------------------------------------
  try {
    if (isWindows && opts.signal === 'SIGKILL') {
      await killWindowsSigkill(pid);
    } else {
      process.kill(pid, opts.signal);
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM') return { ok: false, pid, reason: 'permission' };
    if (code === 'ESRCH') return { ok: false, pid, reason: 'not-found' };
    throw err;
  }

  // -- 2. If SIGKILL (or Windows where signals are immediate), just poll -----
  if (opts.signal === 'SIGKILL' || isWindows) {
    const maxWait = isWindows ? Math.min(opts.graceMs, 2000) : 500;
    const died = await waitForDeath(pid, maxWait);
    if (!died) return { ok: false, pid, reason: 'timeout' };
    return { ok: true, pid, signal: 'SIGKILL', durationMs: Date.now() - start };
  }

  // -- 3. Wait for grace period -----------------------------------------------
  const diedInGrace = await waitForDeath(pid, opts.graceMs);
  if (diedInGrace) {
    // TODO(v0.2): KillResult.signal should include all Signal values, not just
    // 'SIGTERM' | 'SIGKILL'. For now, report the initial signal as 'SIGTERM'
    // since non-SIGKILL signals share the same "graceful" semantics.
    return { ok: true, pid, signal: 'SIGTERM', durationMs: Date.now() - start };
  }

  // -- 4. Escalate to SIGKILL -------------------------------------------------
  try {
    process.kill(pid, 'SIGKILL');
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') {
      // Died between last poll and SIGKILL attempt — still a success.
      return { ok: true, pid, signal: 'SIGTERM', durationMs: Date.now() - start };
    }
    if (code === 'EPERM') return { ok: false, pid, reason: 'permission' };
    throw err;
  }

  const diedAfterKill = await waitForDeath(pid, 500);
  if (!diedAfterKill) return { ok: false, pid, reason: 'timeout' };
  return { ok: true, pid, signal: 'SIGKILL', durationMs: Date.now() - start };
}
