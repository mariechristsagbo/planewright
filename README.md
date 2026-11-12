# Planewright

An independently engineered open-source infinite canvas for drawing and diagrams.

> [!IMPORTANT]
> **Status: pre-release.** Planewright is not a complete drawing editor yet. Its page is a
> canvas that fills the window, with the controls floating over it, most of them shown as original
> glyphs with tooltips, and draws rectangles, ellipses, diamonds, lines, freehand strokes and texts,
> which can be selected, moved, resized, rotated,
> duplicated, deleted and nudged, with Undo and Redo, and texts edited again, also from the keyboard
> alone through a list of the elements in a drawer, which an Elements button showing their count
> opens and which is a sheet on phones, with each change announced to screen readers; while
> something is selected, a panel, or a bar on phones, shows its position and size read-only and
> offers Duplicate, Delete and, for a text, Edit text; the drawing is saved in the browser and
> restored on reload, with nothing shown while saving works and a "Not saved" chip with a notice
> when it does not. On a phone in portrait the tools sit in a dock at the bottom, with a More
> button for Hand, Diamond and Tool lock, every target is at least 44 px on phones, and the
> controls keep clear of the screen's safe areas. A Pre-release tag opens About this
> build, which says what the build contains and what it does not, and a menu at the top left and a
> button at the bottom right open a list of every command's keyboard shortcuts. There is no text
> formatting, no style control, no file opening, saving or exporting and no collaboration. This
> repository currently contains the workspace structure, that editor surface, a
> collaboration-service skeleton, the first layers of the engine package (math primitives, platform
> ports, the document model with its codec, the scene store with its change sets and transactions,
> the undo and redo history, the camera, the geometry, text layout and hit testing, the transforms,
> input gestures, the Hand, Selection, creation and text tools, commands, local persistence with
> autosave and the editor with its render loop, text sessions and announcements), a Canvas 2D
> renderer package, and the quality gates that future work must pass, among them the measurements of
> every performance budget, which CI reports and does not gate yet. The marquee query and a change
> set that moves 1,000 elements have since met their budgets in CI, the redraw while panning meets
> its budget in CI and misses it only on a slower machine, and the redraw of 5,000 elements in view
> meets its budget in most CI runs but misses it in some, which issue #49 follows.

## Goals

- A fast, accessible infinite canvas for sketching, diagrams and whiteboarding in the browser.
- Real-time collaboration through a self-hostable, autonomous Node.js WebSocket service.
- A codebase that stays small, strictly typed, well-tested and easy to review.

## How the project is built

Planewright follows an **investigate-then-implement** workflow:

1. **Behavioural investigation.** Before a feature is designed, its expected behaviour is
   investigated and documented in an investigation issue and under
   [`docs/investigation/`](docs/investigation/README.md).
2. **Issue-driven delivery.** Each feature, fix or change is tracked by a GitHub issue,
   implemented on a branch named `<type>/<issue>-<kebab-summary>` and merged through a reviewed
   pull request that passes CI.
3. **Independent implementation.** Planewright's code, assets and design are its own.

### Independence and references

Planewright is an independent project. It is **not affiliated with, endorsed by or derived
from** Excalidraw or REA.

- **Excalidraw** is used only as a _behavioural reference_: observable behaviour of the public
  application may inform what users expect. Planewright does not use the `@excalidraw/*`
  packages and does not copy Excalidraw source code, assets, fonts or icons. CI enforces the
  dependency part of this rule.
- **REA (Reverse Engineer Anything)**, an MIT-licensed analysis toolkit, is used only as
  _methodology and tooling_ for structured behavioural investigation.

The full policy is in
[ADR 0003: clean-room reference policy](docs/adr/0003-clean-room-reference-policy.md).
Product names are used only to identify these references.

## Repository layout

| Path                                               | Contents                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| [`apps/web`](apps/web)                             | React + Vite browser application: a pre-release editor surface            |
| [`apps/collab`](apps/collab)                       | Node.js WebSocket collaboration service (health endpoint + hello only)    |
| [`packages/protocol`](packages/protocol)           | Runtime-agnostic wire protocol definitions shared by clients and services |
| [`packages/engine`](packages/engine)               | ECMAScript-only canvas engine, from math to the editor façade             |
| [`packages/render-canvas`](packages/render-canvas) | Canvas 2D renderer of the engine's render frames, on the page's canvas    |
| [`scripts`](scripts)                               | Guardrails, bundle-size check, performance report and branch-name rule    |
| [`docs`](docs/README.md)                           | Architecture decisions, investigation process and development guides      |
| [`.github`](.github)                               | CI, CodeQL, Dependabot, issue forms and the pull request template         |

## Requirements

- **Node.js 24.22.1** (see [`.nvmrc`](.nvmrc))
- **npm 11.19.1**, the version bundled with Node.js 24.22.1

Both versions are pinned exactly and enforced by `engines`, `devEngines` and
`engine-strict=true`, so installs fail fast on a different toolchain.

## Getting started

```sh
git clone https://github.com/mariechristsagbo/planewright.git
cd planewright
nvm use            # or install Node.js 24.22.1 another way
npm ci
npm run dev:web    # http://localhost:5173
```

To run the collaboration service skeleton:

```sh
cp .env.example .env   # optional; defaults are used when unset
npm run dev:collab     # http://127.0.0.1:8787/healthz, WebSocket at ws://127.0.0.1:8787/ws
```

## Quality gates

| Command                                                             | What it checks                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run format:check`                                              | Prettier formatting                                                            |
| `npm run lint`                                                      | ESLint with type-aware rules and complexity guardrails                         |
| `npm run typecheck`                                                 | Strict TypeScript across every workspace                                       |
| `npm run test:unit`                                                 | Unit tests (Vitest)                                                            |
| `npm run test:integration`                                          | Integration tests, including the real WebSocket service                        |
| `npm run test:coverage`                                             | All Vitest projects with coverage thresholds                                   |
| `npm run test:e2e`                                                  | Playwright tests against the production build (needs Chromium)                 |
| `npm run build`                                                     | Production builds of the web app and collaboration service                     |
| `npm run guardrails`                                                | File-size limits and the forbidden-dependency policy                           |
| `npm run check:bundle-size`                                         | Bundle sizes of the engine, the renderer and the web app against their budgets |
| `npm run perf:bench`, `npm run perf:browser`, `npm run perf:report` | The performance budgets: benchmarks, browser measurements and their report     |
| `npm run secrets:scan`                                              | Secretlint scan of the working tree                                            |
| `npm run audit:deps`                                                | `npm audit` and registry signature verification                                |
| `npm run validate`                                                  | Every local gate except e2e and audit, in CI order                             |

See [docs/development/quality-gates.md](docs/development/quality-gates.md) for thresholds and
rationale.

## Contributing

Contributions are welcome once the foundation phase ends and feature issues are open. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report
security issues privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Marie-Christ Sagbo
