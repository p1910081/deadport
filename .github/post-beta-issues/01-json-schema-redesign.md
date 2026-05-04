## Context

The current `status` field mixes two concerns: port state (`free`, `running`) and action result (`killed`, `cancelled`, `permission-denied`, `error`). This makes it hard for consumers to write generic handlers — you have to know whether you're parsing `--check` output or kill output before interpreting the field. The schema was shaped by the kill flow first; `running` was bolted on as a `--check` addition.

## Proposed change

- Introduce a v2 JSON schema with separate top-level fields per result:
  - `held: boolean` — whether the port had a listening process at lookup time
  - `action: { type: 'killed' | 'cancelled' | 'permission-denied' | 'none' | 'error', signal?: string, durationMs?: number }` — what the CLI did (or `"none"` for `--check`)
- Keep `process` and `port` as-is; they are stable
- Mark `status` as deprecated in v1.x; remove in v2.0
- This is a **breaking change** to the JSON schema, not the package semver — plan for a `--json-version 2` flag to opt in early

## Why post-beta

The current schema is functional and ships with v0.2.0-beta.1. A schema redesign needs user feedback and a broader discussion before committing to it. Worth validating with real users first.
