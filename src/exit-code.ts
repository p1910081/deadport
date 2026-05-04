/**
 * Exit code priority per CLI.md: 5 > 4 > 2 > 3 > 1 > 0.
 * When multiple ports are processed, the reported exit code is the
 * highest-priority code among all results.
 */
const PRIORITY: Readonly<Record<number, number>> = {
  0: 0,
  1: 1,
  3: 2,
  2: 3,
  4: 4,
  5: 5,
};

export function aggregateExitCode(codes: number[]): number {
  if (codes.length === 0) return 0;
  let best = 0;
  for (const code of codes) {
    const cp = PRIORITY[code] ?? 0;
    const bp = PRIORITY[best] ?? 0;
    if (cp > bp) best = code;
  }
  return best;
}
