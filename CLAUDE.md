# Claude Code instructions

@AGENTS.md

## Claude-specific notes

- Follow every rule in AGENTS.md. In particular: no editor features before investigation, no
  Excalidraw code, assets or packages, no direct pushes to `main`, and no releases.
- Use the REA MCP tools only for behavioural investigation tasks. Store evidence summaries in
  your own words under `docs/investigation/` and never commit captured third-party source or
  assets.
- Before finishing a task, run `npm run validate`, plus `npm run test:e2e` for UI changes, and
  report the real results.
