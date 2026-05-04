/** Result of parsing one LISTENING row from Windows `netstat -ano -p TCP`. */
export interface NetstatEntry {
  port: number;
  pid: number;
}

/**
 * Parse stdout of `netstat -ano -p TCP` on Windows.
 * Returns only rows in LISTENING state.
 *
 * Expected format (columns: Proto, Local Address, Foreign Address, State, PID):
 *   TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    48291
 *   TCP    [::]:3000       [::]:0       LISTENING    48291
 *
 * TODO(v0.1): implement fully and add fixture-driven tests.
 */
export function parseNetstat(output: string): NetstatEntry[] {
  const results: NetstatEntry[] = [];

  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (!line.toUpperCase().includes('LISTENING')) continue;

    const parts = line.split(/\s+/);
    // parts: [proto, localAddr, foreignAddr, state, pid]
    if (parts.length < 5) continue;

    const localAddr = parts[1];
    const pidStr = parts[4];
    if (localAddr === undefined || pidStr === undefined) continue;

    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) continue;

    // Extract port from local address: "0.0.0.0:3000" or "[::]:3000"
    const colonIdx = localAddr.lastIndexOf(':');
    if (colonIdx === -1) continue;
    const port = parseInt(localAddr.slice(colonIdx + 1), 10);
    if (isNaN(port)) continue;

    results.push({ port, pid });
  }

  return results;
}
