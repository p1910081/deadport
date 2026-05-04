# Publishing deadport

## Pre-publish checklist

- [ ] `npm run check` passes (zero TypeScript errors)
- [ ] `npm run lint` passes (ESLint + Prettier)
- [ ] `npm test` passes (all tests green)
- [ ] `npm publish --dry-run --tag beta` verified (see tarball contents below)
- [ ] `node dist/cli.js --version` returns the correct version
- [ ] Git tag points to the publish commit (verify with `git rev-parse v0.2.0-beta.1`)

---

## Beta release (current: v0.2.0-beta.1)

```bash
# 0. Final smoke test (from repo root)
node dist/cli.js --version   # must print 0.2.0-beta.1
node dist/cli.js --help
node dist/cli.js 59999 --check

# 1. Push the branch and tag (tag is local-only until this step)
git push origin dev
git push origin v0.2.0-beta.1

# 2. Publish to npm with the beta tag (NOT latest)
npm publish --tag beta

# 3. Verify the publish
npm view deadport
# Expect:
#   dist-tags: { beta: '0.2.0-beta.1' }
#   NO 'latest' tag — if 'latest' appears, the wrong tag was used

# 4. Test install from npm
npm install -g deadport@beta
deadport --version
# Expect: 0.2.0-beta.1

# 5. Uninstall the global after testing
npm uninstall -g deadport
```

---

## Expected tarball contents (v0.2.0-beta.1)

```
npm notice Tarball Contents
npm notice 2.6kB BETA.md
npm notice 10.2kB CHANGELOG.md
npm notice 1.1kB LICENSE
npm notice 11B README.md
npm notice 26.3kB dist/cli.cjs
npm notice 60.9kB dist/cli.cjs.map
npm notice 24.7kB dist/cli.js
npm notice 60.8kB dist/cli.js.map
npm notice 1.4kB package.json

package size:  46.4 kB
unpacked size: 188.0 kB
total files:   9
```

**Not present (correct):** `test/`, `src/`, `node_modules/`, `tsconfig.json`,
`vitest.config.ts`, `tsup.config.ts`, `.github/`

---

## Post-publish steps

- [ ] Pin the beta feedback issue on GitHub
- [ ] Verify the npm package page: https://www.npmjs.com/package/deadport
- [ ] Confirm the `beta` dist-tag is set, **NOT** `latest`
- [ ] Smoke test from a different machine / clean directory
- [ ] Post in beta testers thread: link BETA.md for what to test

---

## GA release (future — when beta is stable)

```bash
# 1. Bump version to 1.0.0 in package.json and src/cli.ts
# 2. Update CHANGELOG with a dated [1.0.0] section
# 3. Build, test, dry-run
npm run build && npm test && npm publish --dry-run

# 4. Tag and push
git tag v1.0.0 -m "GA release — v1.0.0"
git push origin main
git push origin v1.0.0

# 5. Publish without a tag (defaults to 'latest')
npm publish

# 6. Verify
npm view deadport
# Expect: dist-tags: { latest: '1.0.0', beta: '0.2.0-beta.1' }
```

---

## Notes

- **Source maps in tarball**: `dist/*.map` files are included (unpacked: ~122kB of 188kB total).
  They are useful for crash reports but inflate download size. For v1, consider setting
  `sourcemap: false` in `tsup.config.ts` to drop them before GA.
- **Version in `src/cli.ts`**: the version string is hardcoded and must be updated manually
  alongside `package.json` on every release. Consider reading it from `package.json` at
  build time via tsup's `define` option for future releases.
- **`YOUR_USERNAME` placeholder**: update `repository.url` and `homepage` in `package.json`
  with the real GitHub username before pushing the tag.
