# Agent instructions

These instructions apply to every AI coding agent working in this repository. Human contributors
follow the same rules through [CONTRIBUTING.md](CONTRIBUTING.md).

## Project state

- Planewright is in its **foundation phase**. P0 engine work has started, but `packages/engine`
  holds only its math layer, ports, document model, scene store, undo history, camera, geometry,
  selection with hit testing, input events with the gesture recogniser, the Hand tool, the command
  registry with its keymap, and the editor layer's render loop and `createEditor`, and
  `packages/render-canvas` its Canvas 2D renderer. The web app shows a **navigation-only** surface:
  an empty canvas that pans and zooms, a tool bar and Undo and Redo controls with nothing to undo.
  Drawing, selecting and editing elements, persistence and collaboration features do **not** exist
  yet.
- **Behavioural investigation precedes feature implementation.** Do not implement editor
  features until the relevant investigation issue is complete and a feature issue with
  acceptance criteria exists.
- Keep the web UI factual. Never present the foundation as a finished or working editor.

## Non-negotiable rules

1. **Independent implementation.** Never add `@excalidraw/*` or other Excalidraw-derived
   packages. Never copy, transcribe or adapt Excalidraw source code, assets, fonts, icons or
   documentation text. Reference applications are studied only for observable behaviour; see
   [ADR 0003](docs/adr/0003-clean-room-reference-policy.md).
2. **No affiliation claims.** Excalidraw is a behavioural reference and REA is investigation
   methodology and tooling. Neither is a partner, sponsor or upstream of Planewright.
3. **Issue-driven work.** Every change maps to a GitHub issue. Work on a branch named
   `<type>/<issue>-<kebab-summary>` and merge through a pull request. Do not push to `main`.
   The only direct-to-`main` push was the one-time bootstrap.
4. **Conventional Commits.** Make atomic commits; commitlint runs in the `commit-msg` hook and
   in CI. Do not bypass hooks with `--no-verify`.
5. **No releases.** Do not create tags, GitHub releases or published packages unless a
   maintainer explicitly asks for one.
6. **Report results faithfully.** Record only commands you actually ran and their real output.
   If a check fails or is skipped, say so.
7. **Secrets.** Never commit secrets or `.env` files, and never print tokens in logs.

## Commands

Toolchain: Node.js 24.22.1 and npm 11.19.1, pinned exactly.

```sh
npm ci                     # install (also installs Git hooks)
npm run format             # write formatting
npm run lint               # ESLint, zero warnings allowed
npm run typecheck          # strict TypeScript, all workspaces
npm run test:unit          # unit tests
npm run test:integration   # integration tests
npm run test:coverage      # all Vitest projects with coverage thresholds
npm run test:e2e           # Playwright (Chromium) against the production build
npm run build              # production builds
npm run guardrails         # file-size and dependency-policy checks
npm run secrets:scan       # secretlint
npm run audit:deps         # npm audit and signature verification
npm run validate           # every local gate except e2e and audit
```

Run `npm run validate` before proposing a change, plus `npm run test:e2e` for UI changes.

## Code map

- `apps/web`: React 19 and Vite 8 application. Source in `src/`: the canvas host, input adapter
  and editor provider in `editor/`, the tool bar, Undo and Redo and the view readout in `ui/`, and
  the browser ports, text measurer and Mod key per platform in `platform/`. Unit tests in
  `tests/unit`, Playwright tests in `tests/e2e`, static files in `public/`.
- `apps/collab`: Node.js WebSocket service built with `ws` and bundled by esbuild. In
  development it runs TypeScript directly through Node's type stripping.
- `packages/protocol`: source-only, runtime-agnostic protocol package. Keep it free of DOM and
  Node.js APIs.
- `packages/engine`: the source-only canvas engine of
  [ADR 0004](docs/adr/0004-canvas-engine-package-boundaries.md), designed in
  `docs/architecture/engine`. ECMAScript only: its ESLint block forbids browser and Node.js
  globals, `Math.random`, `Date.now` and timers, which come through its ports, and its sources
  import only one another. A layer imports only from its own and earlier layers
  (`scripts/lib/engine-layers.ts`); only `math`, `ports`, `model`, `geometry`, `camera`, `scene`,
  `history`, `selection`, `input`, `tools`, `commands` and `editor` (its render frames, render loop
  and `createEditor`) exist so far. Tests run
  in the `engine:unit` and `engine:integration` projects; property tests use
  `tests/support/property.ts`.
- `packages/render-canvas`: the source-only Canvas 2D implementation of the engine's renderer port
  ([ADR 0006](docs/adr/0006-canvas-rendering.md)). Its ESLint block forbids every browser, worker
  and Node.js global except the Canvas 2D names it draws with (`Path2D`), timers, the clock
  (`Date.now`, `new Date()`) and `Math.random`, and its sources import only the engine's entry and
  one another, by `./` paths. Tests run in the `render-canvas:unit` project against a recording fake of the
  2D context.
- `scripts`: guardrail entry points; their pure logic lives in `scripts/lib` and is tested in
  `scripts/tests`.
- `research/excalidraw`: issue #1 behavioural-research tooling (loopback driver, scenarios,
  evidence builders, container browser, isolation check and self-test), plain Node.js `.mjs`
  under its own ESLint block `planewright/research` with Node and browser globals. Its tests run
  in the `research:unit` and `research:integration` Vitest projects, and the driver uses the
  root devDependency `playwright-core`. Sanitised outputs live in `docs/reverse-engineering`; raw
  evidence stays outside the repository.

## Coding conventions

- Use relative imports with explicit `.ts`/`.tsx` extensions; the code is erasable-syntax
  TypeScript (no enums, namespaces or parameter properties).
- Stay within the ESLint guardrails (complexity 10, depth 3, 4 parameters, 60 lines per function,
  300 lines per module). Split code instead of disabling rules.
- Validate untrusted input at boundaries (environment, network, files) and fail fast with clear
  errors.
- Add or update tests with every behaviour change, and record architectural decisions as ADRs in
  `docs/adr`.
