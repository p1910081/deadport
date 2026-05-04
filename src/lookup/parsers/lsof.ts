import type { ProcessInfo } from '../../types.js';

interface CurrentRecord {
  pid: number;
  name: string;
  user: string;
}

/**
 * Parse the stdout of `lsof -nP -iTCP:<port> -sTCP:LISTEN -F pcuLn`.
 *
 * Field characters:
 *   p → PID (starts a new process record)
 *   c → command name
 *   u → numeric UID (used only when L is absent)
 *   L → login name (preferred over u)
 *   n → network name (e.g. "*:3000") — consumed but not stored on ProcessInfo
 *
 * A single PID may appear multiple times when a process holds both an IPv4 and
 * an IPv6 socket on the same port. We deduplicate by PID and emit one ProcessInfo
 * per unique PID.
 */
export function parseLsof(output: string): ProcessInfo[] {
  const results: ProcessInfo[] = [];
  const seenPids = new Set<number>();

  let current: Partial<CurrentRecord> = {};

  function flush(): void {
    const { pid, name, user } = current;
    if (pid !== undefined && !seenPids.has(pid)) {
      seenPids.add(pid);
      results.push({
        pid,
        name: name ?? '',
        user: user ?? '',
        command: name ?? '',
      });
    }
  }

  for (const raw of output.split('\n')) {
    const line = raw.trimEnd();
    if (line.length === 0) continue;

    const first = line[0];
    if (first === undefined) continue;
    const value = line.slice(1);

    if (first === 'p') {
      flush();
      const pid = parseInt(value, 10);
      current = isNaN(pid) ? {} : { pid };
    } else if (first === 'c') {
      current.name = value;
    } else if (first === 'u') {
      // Numeric UID — only use as fallback when login name (L) is unavailable.
      if (current.user === undefined) current.user = value;
    } else if (first === 'L') {
      current.user = value; // prefer login name over numeric UID
    }
    // 'n' = network name; 'f' = file descriptor — not needed for ProcessInfo
  }

  flush();
  return results;
}
