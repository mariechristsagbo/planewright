# Quality gates

Every gate runs locally through an npm script and in GitHub Actions
(`.github/workflows/ci.yml`). `npm run validate` runs the local gates in CI order.

| Gate                | Command                                                             | Tooling                                                                | Fails when                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting          | `npm run format:check`                                              | Prettier                                                               | Any file is not formatted                                                                                                                                                                                                                              |
| Lint                | `npm run lint`                                                      | ESLint, typescript-eslint strict + style                               | Any error or warning (`--max-warnings=0`)                                                                                                                                                                                                              |
| Types               | `npm run typecheck`                                                 | TypeScript 6 strict                                                    | Any type error in any workspace or tooling script                                                                                                                                                                                                      |
| Unit tests          | `npm run test:unit`                                                 | Vitest projects `*:unit`                                               | Any failing test                                                                                                                                                                                                                                       |
| Integration tests   | `npm run test:integration`                                          | Vitest projects `*:integration`                                        | Any failing test                                                                                                                                                                                                                                       |
| Coverage            | `npm run test:coverage`                                             | Vitest v8 coverage                                                     | Statements < 90 %, branches < 85 %, functions < 90 %, lines < 90 %                                                                                                                                                                                     |
| End-to-end tests    | `npm run test:e2e`                                                  | Playwright (Chromium)                                                  | Any failing scenario against the production build                                                                                                                                                                                                      |
| Build               | `npm run build`                                                     | esbuild (collab), Vite (web)                                           | Any build error                                                                                                                                                                                                                                        |
| Bundle size         | `npm run check:bundle-size`                                         | `scripts/check-bundle-size.ts`, esbuild, gzip level 9                  | The engine exceeds 60 KB, the renderer 15 KB or the web app's initial JavaScript 200 KB, minified and gzip-compressed, in KB of 1,000 bytes                                                                                                            |
| Performance budgets | `npm run perf:bench`, `npm run perf:browser`, `npm run perf:report` | Vitest benchmark mode, Playwright (Chromium), `scripts/perf-report.ts` | A benchmark's or a measurement's own check fails, or a budget measured in CI was not measured; once three runs on `main` on the runner's processor model are recorded, a budget more than 20 % worse than its budget or than a baseline that misses it |
| File size           | `npm run check:file-size`                                           | `scripts/check-file-size.ts`                                           | A file exceeds 256 KiB, or a source file exceeds 400 lines                                                                                                                                                                                             |
| Dependency policy   | `npm run check:deps-policy`                                         | `scripts/check-dependency-policy.ts`                                   | A package name containing `excalidraw` is in the lockfile                                                                                                                                                                                              |
| Secrets (tree)      | `npm run secrets:scan`                                              | Secretlint recommended preset                                          | A credential pattern is found in the working tree                                                                                                                                                                                                      |
| Secrets (history)   | CI only                                                             | gitleaks 8.30.1, checksum-verified                                     | A credential pattern is found anywhere in Git history                                                                                                                                                                                                  |
| Dependency audit    | `npm run audit:deps`                                                | `npm audit`, `npm audit signatures`                                    | A moderate or higher advisory, or an invalid registry signature                                                                                                                                                                                        |
| Static analysis     | CI only                                                             | CodeQL (`security-extended`)                                           | CodeQL reports an alert                                                                                                                                                                                                                                |
| Commit messages     | `commit-msg` hook, CI                                               | commitlint, Conventional Commits                                       | A commit or pull request title is not a valid header                                                                                                                                                                                                   |
| Branch names        | `pre-push` hook, CI                                                 | `scripts/validate-branch-name.ts`                                      | The branch is not `<type>/<issue>-<kebab-summary>`                                                                                                                                                                                                     |

The performance budgets are those of
[quality.md](../architecture/engine/quality.md#performance-budgets); the CI job "Performance report"
runs them on every pull request, every push to `main` and every manual dispatch, writes every value
to its summary and keeps the report as the `performance-report` artifact for 90 days. It is not a
required check, and its statistical budgets only report until the baseline in
`docs/performance/baseline.json` holds three runs on `main` on the runner's processor model
([what issue #38 decided](../architecture/engine/quality.md#what-issue-38-decided)); it holds one on
each of three processors, so they all report only. The bundle sizes fail `npm run validate` and the
Quality gates job from the start.

The engine package adds its own gates ([ADR 0004](../adr/0004-canvas-engine-package-boundaries.md)).
Coverage of `packages/engine/src` must reach 95 % of statements, 90 % of branches, 95 % of
functions and 95 % of lines, and its `math` layer 100 % of each. The ESLint block
`planewright/engine` forbids browser and Node.js globals, `Math.random`, `Date.now` and timers in
the engine, whose tsconfig has the ECMAScript library only, and the triple-slash directives and
ambient declarations that could add a library or hide a global.
`scripts/tests/engine-layers.test.ts` fails on an import against the engine's layer order.

The README's screenshots in `docs/assets/readme` are byte-for-byte copies of the two baselines of
the README showcase's visual spec, `apps/web/tests/e2e/visual-readme.spec.ts`, which shows a flow
diagram at 1440 × 900 with the Elements drawer open and whole on an 844 × 390 phone in landscape
([visual baselines](../architecture/engine/quality.md#visual-baselines)).
`scripts/tests/readme-showcase.test.ts` finds the diagram's nodes, labels and lines from its
elements and fails when nodes come closer than 48 units, a label leaves its node, a line crosses
another node or a word, bends other than straight across or down or misses its nodes' outlines, the
main row leaves its centre line, a branch's word strays from its line, a role's hue or contrast
changes, or either capture frames the diagram off balance, outside the free canvas or below a
12 px word. `scripts/tests/readme-screenshots.test.ts` fails when a copy's SHA-256 differs from its
baseline's, when the spec captures another image, when the README shows another image, opens with a
GitHub alert or shows the desktop screenshot after its first section, when a screenshot changes its
size in pixels, is given a height or a wider width, or leaves out Planewright, its viewport or a node
of the diagram in its alternative text, or when one exceeds 131,072 bytes or both together 196,608.
A baseline made again must therefore be copied to the README too.

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
