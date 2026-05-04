# Porting to Go (v2)

> Plan for the eventual Go rewrite. Not v1 work — but written now so the v1 architecture stays Go-friendly.

---

## Why port at all

| Metric              | Node v1     | Go v2 (target) |
| ------------------- | ----------- | -------------- |
| Cold start          | ~100-150ms  | ~10-20ms       |
| Binary size         | depends on Node install | 5-8 MB single static binary |
| Install dependency  | Node 18+    | none           |
| Distribution        | npm only    | brew, scoop, AUR, GitHub Releases, curl\|sh |

The Node version is great for devs who already have npm. Go captures everyone else and feels noticeably snappier on every invocation.

---

## When to start

Triggers, any one is sufficient:

- v1 reaches **100+ GitHub stars** (signal of organic interest)
- v1 reaches **1k+ weekly npm downloads** (real usage)
- A user explicitly asks "is there a binary version" 5+ times

If none of these happen in 3 months, the Node version is enough — don't waste the time.

---

## What gets reused

### Verbatim (zero rewrite)

- `test/fixtures/` — every `.txt` and `.csv` sample
- `test/cases.json` — canonical test expectations
- `docs/CLI.md` — the public contract is unchanged
- `docs/PRD.md` — same product
- `README.md` — minor edits only

### With light translation

- `src/parsers/*.ts` → `parsers/*.go`. Same logic, Go syntax. The hardest parser in v1 (lsof `-F` format) is also the easiest to port — it is a state machine over lines, language-agnostic.
- `src/safety.ts` — a list of port numbers and a function. Trivial.
- `src/parse-args.ts` — the port string parser (`3000-3010`, `:3000`, etc.) ports cleanly.

### Rewrites

- CLI parsing: `commander` → `cobra` or `urfave/cli`
- Process listing/killing: drop the `child_process` + `lsof` dance entirely, use **`gopsutil`**. Cleaner cross-platform abstraction.
- Output formatting: `picocolors` + manual tables → `lipgloss` or `tablewriter` + `fatih/color`
- Prompts: `@inquirer/prompts` → `survey` or `huh`

---

## New Go structure

```
deadport/
├── cmd/
│   └── deadport/
│       └── main.go              # entry point
├── internal/
│   ├── cli/
│   │   └── root.go              # cobra setup, flags
│   ├── commands/
│   │   ├── kill.go
│   │   └── check.go
│   ├── lookup/
│   │   ├── lookup.go            # uses gopsutil — no platform branching needed
│   │   └── parsers/             # KEPT for the /proc fallback case
│   │       ├── lsof.go          # if we still want the lsof path
│   │       └── ...
│   ├── kill/
│   │   └── kill.go
│   ├── format/
│   │   ├── table.go
│   │   └── json.go
│   ├── safety/
│   │   └── ports.go
│   └── types/
│       └── types.go             # ProcessInfo, KillResult, etc.
├── test/
│   ├── fixtures/                # COPIED FROM v1
│   ├── cases.json               # COPIED FROM v1
│   └── parsers_test.go
├── go.mod
├── go.sum
├── Makefile
├── .goreleaser.yml              # multi-platform builds + releases
└── README.md
```

The big architectural simplification: with `gopsutil`, we likely don't need separate `unix.go` / `windows.go` / `linux-proc.go` files. The library handles it. The lsof/proc parsers from v1 can be kept as a safety net or dropped entirely.

---

## Distribution

Single source: GitHub Releases via `goreleaser`.

```yaml
# .goreleaser.yml (sketch)
builds:
  - goos: [linux, darwin, windows]
    goarch: [amd64, arm64]
archives:
  - format_overrides:
      - goos: windows
        format: zip
brews:
  - tap: { owner: YOUR_USERNAME, name: homebrew-tap }
scoops:
  - bucket: { owner: YOUR_USERNAME, name: scoop-bucket }
nfpms:
  - formats: [deb, rpm]
```

Install paths after release:

```bash
# macOS / Linux (Homebrew)
brew install YOUR_USERNAME/tap/deadport

# Windows (Scoop)
scoop bucket add YOUR_USERNAME https://github.com/YOUR_USERNAME/scoop-bucket
scoop install deadport

# Anywhere (curl)
curl -sSL https://deadport.dev/install.sh | sh

# Arch
yay -S deadport-bin
```

---

## Communication strategy

**Don't pre-announce the Go version while shipping the Node one.** People will wait for it and the Node release fizzles.

Sequence:

1. Ship Node v1, post Show HN, collect feedback
2. **2-3 weeks of silence** on the Go front (let v1 settle, fix bugs, learn from real users)
3. Build Go v2 quietly
4. Release Go v2 as **its own event**: "deadport, rewritten in Go — 10x faster startup, single binary, no npm needed"

Two viral moments instead of one.

The Node package stays maintained for 6 months minimum after the Go release. README pinned message: "🚀 deadport is now a single binary — see [installation](#install). The npm package still works and is maintained."

---

## What we learn from v1 that will not be in this doc yet

- Edge cases users actually hit (real bug reports > imagined ones)
- Which flags are actually used (telemetry-free guess: `--check` is heavy, `--json` is rare but loud)
- Which platforms break first (probably Windows, always Windows)
- Whether the safety prompt is loved or hated

All of this informs the Go version. **Do not start the Go port until v1 has been used by other people for at least 2 weeks.**

---

## Open questions for v2 (decide later)

- Keep both lsof/proc parsers, or trust `gopsutil` entirely?
- Add a `--watch` mode (sit on a port and kill anything that grabs it)? Easier in Go than Node.
- Bundle a small daemon for "warm" lookups (sub-millisecond)? Probably overkill.
- Offer a library mode (`import "github.com/.../deadport/pkg/lookup"`) for other Go tools to reuse? Free win since `internal/` → `pkg/`.

Punt on all of these until the Node version teaches us what matters.
