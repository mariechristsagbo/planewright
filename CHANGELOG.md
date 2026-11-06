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
