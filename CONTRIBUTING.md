# Contributing to Planewright

Thank you for your interest in Planewright. This guide explains how work is planned, built and
reviewed. By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Project phase

Planewright is in its **foundation phase**. The drawing engine has not been implemented, and
behavioural investigation must precede feature work. Until feature issues are open, the most
useful contributions are bug reports about the tooling, documentation fixes and well-scoped
investigation issues.

## Workflow

1. **Start from an issue.** Every change needs an issue. Use the issue forms: _Bug report_,
   _Feature request_ or _Behavioural investigation_. Feature issues need testable acceptance
   criteria and, where a behavioural reference is used, a linked investigation issue.
2. **Create a branch** named `<type>/<issue>-<kebab-summary>`:
   - `<type>` is a Conventional Commit type: `build`, `chore`, `ci`, `docs`, `feat`, `fix`,
     `perf`, `refactor`, `revert`, `style` or `test`.
   - `<issue>` is the issue number without leading zeros.
   - `<kebab-summary>` is lowercase letters and digits separated by single hyphens.
   - Example: `feat/12-selection-box`. The `pre-push` hook and CI enforce this rule.
3. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/). Optional
   scopes are `collab`, `deps`, `deps-dev`, `docs`, `engine`, `github`, `protocol`,
   `render-canvas`, `repo`, `research`, `tooling` and `web`. Keep each commit atomic: one logical
   change that builds and passes tests on its own. The `commit-msg` hook runs commitlint.
4. **Open a pull request** against `main` and complete every section of the template. The pull
   request title must be a valid Conventional Commit header, because pull requests are
   squash-merged and the title becomes the commit message.
5. **Pass CI and review.** All required checks must be green before merging.

Pushing directly to `main` is not allowed. The only exception was the one-time repository
bootstrap recorded in [docs/bootstrap-validation.md](docs/bootstrap-validation.md).

## Local setup

```sh
nvm use          # Node.js 24.22.1 from .nvmrc
npm ci           # also installs the Git hooks through Husky
npm run validate # formatting, lint, types, guardrails, secret scan, tests with coverage, build
npm run test:e2e # requires Chromium: npx --workspace @planewright/web playwright install chromium
```

Git hooks:

| Hook         | Runs                                             |
| ------------ | ------------------------------------------------ |
| `pre-commit` | lint-staged: ESLint and Prettier on staged files |
| `commit-msg` | commitlint                                       |
| `pre-push`   | branch-name validation                           |

## Engineering standards

- **TypeScript strict mode** everywhere, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Do not suppress type errors without an explanatory comment.
- **Complexity guardrails**: cyclomatic complexity ≤ 10, nesting depth ≤ 3, ≤ 4 parameters,
  ≤ 60 lines per function and ≤ 300 lines per module (ESLint), plus repository-wide file-size
  limits. Split code rather than raising limits; raising a limit needs an ADR.
- **Tests**: add unit tests for logic and integration tests for service boundaries. Visible
  behaviour needs an end-to-end test once the editor exists. Coverage thresholds are enforced.
- **Visual baselines**: the end-to-end suite's screenshot baselines are Linux images that CI's
  Chromium made; CI compares them, other platforms skip them, and no local run writes one. A change
  to what they show makes them again only through CI's `visual-baselines` dispatch, as
  [the quality document](docs/architecture/engine/quality.md#visual-baselines) describes, and its
  pull request shows each changed image.
- **Dependencies**: add a dependency only when it is necessary, maintained and licensed
  compatibly with MIT. Versions are pinned exactly. Explain new dependencies in the pull request.
- **Security**: treat files, clipboard data and network messages as untrusted. Never commit
  secrets; `.env` is ignored and secret scanning runs in CI.
- **Accessibility**: user-facing features must be keyboard operable and expose meaningful names
  and roles.

## Independent implementation

Planewright must remain an independent implementation:

- Do not copy, transcribe or adapt source code, assets, fonts, icons or documentation text from
  Excalidraw or other projects whose licences or terms do not allow it.
- Do not add `@excalidraw/*` packages or other Excalidraw-derived packages. CI rejects them.
- Reference applications may be studied only for observable behaviour, following
  [docs/investigation/README.md](docs/investigation/README.md).

See [ADR 0003](docs/adr/0003-clean-room-reference-policy.md) for the full policy.

## Architecture decisions

Significant technical decisions are recorded as ADRs in [docs/adr](docs/adr/README.md). Propose
a new ADR in the same pull request as the change it justifies.

## AI-assisted contributions

AI agents may contribute, but they follow the same rules as everyone else; see
[AGENTS.md](AGENTS.md). Disclose substantial AI assistance in the pull request. The human who
opens the pull request is responsible for its correctness and licensing.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
