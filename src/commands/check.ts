import { findPortHolders } from '../lookup/index.js';
import { formatJson, freeResult, type JsonOutput, type JsonPortResult } from '../format.js';
import { printCheckTable } from '../format.js';

export interface CheckOptions {
  json: boolean;
  verbose: boolean;
}

/**
 * --check flow: look up port holders, display info, do not kill anything.
 * Always exits 0 per CLI.md spec.
 *
 * JSON status values per CLI.md:
 *   - "free"    → port has no listening process
 *   - "running" → port is held, but we did not kill (check-mode only)
 *   - "error"   → lookup failed
 */
export async function runCheck(ports: number[], opts: CheckOptions): Promise<void> {
  const result = await findPortHolders(ports);

  if (!result.ok) {
    if (opts.json) {
      const output: JsonOutput = {
        results: ports.map((port) => ({ port, status: 'error' as const })),
      };
      console.log(formatJson(output));
    } else {
      console.error(`Error: ${result.detail ?? result.reason}`);
    }
    return;
  }

  if (opts.json) {
    const jsonResults: JsonPortResult[] = result.holders.map((h) => {
      if (h.processes.length === 0) return freeResult(h.port);
      const proc = h.processes[0];
      const r: JsonPortResult = { port: h.port, status: 'running' };
      if (proc)
        r.process = { pid: proc.pid, name: proc.name, user: proc.user, command: proc.command };
      return r;
    });
    console.log(formatJson({ results: jsonResults }));
    return;
  }

  printCheckTable(result.holders, opts.verbose);
}
