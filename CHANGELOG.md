# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.2.0-beta.2] — 2026-05-15

### Fixed

- **`YOUR_USERNAME` placeholders** — replaced with `p1910081` across:
  - `package.json` (Repository / Homepage / Bugs URL — were broken links on the npmjs.com sidebar in beta.1)
  - `src/commands/kill.ts` (broken doc link in the no-TTY runtime error message)
  - `BETA.md` (broken issue submission link)

### Changed

- **README** — embedded asciinema demo recording, fixed Markdown code blocks formatting
- **Repository structure** — removed obsolete `deadport-docs/` scaffold directory (duplicate of `docs/`)

---

## [0.2.0-beta.1] — 2026-05-14

First public beta release.

### Added

**Windows lookup (`src/lookup/windows.ts`)**

- `findOnWindows(ports)` — wires `netstat -ano -p TCP` → `parseNetstat` → `tasklist /FI "PID eq N" /V /FO CSV` → `parseTasklist`
- ENOENT from either tool → `{ ok: false, reason: 'tool-missing' }` with clear detail string
- Empty netstat → early return, no tasklist calls
- IPv4 + IPv6 rows for the same port+PID deduplicated to a single `ProcessInfo` entry
- "INFO: No tasks..." tasklist response (race condition — process died between netstat and tasklist) handled gracefully
- Non-UTF-8 codepage warning written to stderr; never crashes on `�` characters

**Windows kill flow (`src/kill.ts`)**

- SIGTERM on Windows now sends `process.kill(pid)` with no signal arg (WM_CLOSE), allowing clean shutdown
- Grace period honored on Windows — escalation only fires after `graceMs` elapses
- Forced kill on Windows routes through `taskkill /PID <pid> /F` instead of POSIX `SIGKILL`
- Unified `forcedKill(pid)` abstraction: `taskkill /F` on Windows, `SIGKILL` on Unix
- `KillResult.signal` correctly reflects reality: `'SIGTERM'` for graceful exit, `'SIGKILL'` for forced

**Check command contract (`src/commands/check.ts`, `src/format.ts`)**

- `--check --json` now returns `status: "running"` (not `"error"`) for ports that are held
- `JsonPortResult.status` type expanded to include `'running'`

**No-TTY documentation (`src/commands/kill.ts`)**

- Error message updated to point users at `--force` and the README non-interactive-mode section

**Fixtures**

- `test/fixtures/netstat/windows-multi-state.txt` — LISTENING + ESTABLISHED + TIME_WAIT mix
- `test/fixtures/tasklist/no-match.txt` — "INFO: No tasks..." race-condition response
- `test/fixtures/cases.json` — two new cases: multi-state netstat, no-match tasklist

**Tests**

- `test/windows.test.ts` — 11 unit tests with `vi.mock('child_process')`: correct args, LISTENING-only filter, IPv4+IPv6 dedup, empty netstat skips tasklist, INFO response = race, ENOENT from netstat, ENOENT from tasklist, unrequested port ignored, two-port merge
- `test/check.test.ts` — 5 unit tests: `running` for held port, `free` for empty result, `error` for lookup failure, process details present, mixed free+held ports
- `test/kill.test.ts` — 4 new Windows-specific tests: WM_CLOSE dispatch, graceful no-taskkill, grace-expired taskkill, SIGKILL routes to taskkill

**CI**

- `build` step moved before `npm test` so E2E tests always have `dist/cli.js`
- E2E `runE2E` guard drops the `!isWindows` condition — Windows now runs E2E
- E2E assertions use `normalize()` helper to collapse `\r\n` → `\n` cross-platform
- Bumped `actions/checkout` to v5 and `actions/setup-node` to v5

**Publish prep**

- `package.json` — `files`, `keywords`, `homepage`, `repository` fields fully set
- `LICENSE` — MIT license added
- `BETA.md` — beta tester guide (what works, what's stubbed, install instructions)
- `.github/post-beta-issues/` — three pre-written issue drafts for post-beta work

### Fixed

- **Windows kill flow bugs**: Three bugs corrected — grace period was bypassed for all Windows signals; POSIX signals were sent on Windows instead of WM_CLOSE; escalation used `process.kill(SIGKILL)` instead of `taskkill /F`
- **`--check --json` held-port status**: Was returning `status: "error"` as a placeholder for held ports; now correctly returns `status: "running"`
- **Stale hardcoded version**: `src/cli.ts` was outputting `0.1.0` for `--version`; updated to `0.2.0-beta.1`
- **Unmocked `execFile` in kill tests**: On Windows CI, the escalation path called real `taskkill` against a fake PID; fixed by adding `vi.mock('child_process')` to `test/kill.test.ts`
- **CI YAML syntax error**: An edit introduced `- uses:` as a list item nested under `name:`; fixed to `uses:`

### Changed

- **Line endings**: `.gitattributes` (`eol=lf`) + `.prettierrc` (`endOfLine: "lf"`) enforce LF everywhere; fixes Prettier failures on Windows CI runners where Git's `core.autocrlf=true` was converting LF → CRLF on checkout

---

## [0.1.0] — 2026-05-01 (internal milestone, not published)

This version was never published to npm — it represents the internal scaffold milestone (Days 1–2 of development) before the cross-platform Windows work that landed in `0.2.0-beta.1`.

### Added (Day 2 — kill flow + polish)

**Kill engine (`src/kill.ts`)**

- `killProcess(pid, { signal, graceMs })` — SIGTERM → poll every 50ms → escalate SIGKILL after grace period → poll 500ms → return `KillResult`
- Error mapping: `EPERM` → `permission`, `ESRCH` → `not-found`, poll timeout → `timeout`

**Kill command (`src/commands/kill.ts`)**

- Full orchestration: lookup → no-TTY guard (exit 4 + clear message) → per-port safety prompt (dangerous ports, default No) → aligned table → final confirmation prompt (default Yes) → kill loop → JSON/text output
- Lazy-loaded `@inquirer/prompts` (only when a TTY prompt is actually shown) — cold start unaffected
- `--force`, `--quiet`, `--json` all suppress prompts/tables correctly
- `--json` output written in a single `console.log` at the end

**Exit code aggregation (`src/exit-code.ts`)**

- `aggregateExitCode(codes)` — priority `5 > 4 > 2 > 3 > 1 > 0` per CLI.md spec

**Format polish (`src/format.ts`)**

- `formatDuration(ms)` — `0s`, `1m 30s`, `2h`, `3d 4h` etc.
- `printSinglePortTable`, `printMultiPortTable`, `printCheckTable` — aligned column output
- Column widths auto-computed from data; headers dim-styled via picocolors

**Tests**

- `test/kill.test.ts` — 6 unit tests with mocked `process.kill`: immediate death, grace-period death, SIGKILL escalation, direct SIGKILL, EPERM, ESRCH
- `test/format.test.ts` — 15 tests: 11 `formatDuration` edge cases, 4 JSON output shape tests
- `test/exit-code.test.ts` — 17 tests: all single-code identities + priority ordering matrix
- `test/e2e.test.ts` — 5 real E2E tests: kill with --force, --check, free port, no-TTY guard, --json schema validation

**Infrastructure**

- `test/helpers/server.js` — minimal HTTP server subprocess helper for E2E tests
- Added `execa` as devDep for E2E subprocess control

### Added (v0.1.0-alpha — scaffold)

**Config & tooling**

- `package.json` with `type: module`, all dev scripts, bin entry `deadport → dist/cli.js`
- `tsconfig.json` — strict mode, ES2022, ESNext modules, `noUncheckedIndexedAccess`
- `tsup.config.ts` — ESM + CJS dual output, shebang preserved
- `vitest.config.ts` — v8 coverage provider
- `.eslintrc.cjs` + `.prettierrc` — minimal, opinionated defaults
- `.github/workflows/ci.yml` — matrix: `[ubuntu-latest, macos-latest, windows-latest]` × Node `[18, 20, 22]`
- `.github/workflows/release.yml` — on tag push, publish to npm

**Core modules**

- `src/types.ts` — `ProcessInfo`, `PortHolder`, `KillResult`, `LookupResult`, `Signal`; Result discriminated union pattern
- `src/safety.ts` — 12 dangerous ports + `isDangerous()` + `dangerDescription()`
- `src/parse-args.ts` — pure port string parser: single, `:3000`, ranges, comma-lists, deduplication
- `src/lookup/parsers/lsof.ts` — pure state machine parser for `lsof -F pcuLn`
- `src/lookup/parsers/netstat.ts` + `src/lookup/parsers/tasklist.ts` — Windows parsers
- `src/lookup/unix.ts` — real `lsof` invocation (macOS/Linux)
- `src/lookup/index.ts` — platform dispatcher
- `src/commands/check.ts` — `--check` flow end-to-end
- `src/cli.ts` — commander with exact flags from CLI.md

**Tests**

- `test/parsers.test.ts` — cases.json fixture driver for lsof, netstat, tasklist parsers
- `test/parse-args.test.ts` — 18 tests: 10 valid + 8 invalid cases
- `test/safety.test.ts` — 23 tests: all 12 dangerous ports + 7 safe + 4 description cases
- `test/fixtures/` — language-agnostic fixture files, Go-portable via `cases.json`
