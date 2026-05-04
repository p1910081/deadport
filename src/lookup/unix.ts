import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LookupResult, PortHolder } from '../types.js';
import { parseLsof } from './parsers/lsof.js';

const execFileAsync = promisify(execFile);

/**
 * Look up which process(es) are listening on the given ports using lsof.
 * Runs: `lsof -nP -iTCP:<port> -sTCP:LISTEN -F pcuLn`
 */
export async function findOnUnix(ports: number[]): Promise<LookupResult> {
  const holders: PortHolder[] = [];

  for (const port of ports) {
    let stdout: string;
    try {
      const result = await execFileAsync('lsof', [
        '-nP',
        `-iTCP:${port}`,
        '-sTCP:LISTEN',
        '-F',
        'pcuLn',
      ]);
      stdout = result.stdout;
    } catch (err: unknown) {
      // lsof exits with code 1 when nothing is found — that is not an error.
      const asExecError = err as { code?: number | string; stdout?: string; stderr?: string };
      if (asExecError.code === 1) {
        holders.push({ port, processes: [] });
        continue;
      }
      // lsof not found
      if (asExecError.code === 'ENOENT' || (asExecError.stderr ?? '').includes('not found')) {
        return { ok: false, reason: 'tool-missing', detail: 'lsof not found on PATH' };
      }
      return {
        ok: false,
        reason: 'permission',
        detail: String(err),
      };
    }

    const processes = parseLsof(stdout);
    holders.push({ port, processes });
  }

  return { ok: true, holders };
}
