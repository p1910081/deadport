# Glossary

> Keep our terms aligned across docs, code, and PRs. If a term you need is not here, add it.

| Term            | Definition |
| --------------- | ---------- |
| **Port holder** | A process that has a TCP port in `LISTEN` state. We do not currently target UDP. |
| **Lookup**      | The act of asking the OS "who holds this port?" — implemented per-platform under `src/lookup/`. |
| **Parser**      | A pure function that turns raw OS-tool output (lsof, netstat, tasklist) into typed `ProcessInfo` records. Pure means: no I/O, no time, no env. |
| **Fixture**     | A captured sample of raw OS-tool output stored in `test/fixtures/`, used to drive parser tests. Fixtures are language-agnostic and reused by the future Go port. |
| **Case**        | An entry in `test/cases.json` pairing a fixture file with its expected parsed output. |
| **Grace period**| Time we wait between sending SIGTERM and falling back to SIGKILL. Default 2s, configurable via `--grace`. |
| **Safety port** | A port number flagged in `src/safety.ts` as commonly used by system services (22, 80, 443, etc). Killing one triggers an extra confirmation prompt. |
| **Result type** | A discriminated union of the form `{ ok: true, ... } \| { ok: false, reason, ... }` used instead of throwing for expected errors. |
| **CLI surface** | The set of flags, arguments, exit codes, and JSON output schema documented in `docs/CLI.md`. This is our public API. |
| **Cold start**  | Time from typing the command to first useful output. Budget: 200ms (Node v1), 20ms (Go v2). |
