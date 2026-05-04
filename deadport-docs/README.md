# deadport

> Kill the process holding a port. One command, zero Stack Overflow tabs.

[![npm version](https://img.shields.io/npm/v/deadport.svg)](https://www.npmjs.com/package/deadport)
[![license](https://img.shields.io/npm/l/deadport.svg)](./LICENSE)
[![tests](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/deadport/ci.yml?branch=main)](https://github.com/YOUR_USERNAME/deadport/actions)

```bash
$ deadport 3000

Port 3000 is held by:
  PID    NAME    USER    UPTIME    COMMAND
  48291  node    alex    2h 14m    node server.js

Kill this process? [Y/n] y
✓ Process 48291 terminated (SIGTERM, 47ms)
```

## Why

Every dev knows the pain:

```
Error: listen EADDRINUSE: address already in use :::3000
```

Then we Google "how to kill port 3000 mac" for the 50th time, copy a `lsof | grep | kill` incantation, and pray.

`deadport` is one command, cross-platform, with confirmation by default and useful info before the kill.

## Install

```bash
npm install -g deadport
```

Requires Node.js 18+.

## Usage

```bash
deadport 3000              # kill what's on port 3000 (with confirmation)
deadport 3000 -f           # skip confirmation
deadport 3000 --check      # show what's running, don't kill
deadport 3000 8080 5432    # multiple ports
deadport 3000-3010         # range
deadport 3000 --json       # JSON output (script-friendly)
```

See [`docs/CLI.md`](./docs/CLI.md) for the full reference.

## Platform support

| OS      | Method                       | Status |
| ------- | ---------------------------- | ------ |
| macOS   | `lsof`                       | ✅     |
| Linux   | `lsof` (fallback to `/proc`) | ✅     |
| Windows | `netstat` + `tasklist`       | ✅     |

## Comparison

|                        | `lsof` + `kill` | `kill-port` | `deadport` |
| ---------------------- | --------------- | ----------- | ---------- |
| One command            | ❌              | ✅          | ✅         |
| Cross-platform         | ❌              | ✅          | ✅         |
| Shows process info     | manual          | ❌          | ✅         |
| Confirmation prompt    | ❌              | ❌          | ✅         |
| Port ranges            | ❌              | ❌          | ✅         |
| JSON output            | ❌              | ❌          | ✅         |
| Safety on system ports | ❌              | ❌          | ✅         |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](./LICENSE).
