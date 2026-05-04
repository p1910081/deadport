import { execFile } from 'child_process';
import type { LookupResult, PortHolder, ProcessInfo } from '../types.js';
import { parseNetstat } from './parsers/netstat.js';
import { parseTasklist } from './parsers/tasklist.js';

// TODO(perf): consider Get-NetTCPConnection via PowerShell for v0.3 — netstat is
// slow on Windows (~200-400ms) and PowerShell structured output avoids CSV parsing.

function spawnCmd(file: string, args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile(file, args, { encoding: 'utf8' }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(stdout);
    });
  });
}

export async function findOnWindows(ports: number[]): Promise<LookupResult> {
  // -- 1. netstat: collect all LISTENING entries ---------------------------------
  let netstatOut: string;
  try {
    netstatOut = await spawnCmd('netstat', ['-ano', '-p', 'TCP']);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return { ok: false, reason: 'tool-missing', detail: 'netstat or tasklist not found' };
    }
    return { ok: false, reason: 'parse-error', detail: String(err) };
  }

  const entries = parseNetstat(netstatOut);

  // Build port → Set<pid> for only the requested ports
  const portRequested = new Set(ports);
  const portToPids = new Map<number, Set<number>>();
  for (const { port, pid } of entries) {
    if (!portRequested.has(port)) continue;
    if (!portToPids.has(port)) portToPids.set(port, new Set());
    portToPids.get(port)!.add(pid);
  }

  // Unique PIDs across all requested ports
  const uniquePids = new Set<number>();
  for (const pids of portToPids.values()) {
    for (const pid of pids) uniquePids.add(pid);
  }

  if (uniquePids.size === 0) {
    return { ok: true, holders: ports.map((port) => ({ port, processes: [] })) };
  }

  // -- 2. tasklist: resolve each unique PID → ProcessInfo -----------------------
  const pidToProcess = new Map<number, ProcessInfo>();

  for (const pid of uniquePids) {
    let taskOut: string;
    try {
      taskOut = await spawnCmd('tasklist', ['/FI', `PID eq ${pid}`, '/V', '/FO', 'CSV']);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return { ok: false, reason: 'tool-missing', detail: 'netstat or tasklist not found' };
      }
      // Non-fatal: process may have died between netstat and tasklist
      continue;
    }

    // Warn on likely codepage corruption but don't crash
    if (taskOut.includes('�')) {
      process.stderr.write(
        'deadport: tasklist output contains replacement characters — non-UTF-8 codepage detected. User names may be corrupted.\n',
      );
    }

    const taskEntries = parseTasklist(taskOut);
    // "INFO: No tasks..." → process died between netstat and tasklist (race); skip
    for (const entry of taskEntries) {
      if (entry.pid === pid) {
        pidToProcess.set(pid, {
          pid: entry.pid,
          name: entry.name,
          user: entry.user,
          // tasklist gives the .exe name only; full cmdline requires wmic (TODO(v0.2))
          command: entry.name,
        });
        break;
      }
    }
  }

  // -- 3. Assemble PortHolder[] for every requested port -----------------------
  const holders: PortHolder[] = ports.map((port) => {
    const pids = portToPids.get(port);
    if (!pids) return { port, processes: [] };

    const processes: ProcessInfo[] = [];
    const seen = new Set<number>();
    for (const pid of pids) {
      if (seen.has(pid)) continue;
      seen.add(pid);
      const info = pidToProcess.get(pid);
      if (info) processes.push(info);
    }
    return { port, processes };
  });

  return { ok: true, holders };
}
