export interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  /** Full command line if available, else same as name. */
  command: string;
  startedAt?: Date;
}

export interface PortHolder {
  port: number;
  processes: ProcessInfo[];
}

export type KillResult =
  | { ok: true; pid: number; signal: 'SIGTERM' | 'SIGKILL'; durationMs: number }
  | { ok: false; pid: number; reason: 'permission' | 'not-found' | 'timeout' };

export type LookupResult =
  | { ok: true; holders: PortHolder[] }
  | { ok: false; reason: 'tool-missing' | 'permission' | 'parse-error'; detail?: string };

/** Signals accepted on all platforms. Windows maps non-SIGTERM/SIGKILL to SIGTERM. */
export type Signal = 'SIGTERM' | 'SIGINT' | 'SIGKILL' | 'SIGHUP' | 'SIGQUIT';

export const VALID_SIGNALS: readonly Signal[] = [
  'SIGTERM',
  'SIGINT',
  'SIGKILL',
  'SIGHUP',
  'SIGQUIT',
];

/** Priority order for merging exit codes when multiple ports are processed. */
export const EXIT_CODE_PRIORITY: Record<number, number> = {
  5: 5,
  4: 4,
  2: 3,
  3: 2,
  1: 1,
  0: 0,
};
