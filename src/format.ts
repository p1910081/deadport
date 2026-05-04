import pc from 'picocolors';
import type { PortHolder, KillResult } from './types.js';

// ---------------------------------------------------------------------------
// JSON output types
// ---------------------------------------------------------------------------

export interface JsonProcessInfo {
  pid: number;
  name: string;
  user: string;
  command: string;
}

export interface JsonPortResult {
  port: number;
  status: 'killed' | 'free' | 'permission-denied' | 'cancelled' | 'error';
  process?: JsonProcessInfo;
  signal?: string;
  durationMs?: number;
}

export interface JsonOutput {
  results: JsonPortResult[];
}

export function formatJson(output: JsonOutput): string {
  return JSON.stringify(output, null, 2);
}

export function freeResult(port: number): JsonPortResult {
  return { port, status: 'free' };
}

export function killResultToJson(
  port: number,
  holder: PortHolder,
  kill: KillResult,
): JsonPortResult {
  const p = holder.processes[0];
  const proc: JsonProcessInfo | undefined = p
    ? { pid: p.pid, name: p.name, user: p.user, command: p.command }
    : undefined;

  if (kill.ok) {
    const r: JsonPortResult = {
      port,
      status: 'killed',
      signal: kill.signal,
      durationMs: kill.durationMs,
    };
    if (proc) r.process = proc;
    return r;
  }
  const r: JsonPortResult = {
    port,
    status: kill.reason === 'permission' ? 'permission-denied' : 'error',
  };
  if (proc) r.process = proc;
  return r;
}

// ---------------------------------------------------------------------------
// Duration formatting
// ---------------------------------------------------------------------------

/**
 * Format an elapsed duration in milliseconds as a human-readable string.
 * Examples: 0 → "0s", 1500 → "1s", 90000 → "1m 30s", 7200000 → "2h",
 * 90061000 → "1d 1h"
 */
export function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs}s`;

  const totalMins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (totalMins < 60) {
    return secs > 0 ? `${totalMins}m ${secs}s` : `${totalMins}m`;
  }

  const totalHours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (totalHours < 24) {
    return mins > 0 ? `${totalHours}h ${mins}m` : `${totalHours}h`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

const EM = '—';

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

function colWidths(rows: string[][]): number[] {
  if (rows.length === 0) return [];
  const first = rows[0];
  if (!first) return [];
  const widths = first.map((_, i) =>
    rows.reduce((max, row) => {
      const cell = row[i] ?? '';
      return Math.max(max, cell.length);
    }, 0),
  );
  return widths;
}

function renderTable(header: string[], rows: string[][]): string[] {
  const all = [header, ...rows];
  const widths = colWidths(all);
  const lines: string[] = [];

  lines.push(pc.dim(widths.map((w, i) => pad(header[i] ?? '', w + 2)).join('')));
  for (const row of rows) {
    lines.push(widths.map((w, i) => pad(row[i] ?? '', w + 2)).join(''));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Single-port table  (CLI.md "Standard kill" format)
//
//   Port 3000 is held by:
//     PID    NAME    USER    UPTIME    COMMAND
//     48291  node    alex    2h 14m    node server.js
// ---------------------------------------------------------------------------

export function printSinglePortTable(holder: PortHolder, verbose: boolean): void {
  console.log(`\nPort ${pc.bold(String(holder.port))} is held by:`);
  const header = ['PID', 'NAME', 'USER', 'UPTIME', 'COMMAND'];
  const rows = holder.processes.map((p) => {
    const uptime = p.startedAt ? formatDuration(Date.now() - p.startedAt.getTime()) : EM;
    const cmd = verbose ? p.command : p.name;
    return [String(p.pid), p.name, p.user, uptime, cmd];
  });
  for (const line of renderTable(header, rows)) {
    console.log(`  ${line}`);
  }
}

// ---------------------------------------------------------------------------
// Multi-port table  (CLI.md "Multiple ports" format)
//
//   Port   Process       PID    User
//   3000   node          48291  alex
//   8080   python3       12044  alex
//   5432   postgres      —      —      (free)
// ---------------------------------------------------------------------------

export function printMultiPortTable(holders: PortHolder[]): void {
  const header = ['Port', 'Process', 'PID', 'User'];
  const rows = holders.map((h) => {
    const p = h.processes[0];
    if (!p) return [String(h.port), EM, EM, EM, pc.dim('(free)')];
    return [String(h.port), p.name, String(p.pid), p.user];
  });
  for (const line of renderTable(header, rows)) {
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// --check display  (delegates to the appropriate table variant)
// ---------------------------------------------------------------------------

export function printCheckTable(holders: PortHolder[], verbose: boolean): void {
  if (holders.length === 1) {
    const h = holders[0];
    if (!h) return;
    if (h.processes.length === 0) {
      console.log(pc.green(`✓ Port ${h.port} is free.`));
    } else {
      printSinglePortTable(h, verbose);
    }
    return;
  }

  // Multiple ports — use the flat table
  const hasAny = holders.some((h) => h.processes.length > 0);
  if (!hasAny) {
    for (const h of holders) {
      console.log(pc.green(`✓ Port ${h.port} is free.`));
    }
    return;
  }
  printMultiPortTable(holders);
}

// ---------------------------------------------------------------------------
// Kill result output lines
// ---------------------------------------------------------------------------

export function printKillSuccess(pid: number, signal: string, durationMs: number): void {
  console.log(pc.green(`✓ Process ${pid} terminated (${signal}, ${durationMs}ms)`));
}

export function printKillNotFound(port: number): void {
  console.log(pc.green(`✓ Port ${port} is free.`));
}

export function printPermissionDenied(pid: number, owner: string): void {
  console.error(pc.red(`✗ Permission denied. Process ${pid} is owned by '${owner}'.`));
  console.error(`  Try: sudo deadport <port>`);
}
