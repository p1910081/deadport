# Contributing to deadport

Thanks for considering a contribution. Quick guide below.

---

## Project status

This is a small, opinionated tool. The scope is intentionally narrow (see [`docs/PRD.md`](./docs/PRD.md)). Feature requests outside that scope will likely be politely declined — please open a discussion before opening a feature PR.

Bug reports and cross-platform fixes are always welcome.

---

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/deadport
cd deadport
npm install
npm run build       # bundles to dist/
npm link            # makes `deadport` available globally, pointing at this repo
```

Verify:

```bash
deadport --version
```

---

## Commands

| Command            | What it does                                |
| ------------------ | ------------------------------------------- |
| `npm run build`    | Bundle TypeScript with tsup                 |
| `npm run dev`      | Build in watch mode                         |
| `npm test`         | Run the full vitest suite                   |
| `npm run test:e2e` | Run only end-to-end tests (slow)            |
| `npm run lint`     | ESLint + Prettier check                     |
| `npm run fix`      | Auto-fix lint/format issues                 |
| `npm run check`    | Typecheck without emitting (`tsc --noEmit`) |

CI runs `lint`, `check`, `test` on macOS, Ubuntu, and Windows. PRs that don't pass CI won't be merged.

---

## Code style

- TypeScript strict mode, no `any` (use `unknown` + narrowing)
- Prefer `function foo()` over `const foo = () =>` for top-level functions (better stack traces)
- No default exports outside of `cli.ts`
- Errors use the `Result` type pattern from [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), not exceptions, for expected failure modes
- Parsers MUST be pure (no I/O, no `Date.now()`)

---

## Adding a fixture-driven test

This is the most common contribution. Say you found a `lsof` output that we parse incorrectly:

1. Save the offending stdout to `test/fixtures/lsof/<descriptive-name>.txt`
2. Add an entry to `test/fixtures/cases.json`:
   ```json
   {
     "name": "lsof with foo bar edge case",
     "fixture": "lsof/<descriptive-name>.txt",
     "expected": [{ "pid": 1234, "name": "...", "user": "...", "command": "..." }]
   }
   ```
3. Run `npm test` — your test runs automatically
4. If it fails (it should), fix the parser
5. Commit fixture + parser fix together

**Why this matters:** these fixtures are also used by the future Go port. A fixture you add today saves us hours later.

---

## Cross-platform testing

If you only have one OS:

- Document clearly which platform you tested on in your PR description
- The CI matrix runs the suite on all three OSes — wait for green before requesting review
- For Windows-specific fixes without a Windows machine: rely on CI, but include thorough fixture-driven unit tests so the logic is verifiable without spawning real processes

---

## Commit messages

Conventional Commits, kept terse:

```
feat: support port ranges (3000-3010)
fix(windows): handle netstat output with empty proto column
docs: clarify --grace flag in CLI.md
test: add fixture for lsof with IPv4+IPv6 dual binding
```

Scopes used so far: `windows`, `unix`, `linux-proc`, `cli`, `format`, `safety`, `parsers`.

---

## Pull request checklist

- [ ] CI green on all 3 OSes
- [ ] Tests added or updated
- [ ] No new runtime dependencies added without discussion (we keep this lean)
- [ ] If you changed CLI behavior, [`docs/CLI.md`](./docs/CLI.md) is updated
- [ ] If you changed types or output format, you bumped the version appropriately
- [ ] CHANGELOG.md has an entry under "Unreleased"

---

## Releasing (maintainers)

1. Update `CHANGELOG.md`: move "Unreleased" → "X.Y.Z – YYYY-MM-DD"
2. `npm version <patch|minor|major>` — creates the tag
3. `git push --follow-tags`
4. CI's `release.yml` workflow publishes to npm
5. Create a GitHub Release with the changelog excerpt

---

## Code of Conduct

Be kind, be patient, assume good faith. That's it. Bad behavior gets you blocked from the repo, no warnings.

---

## Questions

Open a Discussion, not an Issue, for anything that isn't a clear bug.
