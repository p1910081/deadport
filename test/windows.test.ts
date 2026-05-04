/**
 * Unit tests for src/lookup/windows.ts.
 *
 * All child_process.execFile calls are mocked — no real processes are spawned.
 * The callback-based spawnCmd wrapper in windows.ts makes this straightforward:
 * mock execFile to call its last arg (the callback) with controlled output.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { execFile } from 'child_process';

// Must be hoisted before the module under test is imported.
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { findOnWindows } from '../src/lookup/windows.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type Cb = (err: Error | null, stdout: string, stderr: string) => void;

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

function mockStdout(stdout: string): void {
  mockExecFile.mockImplementationOnce((_f: string, _a: string[], _o: unknown, cb: Cb) => {
    cb(null, stdout, '');
  });
}

function mockError(code: string): void {
  const err = Object.assign(new Error(code), { code });
  mockExecFile.mockImplementationOnce((_f: string, _a: string[], _o: unknown, cb: Cb) => {
    cb(err, '', '');
  });
}

// Minimal tasklist CSV for a single process
const TASKLIST_NODE =
  '"Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"\r\n' +
  '"node.exe","48291","Console","1","50,652 K","Running","DESKTOP-USER\\\\alex","0:00:01","N/A"\r\n';

const TASKLIST_PYTHON =
  '"Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"\r\n' +
  '"python3.exe","12044","Console","1","30,000 K","Running","DESKTOP-USER\\\\alex","0:00:02","N/A"\r\n';

const NETSTAT_PORT_3000 = [
  'Active Connections',
  '',
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       48291',
  '  TCP    [::]:3000              [::]:0                 LISTENING       48291',
  '',
].join('\n');

const NETSTAT_EMPTY =
  'Active Connections\n\n  Proto  Local Address          Foreign Address        State           PID\n';

const NETSTAT_TWO_PORTS = [
  'Active Connections',
  '',
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       48291',
  '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       12044',
  '  TCP    [::]:3000              [::]:0                 LISTENING       48291',
  '  TCP    127.0.0.1:3000         127.0.0.1:9999         ESTABLISHED     48291',
  '',
].join('\n');

const TASKLIST_NO_MATCH = 'INFO: No tasks are running which match the specified criteria.\n';

beforeEach(() => {
  mockExecFile.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findOnWindows', () => {
  it('calls netstat with -ano -p TCP', async () => {
    mockStdout(NETSTAT_EMPTY);
    await findOnWindows([3000]);

    expect(mockExecFile).toHaveBeenCalledWith(
      'netstat',
      ['-ano', '-p', 'TCP'],
      { encoding: 'utf8' },
      expect.any(Function),
    );
  });

  it('calls tasklist with /FI "PID eq N" /V /FO CSV for each unique PID', async () => {
    mockStdout(NETSTAT_PORT_3000); // netstat → pid 48291
    mockStdout(TASKLIST_NODE); // tasklist for pid 48291
    await findOnWindows([3000]);

    expect(mockExecFile).toHaveBeenCalledWith(
      'tasklist',
      ['/FI', 'PID eq 48291', '/V', '/FO', 'CSV'],
      { encoding: 'utf8' },
      expect.any(Function),
    );
  });

  it('returns ok:true with process info for a held port', async () => {
    mockStdout(NETSTAT_PORT_3000);
    mockStdout(TASKLIST_NODE);
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holders).toHaveLength(1);
    const h = result.holders[0]!;
    expect(h.port).toBe(3000);
    expect(h.processes).toHaveLength(1);
    expect(h.processes[0]).toMatchObject({ pid: 48291, name: 'node.exe' });
  });

  it('IPv4 + IPv6 for same port+pid → single process entry (deduplication)', async () => {
    // NETSTAT_PORT_3000 has both 0.0.0.0:3000 and [::]:3000 with pid 48291
    mockStdout(NETSTAT_PORT_3000);
    mockStdout(TASKLIST_NODE); // called only once for pid 48291
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holders[0]!.processes).toHaveLength(1);
    // tasklist was called exactly twice total (netstat + one tasklist)
    expect(mockExecFile).toHaveBeenCalledTimes(2);
  });

  it('empty netstat → holders with empty processes, no tasklist call', async () => {
    mockStdout(NETSTAT_EMPTY);
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holders[0]!.processes).toHaveLength(0);
    // Only netstat was called, no tasklist
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it('port not in netstat → empty processes for that port', async () => {
    // netstat only has port 8080, we ask for 3000
    mockStdout(
      [
        'Active Connections',
        '',
        '  Proto  Local Address          Foreign Address        State           PID',
        '  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       12044',
        '',
      ].join('\n'),
    );
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holders[0]!.processes).toHaveLength(0);
  });

  it('only LISTENING rows are included (ESTABLISHED/TIME_WAIT ignored)', async () => {
    mockStdout(NETSTAT_TWO_PORTS); // has ESTABLISHED row for pid 48291 on port 3000
    mockStdout(TASKLIST_NODE);
    mockStdout(TASKLIST_PYTHON);
    const result = await findOnWindows([3000, 8080]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const port3000 = result.holders.find((h) => h.port === 3000)!;
    const port8080 = result.holders.find((h) => h.port === 8080)!;
    // ESTABLISHED row should NOT cause a duplicate process entry
    expect(port3000.processes).toHaveLength(1);
    expect(port8080.processes).toHaveLength(1);
  });

  it('INFO: No tasks response (race) → process omitted from holder', async () => {
    mockStdout(NETSTAT_PORT_3000);
    mockStdout(TASKLIST_NO_MATCH); // process died between netstat and tasklist
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Port was found in netstat but process died before tasklist — processes is empty
    expect(result.holders[0]!.processes).toHaveLength(0);
  });

  it('ENOENT from netstat → tool-missing result', async () => {
    mockError('ENOENT');
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('tool-missing');
  });

  it('ENOENT from tasklist → tool-missing result', async () => {
    mockStdout(NETSTAT_PORT_3000);
    mockError('ENOENT'); // tasklist not found
    const result = await findOnWindows([3000]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('tool-missing');
  });

  it('two ports with different PIDs → each gets its own process', async () => {
    mockStdout(NETSTAT_TWO_PORTS);
    // PIDs 48291 (3000) and 12044 (8080) — order depends on Set iteration
    mockStdout(TASKLIST_NODE);
    mockStdout(TASKLIST_PYTHON);
    const result = await findOnWindows([3000, 8080]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.holders).toHaveLength(2);
    const port3000 = result.holders.find((h) => h.port === 3000)!;
    const port8080 = result.holders.find((h) => h.port === 8080)!;
    expect(port3000.processes[0]).toMatchObject({ pid: 48291 });
    expect(port8080.processes[0]).toMatchObject({ pid: 12044 });
  });
});
