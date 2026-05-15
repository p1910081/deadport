# deadport v0.2.0-beta.1

Thank you for testing the beta! This document covers what works, what doesn't, and how to help.

## What works

- **macOS / Linux**: full kill flow — lookup via `lsof`, SIGTERM → grace period → SIGKILL escalation
- **Windows**: lookup now wired — `netstat -ano -p TCP` + `tasklist` resolve port holders
- `--check` — list processes holding ports (all platforms)
- `--force` / `--quiet` / `--json` — non-interactive modes for scripts and CI
- Safety prompts for dangerous ports (22, 80, 443, 5432, etc.) with default No
- Multi-port: `deadport 3000 8080 9000` or `deadport 3000-3010` or `deadport 3000,8080`
- JSON output (`--json`) schema-stable per CLI.md
- Cold start: ~48ms (well under the 200ms budget)

## What's not yet working

| Feature | Status |
|---|---|
| Windows kill (`taskkill /F`) | Works via `process.kill`; grace period not implemented (`TODO(v0.2)`) |
| `/proc` fallback (Alpine, no-lsof Linux) | Stub — returns `tool-missing` |
| Full command line (`--verbose`) | Shows `.exe` name on Windows; `ps` call for full cmdline pending |
| UPTIME column | Shows `—` — `startedAt` not yet populated by parsers |
| `--check` JSON status for held ports | Uses `"error"` placeholder — CLI.md schema gap (`TODO(clarify)`) |

## Installing the beta

```sh
npm install -g deadport@0.2.0-beta.1
```

Or try it without installing:

```sh
npx deadport@0.2.0-beta.1 <port>
```

## Quick test

```sh
# Start a process on a port, then kill it:
node -e "require('http').createServer().listen(9876)" &
deadport 9876 --force

# Check what's on a port without killing:
deadport 3000 --check

# Multi-port, JSON output:
deadport 3000 8080 --check --json
```

## Reporting issues

Please open an issue at https://github.com/p1910081/deadport with:

1. OS + Node version (`node --version`)
2. The exact command you ran
3. Full output (stdout + stderr)
4. Expected vs actual behaviour

## Tester asks

These are the areas where feedback is most valuable for v0.2.0:

- [ ] **Windows**: does `deadport <port> --force` actually kill the process? What error (if any) do you see?
- [ ] **Alpine Linux / Docker**: does `--check` work on a container without `lsof`? (Expected: `tool-missing` error — want to confirm the message is clear)
- [ ] **Dangerous port prompts**: do the safety warnings feel right? Too aggressive? Not aggressive enough?
- [ ] **Cold start**: run `time deadport --version` — is it under 200ms on your machine?
- [ ] **Multi-port**: try `deadport 3000-3010 --check` — does the table align correctly?
