---
name: Bug report
about: deadport did the wrong thing
labels: bug
---

## What happened

<!-- One sentence. -->

## Steps to reproduce

```bash
# the exact command(s) you ran
deadport ...
```

## What you expected

<!-- One sentence. -->

## What you got

```
# paste the actual output
```

## Environment

- OS: <!-- e.g. macOS 14.5, Ubuntu 22.04, Windows 11 -->
- Node version: <!-- node --version -->
- deadport version: <!-- deadport --version -->
- Shell: <!-- zsh, bash, fish, powershell, cmd -->

## Optional but very helpful

If the bug is in port detection, please run:

```bash
# macOS / Linux
lsof -nP -iTCP:<the port> -sTCP:LISTEN -F pcuLn

# Windows
netstat -ano -p TCP | findstr :<the port>
```

…and paste the raw output here. We turn this into a test fixture.

```
# paste here
```
