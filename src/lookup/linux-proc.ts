import type { LookupResult } from '../types.js';

/**
 * Fallback lookup using /proc/net/tcp for environments without lsof (e.g. Alpine).
 * Reads /proc/net/tcp (IPv4) and /proc/net/tcp6 (IPv6), matches inodes to PIDs
 * via /proc/<pid>/fd/ symlinks, and resolves names from /proc/<pid>/comm.
 *
 * TODO(v0.1): implement fully. Stub returns tool-missing so unix.ts is the default.
 */
export async function findViaProc(_ports: number[]): Promise<LookupResult> {
  return { ok: false, reason: 'tool-missing', detail: '/proc fallback not yet implemented' };
}
