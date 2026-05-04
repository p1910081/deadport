## Context

The CLI.md contract states "`--check` exits 0 always (even if nothing is running)." This covers the free-port case and the held-port case, both of which are tested. However, a third case is untested: a port held by a process owned by root or another user, where the lookup itself may fail with a permission error. In this scenario `--check` should still exit 0, but the current implementation returns whatever `findPortHolders` says — if lookup fails with `reason: 'permission'`, the JSON output emits `status: 'error'` and the text path logs to stderr. The exit code is still 0 (because `runCheck` returns `void`), but the output behaviour is undocumented.

## Proposed change

- Add an E2E test on macOS/Linux that runs `deadport 1 --check` (port 1 requires root to bind), and asserts exit code 0 and meaningful JSON output
- Clarify in `CLI.md` what `status` and exit code should be when `--check` encounters a permission-denied lookup
- Consider whether `status: 'permission-denied'` should also be a valid `--check` output (currently it is not documented for check mode)

## Why post-beta

Requires a privileged port in CI to reproduce reliably. Needs a decision on the `status` value before we can write the test. The current behaviour (exit 0, `status: 'error'` in JSON) is defensible for the beta but should be pinned before v1.
