const MIN_PORT = 1;
const MAX_PORT = 65535;

type ParseOk = { ok: true; ports: number[] };
type ParseErr = { ok: false; reason: string };
export type ParseResult = ParseOk | ParseErr;

function validatePort(n: number): string | null {
  if (!Number.isInteger(n) || n < MIN_PORT || n > MAX_PORT) {
    return `Port ${n} is out of range (1–65535)`;
  }
  return null;
}

function parseSingleToken(token: string): ParseResult {
  // Strip leading colon: ":3000" → "3000"
  const stripped = token.startsWith(':') ? token.slice(1) : token;

  // Range: "3000-3010"
  if (/^\d+-\d+$/.test(stripped)) {
    const dash = stripped.indexOf('-');
    const lo = parseInt(stripped.slice(0, dash), 10);
    const hi = parseInt(stripped.slice(dash + 1), 10);
    const errLo = validatePort(lo);
    if (errLo) return { ok: false, reason: errLo };
    const errHi = validatePort(hi);
    if (errHi) return { ok: false, reason: errHi };
    if (lo > hi) return { ok: false, reason: `Range start ${lo} is greater than end ${hi}` };
    const ports: number[] = [];
    for (let p = lo; p <= hi; p++) ports.push(p);
    return { ok: true, ports };
  }

  // Comma list: "3000,8080,5432"
  if (stripped.includes(',')) {
    const parts = stripped.split(',');
    const ports: number[] = [];
    for (const part of parts) {
      const n = parseInt(part.trim(), 10);
      if (isNaN(n)) return { ok: false, reason: `"${part.trim()}" is not a valid port number` };
      const err = validatePort(n);
      if (err) return { ok: false, reason: err };
      ports.push(n);
    }
    return { ok: true, ports };
  }

  // Single port
  const n = parseInt(stripped, 10);
  if (isNaN(n) || stripped.trim() === '') {
    return { ok: false, reason: `"${token}" is not a valid port specifier` };
  }
  const err = validatePort(n);
  if (err) return { ok: false, reason: err };
  return { ok: true, ports: [n] };
}

/**
 * Parse one or more port specifier strings (from argv) into a deduplicated, sorted list.
 * Accepts: single ("3000"), colon (":3000"), range ("3000-3010"), comma list ("3000,8080"),
 * and combinations across multiple args.
 */
export function parsePorts(args: string[]): ParseResult {
  if (args.length === 0) {
    return { ok: false, reason: 'At least one port argument is required' };
  }

  const all: number[] = [];
  for (const arg of args) {
    const result = parseSingleToken(arg);
    if (!result.ok) return result;
    all.push(...result.ports);
  }

  // Deduplicate, preserving first-seen order (not sorting, to match user intent)
  const seen = new Set<number>();
  const ports: number[] = [];
  for (const p of all) {
    if (!seen.has(p)) {
      seen.add(p);
      ports.push(p);
    }
  }

  return { ok: true, ports };
}
