# Bootstrap validation

This file records the validation of the one-time repository bootstrap, which was committed
directly to `main` before issue-driven work begins. Every result below comes from a command that
was actually run. Results that were not obtained are listed under
[Not verified](#not-verified).

## Validated revision

- Commit: `2356c36a1d25d0d7eedb7567a908f3c78ded5127`
  (`docs: add architecture, ADR and investigation documentation`), the last commit before this
  file was added. This file changes documentation only.
- Date: 2026-11-04
- Validation was run twice: in the working tree before committing, and again in a **fresh
  clone** of commit `2356c36` installed with `npm ci`. Both runs passed every gate.

## Environment

| Item       | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| OS         | Linux 6.8.0-147-generic (x86_64)                             |
| Node.js    | v24.22.1 (official binary, checksum verified before install) |
| npm        | 11.19.1                                                      |
| TypeScript | 6.0.3                                                        |
| ESLint     | 10.14.0                                                      |
| Vitest     | 5.1.0                                                        |
| Playwright | 1.64.1, Chrome for Testing 156.0.8078.4 (chromium v1248)     |

## Gate results (fresh clone of `2356c36`)

| Gate                                             | Result | Details                                                                          |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| `npm ci`                                         | Pass   | 391 packages added, 395 audited, 0 vulnerabilities                               |
| `npm run format:check`                           | Pass   | "All matched files use Prettier code style!"                                     |
| `npm run lint`                                   | Pass   | 0 errors, 0 warnings (`--max-warnings=0`)                                        |
| `npm run typecheck`                              | Pass   | root tooling, `@planewright/protocol`, `@planewright/collab`, `@planewright/web` |
| `npm run check:file-size`                        | Pass   | 90 files checked (max 262144 bytes, 400 source lines)                            |
| `npm run check:deps-policy`                      | Pass   | No forbidden packages in `package-lock.json`                                     |
| `npm run secrets:scan`                           | Pass   | Secretlint reported no findings                                                  |
| `npm run test:coverage`                          | Pass   | 8 test files, 52 tests passed, 0 failed                                          |
| `npm run build`                                  | Pass   | collab `dist/main.js` 6.3 kB; web JS 221.89 kB (69.61 kB gzip), CSS 0.63 kB      |
| `npm run test:e2e`                               | Pass   | 1 Chromium test passed against the production build                              |
| `npm run validate` (all of the above except e2e) | Pass   | exit code 0                                                                      |

`npm run validate` was the command run in the fresh clone; `npm run test:e2e` was run separately
afterwards.

### Tests by Vitest project

| Project              | Files | Passed | Failed |
| -------------------- | ----- | ------ | ------ |
| `tooling:unit`       | 3     | 24     | 0      |
| `protocol:unit`      | 1     | 9      | 0      |
| `collab:unit`        | 2     | 11     | 0      |
| `collab:integration` | 1     | 5      | 0      |
| `web:unit`           | 1     | 3      | 0      |
| **Total**            | **8** | **52** | **0**  |

In the working-tree run, `npm run test:unit` passed 47 tests in 7 files and
`npm run test:integration` passed 5 tests in 1 file.

### Coverage (thresholds: statements 90, branches 85, functions 90, lines 90)

| Metric     | Result              |
| ---------- | ------------------- |
| Statements | 96.59 % (142 / 147) |
| Branches   | 93.90 % (77 / 82)   |
| Functions  | 97.72 % (43 / 44)   |
| Lines      | 96.47 % (137 / 142) |

## Additional checks

| Check                               | Result | Details                                                                                                                                                                                                             |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run audit:deps` (working tree) | Pass   | 0 vulnerabilities; 388 packages with verified registry signatures, 143 with verified attestations                                                                                                                   |
| gitleaks 8.30.1, full history       | Pass   | Archive SHA-256 verified; 16 commits scanned, "no leaks found"                                                                                                                                                      |
| commitlint on every commit          | Pass   | 16 commits checked, 0 failed                                                                                                                                                                                        |
| Git hooks during commit             | Pass   | `pre-commit` (lint-staged) and `commit-msg` (commitlint) ran on every commit                                                                                                                                        |
| Branch validation on `main`         | Pass   | "Branch "main" is exempt from the naming rule."                                                                                                                                                                     |
| Collab production smoke test        | Pass   | `GET /healthz` returned `{"status":"ok","service":"planewright-collab","protocolVersion":0}`; `SIGTERM` stopped the process cleanly; `PLANEWRIGHT_COLLAB_PORT=abc` exited with code 1 and a `collab.fatal` log line |

## Negative checks (gates fail when they should)

These were run in the working tree before committing; the probe files were then deleted.

| Probe                                                                                             | Observed result                                            |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `const broken: number = "nope"` added to each workspace                                           | `npm run typecheck` exited 2 with `TS2322`                 |
| A function with 5 parameters, depth 4 and complexity above 10                                     | ESLint reported `max-params`, `max-depth` and `complexity` |
| A fake GitHub token written to an untracked file                                                  | Secretlint reported `GITHUB_TOKEN` and exited 1            |
| `node scripts/validate-branch-name.ts feature/x`                                                  | Rejected with the naming-rule message, exit 1              |
| Commit headers `feat(canvas): x`, `Added stuff`, `fix: Broken Thing.`                             | commitlint exited 1 for each                               |
| Commit headers `feat(web): add selection box`, `build(deps-dev): bump vitest from 5.1.0 to 5.2.0` | commitlint exited 0                                        |

## Problems found and fixed during the bootstrap

1. **Dependency advisory.** The first install reported 13 moderate findings, all caused by
   minimatch 10.2.6 (GHSA-g3hv-75wg-m249, patched in 11.0.1) through ESLint and
   typescript-eslint. Fixed with an `overrides` entry pinning minimatch 11.0.4 after confirming
   the consumers do not use APIs removed in minimatch 11. Audit then reported 0 vulnerabilities.
2. **Blocked install script.** npm 11 reported that esbuild's `postinstall` was not covered by
   `allowScripts`. The esbuild binary works without it, so the script is explicitly denied.
3. **TypeScript version.** TypeScript 7.0.2 was the latest release, but typescript-eslint 8.72.1
   requires TypeScript `<6.1.0`, so TypeScript 6.0.3 is pinned (ADR 0002).
4. **Unhandled errors in integration tests.** Aborting a rejected WebSocket handshake emitted an
   unhandled `error` event. The test helper now handles it and waits for `close` with a plain
   listener, because `events.once` rejects on `error`.
5. **Branch validation on an unborn branch.** `git rev-parse --abbrev-ref HEAD` fails before the
   first commit; the script now uses `git symbolic-ref`.

## Repository settings changed

- GitHub private vulnerability reporting was disabled. It was enabled through the GitHub API so
  that `SECURITY.md` points to a working channel; the setting read back as `{"enabled":true}`.

## Not verified

- **GitHub Actions** (CI and CodeQL) had not run on these commits when this file was written,
  because the commits had not been pushed yet. Check the repository's Actions tab for those
  results.
- Only Linux x86_64 with Chromium was tested. macOS, Windows, Firefox and WebKit were not.
- Dependabot configuration was not exercised; it runs after the push.
