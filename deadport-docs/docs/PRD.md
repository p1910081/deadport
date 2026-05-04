# PRD — `deadport`

> Kill the process holding a port. One command, zero Stack Overflow tabs.

**Status:** Draft v1
**Owner:** [you]
**Target release:** v1.0.0 (2 days of work, solo)

---

## 1. Context & problem

Every dev has hit this 50+ times:

```
Error: listen EADDRINUSE: address already in use :::3000
```

Current workflow varies by OS:

- **macOS/Linux**: `lsof -i :3000` → note PID → `kill -9 <pid>`
- **Windows**: `netstat -ano | findstr :3000` → `taskkill /PID <pid> /F`

Three problems:

1. Nobody remembers the command → we Google it every single time
2. Cross-platform = cross-syndrome (the Mac command does not work on Windows)
3. No confirmation, no context on the process being killed

**Target audience:** full-stack devs juggling Node/Python/Docker projects across Mac/Linux/Windows.

---

## 2. Goals

### In scope (v1)

- One memorable command: `deadport 3000`
- Cross-platform with no native dependencies
- Show **who** holds the port before killing (process name, PID, command, user)
- Confirmation by default, `--force` to skip
- One-liner install (`npm i -g deadport`)
- Cold start < 200ms

### Out of scope (v1)

- No GUI
- No continuous monitoring (that is the `whatsrunning` idea, separate tool)
- No advanced range syntax beyond basics
- No remote/SSH support

---

## 3. User stories

1. **Dominant case** — `deadport 3000` → "Node.js (PID 48291, started 2h ago) — Kill? [Y/n]" → ✅
2. **In a hurry** — `deadport 3000 -f` → kill direct, minimal output
3. **Multi-port** — `deadport 3000 8080 5432` → list all, confirm once
4. **Range** — `deadport 3000-3010` → useful for microservices
5. **Info-only** — `deadport 3000 --check` → display without killing
6. **Safety** — `deadport 22` or `deadport 80` → explicit warning before action (system ports)

---

## 4. CLI specification

See [`docs/CLI.md`](./CLI.md) for the full canonical reference.

Quick summary:

```
deadport <port> [<port>...] [options]

Options:
  -f, --force       Skip confirmation
  -c, --check       Show what is running, do not kill
  -s, --signal      Signal to send (default: SIGTERM, escalates to SIGKILL after 2s)
  -q, --quiet       Minimal output (script-friendly)
  -j, --json        JSON output (for piping)
  -v, --verbose     Show full command line of process
  -h, --help
  -V, --version

Exit codes:
  0   Killed (or nothing to kill in --check mode)
  1   Port not in use
  2   Permission denied (need sudo)
  3   User cancelled
  4   Invalid argument
```

---

## 5. Technical architecture

### Stack

| Choice                       | Why                                                                       |
| ---------------------------- | ------------------------------------------------------------------------- |
| **Node.js + TypeScript**     | npm-native audience, trivial install, cross-platform free                 |
| **No native deps**           | `lsof` / `netstat` via `child_process` — no compilation, no post-install nerd-sniping |
| **`commander`**              | CLI parsing, mature, small                                                |
| **`@inquirer/prompts`**      | TTY-aware confirmations                                                   |
| **`picocolors`**             | Colors (8kb vs `chalk`)                                                   |
| **`vitest`**                 | Tests                                                                     |
| **`tsup`**                   | Bundle ESM+CJS                                                            |

### Cross-platform detection

Three implementations behind a common interface:

```ts
interface PortLookup {
  find(port: number): Promise<ProcessInfo[]>;
}

interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  command: string;
  startedAt?: Date;
}
```

- **macOS / Linux** → `lsof -nP -iTCP:<port> -sTCP:LISTEN -F pcuLn` (machine-readable format)
- **Windows** → `netstat -ano -p TCP` then `tasklist /FI "PID eq <pid>" /V /FO CSV`
- **Linux without lsof fallback** → read `/proc/net/tcp` + `/proc/<pid>/comm` directly (useful in Alpine containers)

### Kill strategy

```
1. SIGTERM
2. Wait 2s (configurable via --grace)
3. Still alive? → SIGKILL
4. Verify port is free
```

On Windows: `taskkill /PID <pid>` then `taskkill /PID <pid> /F`.

### Permissions

If `EPERM` or `EACCES` → clear message:

```
✗ Permission denied. Process 1234 is owned by 'root'.
  Try: sudo deadport 3000
```

No auto-sudo. Ever.

---

## 6. Project structure

See [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for the full layout and conventions.

---

## 7. Roadmap (2 days, solo)

### Day 1 — Core working

- **Morning (3h)**: scaffold, CLI parsing, `lookup/unix.ts` with `lsof` parser, unit tests on stdout fixtures
- **Afternoon (4h)**: kill + signal escalation, confirmation prompt, table format, first end-to-end `deadport 3000` working on Mac/Linux

### Day 2 — Polish & cross-platform

- **Morning (3h)**: `lookup/windows.ts` with netstat+tasklist CSV parsing, fixture-based tests
- **Afternoon (4h)**: multi-port, ranges, `--check`, `--json`, `--quiet`, safety list, README with asciinema GIF, npm publish

**Stretch (day 3 if motivated)**: `/proc` fallback for Alpine, shell completions (zsh/bash/fish), homebrew tap.

---

## 8. Post-v1 roadmap

- **v1.x (Node)**: bug fixes, shell completions, homebrew tap for bun-compiled binary
- **v2.0 (Go rewrite)**:
  - Zero runtime dependency (single static binary)
  - <20ms cold start
  - Distribution: brew, scoop, AUR, curl|sh, GitHub Releases
  - Drop-in replacement: same CLI surface, same flags
  - Node version stays maintained for 6 months in parallel

The Go port reuses all stdout fixtures and the test case JSON. See [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) for the portability strategy.

---

## 9. Risks & open decisions

| Risk                                          | Mitigation                                                          |
| --------------------------------------------- | ------------------------------------------------------------------- |
| Name `deadport` already taken on npm          | **Verify before anything** — fallbacks: `killport-cli`, `freeport`, `pk` |
| `lsof` missing in some containers             | `/proc/net/tcp` fallback                                            |
| User wants `deadport :3000` (with colon)      | Accept both formats at parse time                                   |
| Warning on ports < 1024 might be annoying     | Disablable via `--no-safety` or `~/.deadportrc` config              |
| `kill-port` exists on npm (~600k DL/week)     | Differentiation: rich info before kill, confirmation, ranges, safety, JSON output, better-tested cross-platform. Not a blocker — most CLI tools have 5 competitors and the best README wins. |

**To decide before coding:**

1. Final name (1 `npm view` lookup)
2. Confirmation enabled by default — *recommendation: yes, this is the differentiator vs `kill-port`*
3. Minimum Node version — *recommendation: Node 18+*

---

## 10. Definition of done (v1.0.0)

- [ ] `npm i -g deadport && deadport 3000` works on Mac, Linux, Windows
- [ ] `deadport --help` readable in < 20 lines
- [ ] Test coverage > 80% on parsers
- [ ] README with GIF
- [ ] Published on npm
- [ ] Posted on r/node, Hacker News (Show HN), Twitter with the GIF

---

## 11. Success metrics (3 months post-launch)

- 1k+ npm downloads / week → product-market fit signal
- 100+ GitHub stars → green light to start the Go rewrite
- < 5 open issues for cross-platform bugs → quality bar met
