# ADR 0002: Workspace foundation

- Status: Accepted
- Date: 2026-11-04

## Context

Planewright needs a browser editor and an autonomous collaboration service that share protocol
definitions, with one set of quality gates and a reproducible toolchain.

## Decision

- **npm workspaces** in a single repository: `apps/web`, `apps/collab` and `packages/protocol`.
  No additional monorepo orchestrator is used until build times justify one.
- **Pinned toolchain**: Node.js 24.22.1 (an LTS line) and npm 11.19.1, the npm version bundled
  with that Node.js release. npm 12 was available but is not bundled with Node.js 24.22.1;
  pinning the bundled version means installing the pinned Node.js is enough to reproduce the
  toolchain. Enforcement uses `engines`, `devEngines` and `engine-strict=true`.
- **TypeScript 6.0.3**, not 7.0. typescript-eslint 8.72.1, the latest release at bootstrap,
  supports TypeScript `>=4.8.4 <6.1.0`. TypeScript 7.0 exposes only an `unstable/*` JavaScript
  API, so type-aware linting cannot use it yet. Dependabot ignores TypeScript `>= 6.1.0` until
  typescript-eslint supports a newer line.
- **Strict, erasable TypeScript**: strict mode plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` and related checks; `erasableSyntaxOnly` and explicit `.ts` import
  extensions so Node.js can run sources through native type stripping.
- **Source-only protocol package**: `@planewright/protocol` exports TypeScript sources. Vite
  bundles it for the web app and esbuild bundles it into the collaboration service.
- **Collaboration service**: Node.js `http` plus `ws`. It runs from source in development
  (`node --watch src/main.ts`) and is bundled by esbuild into `dist/main.js` for production,
  with registry dependencies kept external.
- **esbuild install script denied**: npm 11 blocks dependency install scripts unless approved.
  esbuild's `postinstall` only verifies the platform binary, which npm already installs through
  an optional platform package, so the script is explicitly denied in `allowScripts`.
- **minimatch override**: ESLint 10.14.0 and typescript-eslint 8.72.1 depend on minimatch
  10.2.6, which is affected by advisory GHSA-g3hv-75wg-m249 (first patched version 11.0.1).
  An `overrides` entry pins minimatch 11.0.4. The consumers do not use the APIs removed in
  minimatch 11 (`makeRe`, `Minimatch#regexp`). Remove the override once upstream releases depend
  on a patched version.
- **Testing**: Vitest projects named `<area>:<kind>` (unit and integration) with v8 coverage
  thresholds; Playwright with Chromium for end-to-end tests against the production build.

## Consequences

- One `npm ci` installs everything, and one Vitest run covers all workspaces.
- Contributors must use the pinned Node.js release; patch upgrades are deliberate changes.
- The TypeScript and minimatch decisions must be revisited as upstream releases change.
