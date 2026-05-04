/**
 * E2E tests — spawn a real HTTP server subprocess and run dist/cli.js against it.
 *
 * The server runs in a SEPARATE PROCESS (test/helpers/server.js) so the CLI
 * can actually kill it without taking down the vitest worker.
 *
 * Requirements: `npm run build` must be run before this suite.
 * CI workflow runs `build` before tests (see .github/workflows/ci.yml).
 *
 * Skipped only when the build artifact (dist/cli.js) is absent.
 */

import { describe, it, expect } from 'vitest';
import { execa, type ResultPromise } from 'execa';
import * as net from 'net';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '../dist/cli.js');
const SERVER_HELPER = resolve(__dirname, 'helpers/server.js');
const runE2E = existsSync(CLI);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cli(args: string[]) {
  return execa('node', [CLI, ...args], {
    reject: false,
    // Explicitly pipe all stdio so process.stdin.isTTY === undefined in child
    stdio: ['pipe', 'pipe', 'pipe'],
    // Normalize Windows CRLF so assertions work cross-platform
    stripFinalNewline: false,
  });
}

/** Normalize \r\n → \n for cross-platform string comparisons. */
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

/** Start the helper server as a subprocess. Returns port + cleanup. */
async function startServer(): Promise<{ port: number; proc: ResultPromise }> {
  const proc = execa('node', [SERVER_HELPER], {
    reject: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server start timeout after 5s')), 5000);
    proc.stdout?.on('data', (chunk: Buffer) => {
      const m = String(chunk).match(/PORT:(\d+)/);
      if (m?.[1]) {
        clearTimeout(timer);
        resolve(parseInt(m[1], 10));
      }
    });
    proc.catch(reject);
  });

  return { port, proc };
}

/** Poll until a port refuses connections (= process is dead). */
async function waitFree(port: number, maxMs = 3000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const isFree = await new Promise<boolean>((res) => {
      const sock = net.createConnection({ port, host: '127.0.0.1' });
      sock.once('connect', () => {
        sock.destroy();
        res(false);
      });
      sock.once('error', () => res(true));
    });
    if (isFree) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!runE2E)('E2E — kill flow', () => {
  it('kills a real HTTP server with --force, exits 0, port is free after', async () => {
    const { port, proc } = await startServer();
    try {
      const result = await cli([String(port), '--force']);
      expect(result.exitCode).toBe(0);
      expect(normalize(result.stdout)).toMatch(/terminated/i);
      const free = await waitFree(port);
      expect(free).toBe(true);
    } finally {
      proc.kill();
    }
  });

  it('--check lists the process without killing it, exits 0', async () => {
    const { port, proc } = await startServer();
    try {
      const result = await cli([String(port), '--check']);
      expect(result.exitCode).toBe(0);
      expect(normalize(result.stdout)).toMatch(String(port));
    } finally {
      proc.kill();
    }
  });

  it('exits 1 when port is free', async () => {
    // Start a server to get a valid ephemeral port, then kill it.
    const { port, proc } = await startServer();
    proc.kill();
    await waitFree(port, 2000);

    const result = await cli([String(port), '--force']);
    expect(result.exitCode).toBe(1);
  });

  it('--check on a free port exits 0', async () => {
    // Grab an ephemeral port, kill the server, then verify --check still exits 0
    const { port, proc } = await startServer();
    proc.kill();
    await waitFree(port, 2000);

    const result = await cli([String(port), '--check']);
    expect(result.exitCode).toBe(0);
  });

  it('--check --json on a held port emits status "running"', async () => {
    const { port, proc } = await startServer();
    try {
      const result = await cli([String(port), '--check', '--json']);
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(normalize(result.stdout)) as {
        results: Array<{ port: number; status: string }>;
      };
      expect(parsed.results[0]?.port).toBe(port);
      expect(parsed.results[0]?.status).toBe('running');
    } finally {
      proc.kill();
    }
  });

  it('exits 4 when no TTY and no --force flag', async () => {
    const { port, proc } = await startServer();
    try {
      // stdin is piped (isTTY === undefined) and no --force → must exit 4
      const result = await cli([String(port)]);
      expect(result.exitCode).toBe(4);
      expect(normalize(result.stderr)).toMatch(/TTY/i);
    } finally {
      proc.kill();
    }
  });

  it('--json --force outputs valid JSON matching the CLI.md schema', async () => {
    const { port, proc } = await startServer();
    try {
      const result = await cli([String(port), '--json', '--force']);
      // Accept exit 0 (killed) or 2 (permission) — both produce valid JSON
      expect([0, 2]).toContain(result.exitCode);

      const parsed = JSON.parse(normalize(result.stdout)) as {
        results: Array<{
          port: number;
          status: string;
          process?: { pid: number; name: string; user: string; command: string };
          signal?: string;
          durationMs?: number;
        }>;
      };
      expect(parsed).toHaveProperty('results');
      expect(Array.isArray(parsed.results)).toBe(true);
      const r = parsed.results[0];
      expect(r?.port).toBe(port);
      expect(['killed', 'free', 'permission-denied', 'cancelled', 'error']).toContain(r?.status);
    } finally {
      proc.kill();
    }
  });
});

describe.skipIf(runE2E)('E2E — skipped (build not found)', () => {
  it.skip('placeholder — run npm run build first', () => {});
});
