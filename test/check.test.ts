/**
 * Unit tests for src/commands/check.ts.
 * Verifies JSON status values per the CLI.md contract.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/lookup/index.js', () => ({
  findPortHolders: vi.fn(),
}));

import { findPortHolders } from '../src/lookup/index.js';
import { runCheck } from '../src/commands/check.js';

const mockFind = findPortHolders as ReturnType<typeof vi.fn>;

function captureLog(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));
  return { lines, restore: () => (console.log = orig) };
}

beforeEach(() => {
  mockFind.mockReset();
});

describe('runCheck JSON output', () => {
  it('emits status "running" for a held port', async () => {
    mockFind.mockResolvedValueOnce({
      ok: true,
      holders: [
        { port: 3000, processes: [{ pid: 48291, name: 'node', user: 'alex', command: 'node' }] },
      ],
    });

    const { lines, restore } = captureLog();
    await runCheck([3000], { json: true, verbose: false });
    restore();

    const parsed = JSON.parse(lines.join('\n')) as {
      results: Array<{ port: number; status: string; process?: { pid: number } }>;
    };
    expect(parsed.results[0]?.status).toBe('running');
    expect(parsed.results[0]?.port).toBe(3000);
    expect(parsed.results[0]?.process?.pid).toBe(48291);
  });

  it('emits status "free" for a port with no listening process', async () => {
    mockFind.mockResolvedValueOnce({
      ok: true,
      holders: [{ port: 3000, processes: [] }],
    });

    const { lines, restore } = captureLog();
    await runCheck([3000], { json: true, verbose: false });
    restore();

    const parsed = JSON.parse(lines.join('\n')) as { results: Array<{ status: string }> };
    expect(parsed.results[0]?.status).toBe('free');
  });

  it('emits status "error" when lookup fails', async () => {
    mockFind.mockResolvedValueOnce({ ok: false, reason: 'tool-missing', detail: 'lsof not found' });

    const { lines, restore } = captureLog();
    await runCheck([3000], { json: true, verbose: false });
    restore();

    const parsed = JSON.parse(lines.join('\n')) as { results: Array<{ status: string }> };
    expect(parsed.results[0]?.status).toBe('error');
  });

  it('includes process details in the "running" result', async () => {
    mockFind.mockResolvedValueOnce({
      ok: true,
      holders: [
        {
          port: 8080,
          processes: [{ pid: 12044, name: 'python3', user: 'alex', command: 'python3 app.py' }],
        },
      ],
    });

    const { lines, restore } = captureLog();
    await runCheck([8080], { json: true, verbose: false });
    restore();

    const parsed = JSON.parse(lines.join('\n')) as {
      results: Array<{ status: string; process?: { name: string; user: string; command: string } }>;
    };
    expect(parsed.results[0]?.status).toBe('running');
    expect(parsed.results[0]?.process?.name).toBe('python3');
    expect(parsed.results[0]?.process?.user).toBe('alex');
    expect(parsed.results[0]?.process?.command).toBe('python3 app.py');
  });

  it('handles mixed free + held ports in one call', async () => {
    mockFind.mockResolvedValueOnce({
      ok: true,
      holders: [
        { port: 3000, processes: [{ pid: 48291, name: 'node', user: 'alex', command: 'node' }] },
        { port: 8080, processes: [] },
      ],
    });

    const { lines, restore } = captureLog();
    await runCheck([3000, 8080], { json: true, verbose: false });
    restore();

    const parsed = JSON.parse(lines.join('\n')) as {
      results: Array<{ port: number; status: string }>;
    };
    const r3000 = parsed.results.find((r) => r.port === 3000);
    const r8080 = parsed.results.find((r) => r.port === 8080);
    expect(r3000?.status).toBe('running');
    expect(r8080?.status).toBe('free');
  });
});
