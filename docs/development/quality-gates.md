# Quality gates

Every gate runs locally through an npm script and in GitHub Actions
(`.github/workflows/ci.yml`). `npm run validate` runs the local gates in CI order.

| Gate              | Command                     | Tooling                                  | Fails when                                                         |
| ----------------- | --------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Formatting        | `npm run format:check`      | Prettier                                 | Any file is not formatted                                          |
| Lint              | `npm run lint`              | ESLint, typescript-eslint strict + style | Any error or warning (`--max-warnings=0`)                          |
| Types             | `npm run typecheck`         | TypeScript 6 strict                      | Any type error in any workspace or tooling script                  |
| Unit tests        | `npm run test:unit`         | Vitest projects `*:unit`                 | Any failing test                                                   |
| Integration tests | `npm run test:integration`  | Vitest projects `*:integration`          | Any failing test                                                   |
| Coverage          | `npm run test:coverage`     | Vitest v8 coverage                       | Statements < 90 %, branches < 85 %, functions < 90 %, lines < 90 % |
| End-to-end tests  | `npm run test:e2e`          | Playwright (Chromium)                    | Any failing scenario against the production build                  |
| Build             | `npm run build`             | esbuild (collab), Vite (web)             | Any build error                                                    |
| File size         | `npm run check:file-size`   | `scripts/check-file-size.ts`             | A file exceeds 256 KiB, or a source file exceeds 400 lines         |
| Dependency policy | `npm run check:deps-policy` | `scripts/check-dependency-policy.ts`     | A package name containing `excalidraw` is in the lockfile          |
| Secrets (tree)    | `npm run secrets:scan`      | Secretlint recommended preset            | A credential pattern is found in the working tree                  |
| Secrets (history) | CI only                     | gitleaks 8.30.1, checksum-verified       | A credential pattern is found anywhere in Git history              |
| Dependency audit  | `npm run audit:deps`        | `npm audit`, `npm audit signatures`      | A moderate or higher advisory, or an invalid registry signature    |
| Static analysis   | CI only                     | CodeQL (`security-extended`)             | CodeQL reports an alert                                            |
| Commit messages   | `commit-msg` hook, CI       | commitlint, Conventional Commits         | A commit or pull request title is not a valid header               |
| Branch names      | `pre-push` hook, CI         | `scripts/validate-branch-name.ts`        | The branch is not `<type>/<issue>-<kebab-summary>`                 |

The engine package adds its own gates ([ADR 0004](../adr/0004-canvas-engine-package-boundaries.md)).
Coverage of `packages/engine/src` must reach 95 % of statements, 90 % of branches, 95 % of
functions and 95 % of lines, and its `math` layer 100 % of each. The ESLint block
`planewright/engine` forbids browser and Node.js globals, `Math.random`, `Date.now` and timers in
the engine, whose tsconfig has the ECMAScript library only. `scripts/tests/engine-layers.test.ts`
fails on an import against the engine's layer order.

## Complexity guardrails

ESLint enforces these limits on all TypeScript and JavaScript:

| Rule                     | Limit                                                 |
| ------------------------ | ----------------------------------------------------- |
| `complexity`             | 10                                                    |
| `max-depth`              | 3                                                     |
| `max-params`             | 4                                                     |
| `max-nested-callbacks`   | 3 (4 in tests)                                        |
| `max-lines-per-function` | 60, excluding blank lines and comments (off in tests) |
| `max-lines`              | 300 per module, excluding blank lines and comments    |

Raising a limit requires an ADR. Prefer splitting code.

## Supply chain

- Dependency versions are pinned exactly (`save-exact=true`) and locked in `package-lock.json`.
- Dependency install scripts are blocked unless approved in `allowScripts` (npm 11).
- GitHub Actions are pinned to full commit SHAs with the release tag in a comment.
- Dependabot proposes weekly npm and GitHub Actions updates.
- Repository-level GitHub secret scanning and push protection are enabled.
