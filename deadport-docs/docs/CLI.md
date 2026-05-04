# CLI Specification

> Canonical reference for the `deadport` command-line interface.
> This document is the **public contract**. Breaking changes here = major version bump.

---

## Synopsis

```
deadport <port> [<port>...] [options]
```

---

## Arguments

### `<port>`

One or more port specifiers. Accepted formats:

| Format       | Example          | Meaning                             |
| ------------ | ---------------- | ----------------------------------- |
| Single       | `3000`           | Port 3000                           |
| With colon   | `:3000`          | Port 3000 (lsof-friendly syntax)    |
| Range        | `3000-3010`      | Ports 3000 through 3010 inclusive   |
| Comma list   | `3000,8080`      | Ports 3000 and 8080                 |
| Multiple     | `3000 8080`      | Same as above, space-separated      |
| Mixed        | `3000-3002 8080` | Ports 3000, 3001, 3002, 8080        |

**Validation:** Each port must be 1–65535. Invalid ports → exit 4.

---

## Options

### `-f, --force`

Skip the confirmation prompt. Useful in scripts.

```bash
deadport 3000 -f
```

### `-c, --check`

Show what is running on the port(s) without killing anything. Equivalent to a friendlier `lsof -i :3000`.

```bash
deadport 3000 --check
```

Exit code 0 always (even if nothing is running).

### `-s, --signal <name>`

Initial signal to send. Default: `SIGTERM`. Falls back to `SIGKILL` after `--grace` seconds.

```bash
deadport 3000 -s SIGINT
deadport 3000 -s SIGKILL    # straight to nuclear
```

Accepted: `SIGTERM`, `SIGINT`, `SIGKILL`, `SIGHUP`, `SIGQUIT`. Windows: only `SIGTERM` and `SIGKILL` are honored, others are aliased to `SIGTERM`.

### `--grace <seconds>`

Time to wait for SIGTERM before escalating to SIGKILL. Default: `2`.

```bash
deadport 3000 --grace 5
```

### `-q, --quiet`

Minimal output. Only errors and "killed" / "not found" lines. Suppresses tables and prompts (implies `--force`).

```bash
deadport 3000 -q
```

### `-j, --json`

JSON output. Implies `--quiet`. Implies `--force` unless `--check`.

```bash
deadport 3000 --json
```

Output schema:

```json
{
  "results": [
    {
      "port": 3000,
      "status": "killed",
      "process": { "pid": 48291, "name": "node", "user": "alex", "command": "node server.js" },
      "signal": "SIGTERM",
      "durationMs": 47
    },
    {
      "port": 8080,
      "status": "free"
    },
    {
      "port": 9000,
      "status": "running",
      "process": { "pid": 55100, "name": "python3", "user": "alex", "command": "python3 app.py" }
    },
    {
      "port": 22,
      "status": "permission-denied",
      "process": { "pid": 1234, "name": "sshd", "user": "root", "command": "/usr/sbin/sshd -D" }
    }
  ]
}
```

`status` is one of: `killed`, `free`, `running`, `permission-denied`, `cancelled`, `error`.

`running` is emitted only by `--check` mode (the port is held but we did not kill).

### `-v, --verbose`

Show full command line of the process and additional metadata (start time, parent PID).

### `--no-safety`

Disable the warning prompt for system ports (22, 80, 443, etc.). The list of safety-marked ports is in `src/safety.ts`.

### `-h, --help`

Show help and exit.

### `-V, --version`

Show version and exit.

---

## Non-interactive mode

When stdin or stdout is not a TTY (piped, redirected, CI environment) and
none of `--force`, `--quiet`, or `--json` are passed, deadport refuses to
act and exits with code 4. This prevents silent or hung kills in scripts
and CI pipelines. Use `--force` to opt into non-interactive killing.

```bash
# In a script or CI pipeline, always pass --force:
deadport 3000 --force

# Or use --json (also suppresses prompts):
deadport 3000 --json | jq '.results[0].status'
```

---

## Exit codes

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| `0`  | Success: process killed, OR `--check` mode completed     |
| `1`  | Port(s) not in use (no process found)                    |
| `2`  | Permission denied (process owned by another user / root) |
| `3`  | User cancelled the confirmation prompt                   |
| `4`  | Invalid argument (bad port, unknown flag, etc.)          |
| `5`  | Internal error                                           |

When multiple ports are passed, the exit code is the **highest** code among results, with priority `5 > 4 > 2 > 3 > 1 > 0`. So a mixed run where one port killed and one was unauthorized exits with `2`.

---

## Output examples

### Standard kill

```
$ deadport 3000

Port 3000 is held by:
  PID    NAME    USER    UPTIME    COMMAND
  48291  node    alex    2h 14m    node server.js

Kill this process? [Y/n] y
✓ Process 48291 terminated (SIGTERM, 47ms)
```

### Port already free

```
$ deadport 3000
✓ Port 3000 is free.
```

Exit code: `1`.

### Multiple ports

```
$ deadport 3000 8080 5432

Port   Process       PID    User
3000   node          48291  alex
8080   python3       12044  alex
5432   postgres      —      —      (free)

Kill 2 processes? [Y/n]
```

### Dangerous port warning

```
$ deadport 22

⚠  Port 22 is commonly used by SSH. Killing it may lock you out of remote sessions.
   Process: sshd (PID 1234, root)

Continue? [y/N]
```

### Permission denied

```
$ deadport 80

Port 80 is held by:
  PID  NAME   USER  UPTIME  COMMAND
  1    nginx  root  3d      nginx: master process

✗ Permission denied. Process 1 is owned by 'root'.
  Try: sudo deadport 80
```

Exit code: `2`.

### JSON for scripts

```bash
$ deadport 3000 --json | jq '.results[0].process.pid'
48291
```

---

## Environment variables

| Variable           | Effect                                                          |
| ------------------ | --------------------------------------------------------------- |
| `NO_COLOR`         | Disable ANSI colors (standard convention)                       |
| `DEADPORT_NO_SAFETY` | Equivalent to passing `--no-safety` on every invocation       |
| `DEBUG=deadport*`  | Verbose internal logging (parser output, spawned commands)      |

---

## Configuration file (post-v1, optional)

`~/.deadportrc` (JSON):

```json
{
  "noSafety": false,
  "extraSafePorts": [4000, 5000],
  "defaultGrace": 3
}
```

Not implemented in v1. Listed here so the surface is reserved.

---

## Compatibility commitments

For all v1.x releases:

- Flag names and short forms are stable
- Exit codes are stable
- JSON output schema is stable (additions allowed, removals = breaking)

For v2 (Go rewrite): **same CLI surface**. The version bump reflects the implementation change, not a behavior change.
