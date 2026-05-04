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
 * TODO(clarify): the CLI.md JSON schema defines status values for kill results
 * (killed, free, permission-denied, cancelled, error). There is no "running" status.
 * For --check with a held port we emit the process object with status "error" as a
 * placeholder. A future spec clarification should add a "held" status or document
 * that --check reuses the same schema and "free" means nothing is found.
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
      // TODO(clarify): no "running" status in CLI.md schema — see function comment
      const proc = h.processes[0];
      const r: JsonPortResult = { port: h.port, status: 'error' };
      if (proc)
        r.process = { pid: proc.pid, name: proc.name, user: proc.user, command: proc.command };
      return r;
    });
    console.log(formatJson({ results: jsonResults }));
    return;
  }

  printCheckTable(result.holders, opts.verbose);
}
