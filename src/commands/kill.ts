import pc from 'picocolors';
import { findPortHolders } from '../lookup/index.js';
import { killProcess } from '../kill.js';
import { aggregateExitCode } from '../exit-code.js';
import { isDangerous, dangerDescription } from '../safety.js';
import {
  formatJson,
  freeResult,
  killResultToJson,
  printSinglePortTable,
  printMultiPortTable,
  printKillSuccess,
  printKillNotFound,
  printPermissionDenied,
  type JsonPortResult,
} from '../format.js';
import type { Signal, PortHolder, KillResult } from '../types.js';

export interface KillCommandOptions {
  force: boolean;
  signal: Signal;
  graceSecs: number;
  quiet: boolean;
  json: boolean;
  safety: boolean;
}

interface PortOutcome {
  port: number;
  holder: PortHolder;
  exitCode: number;
  killResult?: KillResult;
  cancelled?: boolean;
}

/**
 * Show the safety warning for a dangerous port and ask the user to confirm.
 * Defaults to "No" (unlike the main kill prompt which defaults to "Yes").
 * Returns true if the user wants to continue, false to skip this port.
 */
async function confirmDangerousPort(holder: PortHolder): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');
  const desc = dangerDescription(holder.port) ?? 'a system service';
  const proc = holder.processes[0];
  const procLine = proc ? `   Process: ${proc.name} (PID ${proc.pid}, ${proc.user})` : '';

  console.log(
    `\n${pc.yellow('⚠')}  Port ${holder.port} is commonly used by ${desc}.` +
      ` Killing it may cause service disruption.`,
  );
  if (procLine) console.log(procLine);

  return confirm({ message: 'Continue?', default: false });
}

/**
 * Ask for final confirmation before killing. Defaults to "Yes".
 * Returns true if the user confirms.
 */
async function confirmKill(count: number): Promise<boolean> {
  const { confirm } = await import('@inquirer/prompts');
  const message = count === 1 ? 'Kill this process?' : `Kill ${count} processes?`;
  return confirm({ message, default: true });
}

/**
 * Main kill flow:
 *   lookup → safety prompt (per dangerous port) → table → confirmation →
 *   kill each process → output results → return highest exit code.
 *
 * No-TTY guard: if stdin is not a TTY and --force/--quiet/--json are not set,
 * refuse and exit 4 with a clear message. Per CLI.md "Non-interactive mode".
 */
export async function runKill(ports: number[], opts: KillCommandOptions): Promise<number> {
  // -- 1. Lookup --------------------------------------------------------------
  const lookupResult = await findPortHolders(ports);
  if (!lookupResult.ok) {
    if (opts.json) {
      console.log(
        formatJson({
          results: ports.map((port) => ({ port, status: 'error' as const })),
        }),
      );
    } else {
      console.error(`deadport: lookup failed — ${lookupResult.detail ?? lookupResult.reason}`);
    }
    return 5;
  }

  const { holders } = lookupResult;
  const outcomes: PortOutcome[] = [];
  const toKill: PortHolder[] = [];

  // -- 2. Separate free ports and decide which to process --------------------
  for (const holder of holders) {
    if (holder.processes.length === 0) {
      if (!opts.quiet && !opts.json) printKillNotFound(holder.port);
      outcomes.push({ port: holder.port, holder, exitCode: 1 });
    } else {
      toKill.push(holder);
    }
  }

  if (toKill.length === 0) {
    if (opts.json) {
      console.log(formatJson({ results: outcomes.map(outcomeToJson) }));
    }
    return aggregateExitCode(outcomes.map((o) => o.exitCode));
  }

  // -- 3. No-TTY guard (before showing any table) ----------------------------
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  if (!opts.force && !opts.quiet && !opts.json && !isInteractive) {
    console.error(
      '✗ No TTY detected. Use --force to kill non-interactively.\n' +
        '  See: https://github.com/p1910081/deadport#non-interactive-mode',
    );
    return 4;
  }

  // -- 4. Safety prompts (per dangerous port, default: No) -------------------
  const confirmed: PortHolder[] = [];
  for (const holder of toKill) {
    if (opts.safety && isDangerous(holder.port) && !opts.force && !opts.quiet && !opts.json) {
      const proceed = await confirmDangerousPort(holder);
      if (!proceed) {
        outcomes.push({ port: holder.port, holder, exitCode: 3, cancelled: true });
        continue;
      }
    }
    confirmed.push(holder);
  }

  if (confirmed.length === 0) {
    if (opts.json) {
      console.log(formatJson({ results: outcomes.map(outcomeToJson) }));
    }
    return aggregateExitCode(outcomes.map((o) => o.exitCode));
  }

  // -- 5. Show table (suppressed by --quiet / --json) ------------------------
  if (!opts.quiet && !opts.json) {
    if (confirmed.length === 1 && confirmed[0]) {
      printSinglePortTable(confirmed[0], false);
    } else {
      // Show all holders (including free ones) in the multi-port table
      printMultiPortTable(holders);
    }
  }

  // -- 6. Final confirmation prompt (skipped by --force / --quiet / --json) --
  if (!opts.force && !opts.quiet && !opts.json) {
    const proceed = await confirmKill(confirmed.length);
    if (!proceed) {
      for (const holder of confirmed) {
        outcomes.push({ port: holder.port, holder, exitCode: 3, cancelled: true });
      }
      if (opts.json) {
        console.log(formatJson({ results: outcomes.map(outcomeToJson) }));
      }
      return aggregateExitCode(outcomes.map((o) => o.exitCode));
    }
  }

  // -- 7. Kill each confirmed process ----------------------------------------
  for (const holder of confirmed) {
    const proc = holder.processes[0];
    if (!proc) {
      outcomes.push({ port: holder.port, holder, exitCode: 1 });
      continue;
    }

    const killResult = await killProcess(proc.pid, {
      signal: opts.signal,
      graceMs: opts.graceSecs * 1000,
    });

    let exitCode: number;
    if (killResult.ok) {
      exitCode = 0;
      if (!opts.quiet && !opts.json) {
        printKillSuccess(proc.pid, killResult.signal, killResult.durationMs);
      }
    } else if (killResult.reason === 'permission') {
      exitCode = 2;
      if (!opts.quiet && !opts.json) {
        printPermissionDenied(proc.pid, proc.user);
      }
    } else {
      exitCode = 5;
      if (!opts.quiet && !opts.json) {
        console.error(pc.red(`✗ Failed to kill process ${proc.pid}: ${killResult.reason}`));
      }
    }

    outcomes.push({ port: holder.port, holder, exitCode, killResult });
  }

  // -- 8. JSON output (single write at the end) ------------------------------
  if (opts.json) {
    console.log(formatJson({ results: outcomes.map(outcomeToJson) }));
  }

  return aggregateExitCode(outcomes.map((o) => o.exitCode));
}

function outcomeToJson(o: PortOutcome): JsonPortResult {
  if (o.exitCode === 1) return freeResult(o.port);
  if (o.cancelled) {
    const r: JsonPortResult = { port: o.port, status: 'cancelled' };
    const proc = o.holder.processes[0];
    if (proc)
      r.process = { pid: proc.pid, name: proc.name, user: proc.user, command: proc.command };
    return r;
  }
  if (o.killResult) return killResultToJson(o.port, o.holder, o.killResult);
  return { port: o.port, status: 'error' };
}
