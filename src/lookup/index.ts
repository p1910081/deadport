import type { LookupResult } from '../types.js';
import { findOnUnix } from './unix.js';
import { findViaProc } from './linux-proc.js';
import { findOnWindows } from './windows.js';

/**
 * Dispatch to the correct platform implementation.
 *
 * Resolution order:
 *   Windows  → windows.ts
 *   macOS    → unix.ts (lsof)
 *   Linux    → unix.ts (lsof) with /proc fallback if lsof is missing
 */
export async function findPortHolders(ports: number[]): Promise<LookupResult> {
  const platform = process.platform;

  if (platform === 'win32') {
    return findOnWindows(ports);
  }

  const result = await findOnUnix(ports);

  // If lsof is missing on Linux, try the /proc fallback.
  if (!result.ok && result.reason === 'tool-missing' && platform === 'linux') {
    return findViaProc(ports);
  }

  return result;
}
