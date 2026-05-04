# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0-beta.1] — 2026-05-03

### Added (Day 3 — Windows support + beta release)

**Windows lookup (`src/lookup/windows.ts`)**
- `findOnWindows(ports)` — wires `netstat -ano -p TCP` → `parseNetstat` → `tasklist /FI "PID eq N" /V /FO CSV` → `parseTasklist`
- ENOENT from either tool → `{ ok: false, reason: 'tool-missing' }` with clear detail string
- Empty netstat → early return with empty process lists, no tasklist calls
- IPv4 + IPv6 rows for the same port+PID deduplicated to a single `ProcessInfo` entry
- "INFO: No tasks..." tasklist response (race condition — process died) handled gracefully
- Non-UTF-8 codepage warning written to stderr; never crashes on `�` characters
- `TODO(perf)`: PowerShell `Get-NetTCPConnection` noted for v0.3
- `TODO(v0.2)`: full cmdline via wmic noted (tasklist gives `.exe` name only)

**Fixtures**
- `test/fixtures/netstat/windows-multi-state.txt` — LISTENING + ESTABLISHED + TIME_WAIT mix
- `test/fixtures/tasklist/no-match.txt` — "INFO: No tasks..." race-condition response
- `test/fixtures/cases.json` — two new cases: multi-state netstat, no-match tasklist

**Tests**
- `test/windows.test.ts` — 11 unit tests with `vi.mock('child_process')`: correct args, LISTENING-only filter, IPv4+IPv6 dedup, empty netstat skips tasklist, INFO response = race, ENOENT from netstat, ENOENT from tasklist, unrequested port ignored, two-port merge

**CI**
- `build` step moved before `npm test` so E2E tests always have `dist/cli.js`
- E2E `runE2E` guard drops the `!isWindows` condition — Windows now runs E2E
- E2E assertions use `normalize()` helper to collapse `\r\n` → `\n` cross-platform

### Quality bar (Day 3)
- **101+ tests passing** (91 existing + 11 windows unit tests - 1 skipped placeholder)
- `npm run check` — zero TypeScript errors
- `npm run lint` — ESLint + Prettier both green
- Windows lookup fully wired — `deadport <port> -f` functional on Windows

### Still stubbed / TODOs remaining
- `src/lookup/linux-proc.ts` — `/proc` fallback for Alpine/no-lsof Linux
- `ProcessInfo.command` full cmdline — lsof `-F c` gives name only; `--verbose` needs `ps`; Windows needs `wmic` (`TODO(v0.2)`)
- `--check` JSON status for held ports — uses `"error"` as placeholder; CLI.md has no `"running"` status (`TODO(clarify)`)
- `KillResult.signal` type — non-SIGKILL initial signals reported as `'SIGTERM'` (`TODO(v0.2)`)
- `ProcessInfo.startedAt` — not populated; UPTIME column shows `—`

---

## [0.1.0] — 2026-05-01

### Added (Day 2 — kill flow + polish)

**Kill engine (`src/kill.ts`)**
- `killProcess(pid, { signal, graceMs })` — SIGTERM → poll every 50ms → escalate SIGKILL after grace period → poll 500ms → return `KillResult`
- Error mapping: `EPERM` → `permission`, `ESRCH` → `not-found`, poll timeout → `timeout`
- Windows: SIGKILL routed through `taskkill /F`; all other signals via `process.kill` (graceful); `TODO(v0.2)` for proper win32 grace period

**Kill command (`src/commands/kill.ts`)**
- Full orchestration: lookup → no-TTY guard (exit 4 + clear message) → per-port safety prompt (dangerous ports, default No) → aligned table → final confirmation prompt (default Yes) → kill loop → JSON/text output
- Lazy-loaded `@inquirer/prompts` (only when a TTY prompt is actually shown) — cold start unaffected
- `--force`, `--quiet`, `--json` all suppress prompts/tables correctly
- `--json` output written in a single `console.log` at the end

**Exit code aggregation (`src/exit-code.ts`)**
- `aggregateExitCode(codes)` — priority `5 > 4 > 2 > 3 > 1 > 0` per CLI.md spec

**Format polish (`src/format.ts`)**
- `formatDuration(ms)` — `0s`, `1m 30s`, `2h`, `3d 4h` etc.
- `printSinglePortTable` — aligned PID/NAME/USER/UPTIME/COMMAND (single-port kill format)
- `printMultiPortTable` — aligned Port/Process/PID/User with `—` for free ports (multi-port format)
- `printCheckTable` — dispatches to single or multi table based on input length
- `printKillSuccess`, `printKillNotFound`, `printPermissionDenied` output helpers
- Column widths auto-computed from data; headers dim-styled via picocolors

**Tests**
- `test/kill.test.ts` — 6 unit tests with mocked `process.kill`: immediate death, grace-period death, SIGKILL escalation, direct SIGKILL, EPERM, ESRCH
- `test/format.test.ts` — 15 tests: 11 `formatDuration` edge cases, 4 JSON output shape tests
- `test/exit-code.test.ts` — 17 tests: all single-code identities + priority ordering matrix
- `test/e2e.test.ts` — 5 real E2E tests (all passing): kill with --force, --check, free port, no-TTY guard, --json schema validation; server runs as a separate subprocess to avoid killing the test runner

**Infrastructure**
- `test/helpers/server.js` — minimal HTTP server subprocess helper for E2E tests
- Added `execa` as devDep for E2E subprocess control

### Quality bar (Day 2)
- **91 tests passing**, 1 skipped (Windows placeholder)
- `npm run check` — zero TypeScript errors
- `npm run lint` — ESLint + Prettier both green
- Cold start: **~48ms** (`node dist/cli.js --version`) — well under the 200ms budget
- `deadport <port> -f` — kills a real process, exits 0, prints `✓ Process N terminated (SIGTERM, Nms)`
- `deadport <port> --json -f` — valid JSON, schema matches CLI.md exactly
- `deadport 22` (no sudo) — safety prompt shown, default No  ← requires TTY to test interactively
- `deadport 80 -f` (no sudo) — exits 2, permission-denied printed

### Still stubbed / TODOs remaining

- `src/lookup/windows.ts` — `TODO(v0.1)`: netstat + tasklist parsers exist, not wired
- `src/lookup/linux-proc.ts` — `TODO(v0.1)`: /proc fallback
- `ProcessInfo.command` full cmdline — lsof `-F c` gives name only; `--verbose` needs a `ps` call
- `--check` JSON status for held ports — uses `"error"` as placeholder; CLI.md has no `"running"` status (`TODO(clarify)`)
- `KillResult.signal` type — only `'SIGTERM' | 'SIGKILL'`; non-SIGKILL initial signals reported as `'SIGTERM'` (`TODO(v0.2)`)
- `ProcessInfo.startedAt` — not populated by lsof parser; UPTIME column shows `—`
- E2E skipped on Windows (skip guard in place)

### Scaffolded (v0.1.0-alpha)

**Config & tooling**
- `package.json` with `type: module`, all dev scripts (`build`, `dev`, `test`, `test:e2e`, `lint`, `fix`, `check`), bin entry `deadport → dist/cli.js`
- `tsconfig.json` — strict mode, ES2022, ESNext modules, bundler resolution, `noUncheckedIndexedAccess`
- `tsup.config.ts` — ESM + CJS dual output, shebang preserved, minify in production
- `vitest.config.ts` — v8 coverage provider
- `.eslintrc.cjs` + `.prettierrc` — minimal, opinionated defaults
- `.github/workflows/ci.yml` — matrix: `[ubuntu-latest, macos-latest, windows-latest]` × Node `[18, 20, 22]`
- `.github/workflows/release.yml` — on tag push, publish to npm (requires `NPM_TOKEN` secret)

**Fully implemented**
- `src/types.ts` — `ProcessInfo`, `PortHolder`, `KillResult`, `LookupResult`, `Signal` types; Result discriminated union pattern
- `src/safety.ts` — 12 dangerous ports (22, 25, 80, 110, 143, 443, 3306, 5432, 5672, 6379, 9200, 27017) + `isDangerous()` + `dangerDescription()`
- `src/parse-args.ts` — pure port string parser: single, `:3000`, `3000-3010`, `3000,8080`, multi-arg, deduplication, validates 1–65535
- `src/lookup/parsers/lsof.ts` — pure state machine parser for `lsof -F pcuLn` output, deduplicates by PID
- `src/lookup/unix.ts` — real `lsof` invocation (macOS/Linux); `--check` works on the dev machine
- `src/lookup/index.ts` — platform dispatcher (Windows → windows.ts, macOS → unix.ts, Linux → unix.ts with /proc fallback)
- `src/format.ts` — JSON output fully working; table renderer for `--check` (basic, no alignment)
- `src/commands/check.ts` — `--check` flow end-to-end: lookup → format → print
- `src/cli.ts` — commander with exact flags from `CLI.md`, `--version` → 0.1.0, `--help`, proper exit codes 0–5

**Stubbed (typed, marked TODO)**
- `src/lookup/windows.ts` — returns `tool-missing` until Windows lookup is implemented
- `src/lookup/linux-proc.ts` — `/proc` fallback stub
- `src/lookup/parsers/netstat.ts` — implemented but not wired into windows.ts
- `src/lookup/parsers/tasklist.ts` — implemented but not wired into windows.ts
- `src/kill.ts` — signature only, throws "not implemented"
- `src/commands/kill.ts` — skeleton with full TODO spec in comment
- `src/format.ts` — table renderer is functional but not aligned/padded per CLI.md spec

**Tests**
- `test/parsers.test.ts` — cases.json driver for lsof, netstat, tasklist parsers (7 cases)
- `test/parse-args.test.ts` — exhaustive coverage: 10 valid + 8 invalid cases (18 tests)
- `test/safety.test.ts` — all 12 dangerous ports + 7 safe ports + 4 description cases (23 tests)
- `test/e2e.test.ts` — stubbed (skipped) pending kill implementation
- `test/fixtures/` — lsof/{single,multi-pid,ipv4-and-ipv6,empty}.txt, netstat/{windows-basic,windows-empty}.txt, tasklist/single.csv, cases.json (language-agnostic, Go-portable)

### What's stubbed / blocked

- `runKill` → `--force` mode not functional yet; CLI exits 5 with a clear message pointing to `--check`
- Windows lookup → not implemented (`netstat` + `tasklist` parsers are ready but not wired)
- `/proc` fallback → not implemented (Alpine / no-lsof Linux)
- Full command line in `ProcessInfo.command` → lsof `-F c` gives name only; `--verbose` full cmdline needs a separate `ps` call
- `--check` JSON status for held ports → CLI.md schema has no "running" status; flagged as `TODO(clarify)`
- Table alignment in `format.ts` → functional but not column-padded per CLI.md output examples

### Next steps (Day 2)

1. Implement `src/kill.ts` — SIGTERM → grace → SIGKILL, EPERM handling
2. Implement `src/commands/kill.ts` — confirmation prompt (lazy-load `@inquirer/prompts`), safety warning, multi-port loop
3. Wire up `src/lookup/windows.ts` — `netstat` + `tasklist` parsers are ready
4. Polish `format.ts` table with proper column alignment
5. E2E tests once kill works
