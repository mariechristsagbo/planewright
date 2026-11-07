# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will
adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once releases begin. No
release has been published yet.

## [Unreleased]

### Added

- Repository foundation: npm workspaces for `apps/web`, `apps/collab` and `packages/protocol`,
  with Node.js 24.22.1 and npm 11.19.1 pinned.
- Strict TypeScript configuration shared by every workspace.
- Foundation-only web status page built with React and Vite. It is not a drawing editor.
- Collaboration-service skeleton with environment validation, a `/healthz` endpoint and an
  origin-checked WebSocket hello handshake.
- Pre-release protocol package (protocol version 0).
- Quality gates: Prettier, ESLint with complexity guardrails, Vitest unit and integration tests
  with coverage thresholds, Playwright end-to-end scaffolding, file-size and dependency-policy
  guardrails, secret scanning and dependency auditing.
- Commitlint, Husky Git hooks and branch-name validation for `<type>/<issue>-<kebab-summary>`.
- GitHub Actions CI, CodeQL analysis, Dependabot configuration, issue forms and a pull request
  template.
- Governance documents: MIT license, contributing guide, code of conduct, security policy and
  agent instructions.
- Documentation structure with architecture decision records and the investigation process.
- Engine package `@planewright/engine` (ENG-01): the math layer, the clock, scheduler and
  identifier ports, a seeded random source for property tests, an ESLint boundary and a
  layer-order check. It is not a drawing engine yet.
- Document model in the engine (ENG-02): the element, style and document types of every kind,
  identifier, colour, order-key and point-normalisation helpers, the initial default style, and
  `encodeDocument` and `decodeDocument` with the domain model's limits and a migration scaffold.
  Nothing uses it yet.
- Scene store in the engine (ENG-03): element patches checked by the model, change sets and their
  inverse, a store that applies a set whole or not at all with its origin and emits one scene
  update per set, the order, spatial, group and attachment indexes, the world bounds they key on,
  transient previews and transactions that commit one net change set. Nothing uses it yet, and
  history, rendering and input do not exist.
- Undo and redo history in the engine (ENG-04): entries that carry the selection around each
  committed transaction, burst merging by merge key, conflict-safe undo and redo that leave in
  place what another origin changed since, limits of 500 entries and an estimated 50 MB, and the
  availability flags. Committing a transaction is the only way an entry is recorded, and undo and
  redo do nothing while one is open. A throwing scene listener no longer stops the others or
  leaves a transaction half done, and a refused revert leaves its transaction open. Nothing uses
  the history yet, and no Undo or Redo control exists.
