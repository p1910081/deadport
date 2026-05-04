# Architecture

> Source of truth for project layout, module boundaries, and the Go port strategy.

---

## 1. Repository layout

```
deadport/
├── src/
│   ├── cli.ts                   # entry point, arg parsing, top-level error handling
│   ├── commands/
│   │   ├── kill.ts              # main flow: lookup → confirm → kill → verify
│   │   └── check.ts             # --check flow: lookup → display, no kill
│   ├── lookup/
│   │   ├── index.ts             # platform dispatcher (returns the right impl)
│   │   ├── unix.ts              # lsof-based lookup (macOS, Linux)
│   │   ├── linux-proc.ts        # /proc fallback (Alpine, lsof-less envs)
│   │   ├── windows.ts           # netstat + tasklist
│   │   └── parsers/
│   │       ├── lsof.ts          # pure: string → ProcessInfo[]
│   │       ├── netstat.ts       # pure: string → { port, pid }[]
│   │       └── tasklist.ts      # pure: csv → { pid, name, user }
│   ├── kill.ts                  # signal escalation logic
│   ├── format.ts                # tables, colors, JSON output
│   ├── safety.ts                # dangerous-ports list + warnings
│   ├── parse-args.ts            # port arg parsing (ranges, lists, ":3000")
│   └── types.ts                 # shared types: ProcessInfo, KillResult, etc.
│
├── test/
│   ├── fixtures/                # raw stdout samples (PORTABLE to Go)
│   │   ├── lsof/
│   │   │   ├── single.txt
│   │   │   ├── multi-pid.txt
│   │   │   ├── ipv4-and-ipv6.txt
│   │   │   └── empty.txt
│   │   ├── netstat/
│   │   │   ├── windows-basic.txt
│   │   │   └── windows-empty.txt
│   │   ├── tasklist/
│   │   │   └── single.csv
│   │   └── cases.json           # canonical test cases (PORTABLE to Go)
│   ├── parsers.test.ts
│   ├── parse-args.test.ts
│   ├── safety.test.ts
│   └── e2e.test.ts              # spawns a real server, kills it
│
├── docs/
│   ├── PRD.md
│   ├── CLI.md                   # canonical CLI spec
│   ├── ARCHITECTURE.md          # this file
│   └── PORTING-TO-GO.md         # the v2 plan
│
├── .github/
│   └── workflows/
│       ├── ci.yml               # tests on macos, ubuntu, windows
│       └── release.yml          # publish to npm on tag
│
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

---

## 2. Module boundaries

### The Golden Rule

**Parsers are pure. I/O lives at the edges.**

- `parsers/*.ts` take a string and return a typed object. No `child_process`, no `fs`, no Date.now().
- `lookup/*.ts` orchestrates: spawn the OS command → pass stdout to a parser → return result.
- `commands/*.ts` orchestrate: lookup → format → confirm → kill → verify.
- `cli.ts` does arg parsing and top-level error handling only.

This separation is what makes the Go port realistic later. Parsers are the trickiest code; they need the most tests; they are the most portable.

### Dependency direction

```
cli.ts
  └─→ commands/
        └─→ lookup/
              └─→ parsers/   (pure, no deps)
        └─→ kill.ts
        └─→ format.ts
        └─→ safety.ts
```

Never the reverse. A parser must never import from `commands/` or `cli.ts`.

---

## 3. Type contract

Single source of truth in `src/types.ts`:

```ts
export interface ProcessInfo {
  pid: number;
  name: string;          // e.g. "node"
  user: string;          // e.g. "alex"
  command: string;       // full cmdline if available, else name
  startedAt?: Date;      // best effort, may be undefined
}

export interface PortHolder {
  port: number;
  processes: ProcessInfo[];   // usually 1, can be >1 (IPv4+IPv6)
}

export type KillResult =
  | { ok: true; pid: number; signal: 'SIGTERM' | 'SIGKILL'; durationMs: number }
  | { ok: false; pid: number; reason: 'permission' | 'not-found' | 'timeout' };
```

These types must stay stable across versions. They are also what the JSON output exposes, so changing them = breaking change for users piping to `jq`.

---

## 4. Error handling philosophy

No throwing across module boundaries for expected errors. Use discriminated unions:

```ts
type LookupResult =
  | { ok: true; holders: PortHolder[] }
  | { ok: false; reason: 'tool-missing' | 'permission' | 'parse-error'; detail?: string };
```

Why: this is **Go-friendly**. Go has no exceptions; when we port, this pattern translates 1:1 to `(value, error)` tuples. If we lean on `try/catch` everywhere, the Go port becomes a rewrite, not a port.

Throwing is allowed for **truly unexpected** bugs (e.g. a parser invariant violated). Those reach `cli.ts`'s top-level handler, get logged, and exit 1 with a message.

---

## 5. Testing strategy

### Three layers

**Unit (parsers)** — fixture-driven, fast, the bulk of the suite.

```
fixture file → parser → assert against case.json
```

Every parser has at minimum: empty input, single match, multi match, malformed input.

**Integration (lookup)** — mocks `child_process`, verifies the right command is spawned and the parser is wired correctly.

**E2E** — spawns a real `http.createServer` on a random port, runs the CLI as a subprocess, asserts exit code + stdout. Slow (5-10 tests max), runs on all 3 OSes in CI.

### Why fixtures + cases.json matter

When we port to Go, we copy `test/fixtures/` verbatim. The Go test suite reads the same `cases.json` and asserts the same expectations. **No test logic gets rewritten — only the parser implementation.**

`cases.json` schema:

```json
{
  "lsof": [
    {
      "name": "single process on port 3000",
      "fixture": "lsof/single.txt",
      "expected": [
        { "pid": 48291, "name": "node", "user": "alex", "command": "node server.js" }
      ]
    }
  ],
  "netstat": [ ... ],
  "tasklist": [ ... ]
}
```

---

## 6. CLI surface stability

The CLI surface is the **public API**. It is what users script against and what the Go version must replicate exactly.

Documented in [`CLI.md`](./CLI.md). Any change to:

- flag names or short forms
- exit codes
- JSON output schema
- output ordering of columns

…is a breaking change and bumps the major version.

Output text (colors, padding, prose) can change in minor versions.

---

## 7. Performance budget

- Cold start: < 200ms (Node, current target)
- Lookup: < 100ms on a normal machine
- Kill + verify: < 100ms (most processes), < 2.5s (with full SIGTERM grace period)

If we miss any of these, profile before adding deps. The bottleneck is almost always cold start (Node + module resolution) — bundle aggressively with `tsup`, no top-level `import` of heavy modules. Lazy-load `@inquirer/prompts` only when a prompt is actually shown.

---

## 8. Portability strategy (Go rewrite later)

This entire architecture is designed so the Go port is mostly mechanical. See [`PORTING-TO-GO.md`](./PORTING-TO-GO.md) for the detailed plan.

The short version:

| Layer        | Portability | Notes                                                  |
| ------------ | ----------- | ------------------------------------------------------ |
| Fixtures     | 100%        | Copy verbatim                                          |
| `cases.json` | 100%        | Same expectations                                      |
| Parsers      | ~80%        | Same logic, Go syntax                                  |
| Lookup       | ~50%        | `os/exec` instead of `child_process`, similar shape    |
| Kill         | ~30%        | Use `gopsutil` — much cleaner than Node's signal dance |
| CLI          | 0%          | Rewrite with `cobra` or `urfave/cli`                   |
| Format       | ~60%        | Different libs, same output                            |

Realistic estimate for the Go port once v1 Node is shipped and battle-tested: **2 days**.
