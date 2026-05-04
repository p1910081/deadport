## Context

`--force` is the current escape hatch for non-interactive (CI/scripted) use. But per-invocation flags are noisy in scripts: `deadport 3000 --force && deadport 8080 --force && ...`. Other CLI tools solve this at the environment level: npm uses `CI=true`, git uses `GIT_TERMINAL_PROMPT=0`, Docker uses `DOCKER_BUILDKIT=1`. deadport should follow the same pattern.

## Proposed change

- Add `DEADPORT_FORCE=1` (or `DEADPORT_NON_INTERACTIVE=1`) env var as a persistent equivalent to `--force`
- When set, suppress all prompts globally without requiring the flag on every call
- Document alongside `DEADPORT_NO_SAFETY` in the Environment variables table in `CLI.md`
- Implementation: check the env var at the top of `runKill` alongside the `opts.force` check

## Why post-beta

Non-breaking addition; not needed to unblock the initial beta. Should be driven by real user reports of friction in CI pipelines before we commit to the exact variable name.
