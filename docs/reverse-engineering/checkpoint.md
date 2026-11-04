# Checkpoint: issue #1 status after the first baseline run

Last updated: 2026-11-04. Branch: `docs/1-excalidraw-research`.

## Acceptance criteria

| Criterion                                                          | Status                       | Notes                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `methodology.md`                                                   | Done                         |                                                                                                                                                                                                                                                                       |
| `feature-inventory.md` covers all discovered features              | Done for what was discovered | The element context menu, the panel "Actions" section and dark-mode secondary surfaces are open ([residual matrix](residual-matrix.md))                                                                                                                               |
| `behavior-analysis.md`                                             | Done (baseline)              | 33 behaviours; many edge cases are listed as residual                                                                                                                                                                                                                 |
| `network-analysis.md`                                              | Done                         | Observed metadata and hypotheses are separated                                                                                                                                                                                                                        |
| `architecture-hypotheses.md`                                       | Done                         | Every entry is labelled with a confidence                                                                                                                                                                                                                             |
| `rea-findings.md`                                                  | Done                         |                                                                                                                                                                                                                                                                       |
| `limitations.md`                                                   | Done                         |                                                                                                                                                                                                                                                                       |
| Desktop light/dark and mobile evidence sets                        | Partial                      | Desktop light: full. Desktop dark: canvas, main menu, panel, help, export. Mobile: light (inventory and touch) and dark (canvas and menu). Mobile dark dialogs are not captured                                                                                       |
| Canvas interactions through the external driver while REA observes | Partial                      | REA observed the reload and collaboration windows and screenshotted states after driver interactions (3 byte-identical comparisons). No REA observation window was armed **during** shape drawing, so canvas input produces no network or lifecycle events to observe |
| Evidence sanitized and stored under the agreed directories         | Done                         | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `docs/reverse-engineering/evidence/`                                                                                                                                     |
| No source maps, official repository, package or assets             | Done                         | `fetch_source_maps: false` throughout; no package installed                                                                                                                                                                                                           |
| Prioritised backlog with acceptance criteria                       | Done (initial)               | [backlog.md](backlog.md)                                                                                                                                                                                                                                              |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Partial | Scenarios 02, 03 and 05 were replayed in fresh profile s2 with identical results. Scenarios 04, 06, 07 and 08 ran only in s1; 09 and 10 ran in fresh profile s3 only                                                                    |
| Screenshot dimensions validated                         | Done    | Every PNG header checked; REA viewport matched                                                                                                                                                                                          |
| Generated JSON and REA bundles validated                | Done    | All 16 committed JSON files parse. `sessions.json` and the three probe summaries regenerate byte-identically from the external sessions. Both REA bundles re-validated with `rea evidence-export` (exit 0; 3 and 7 records, 0 unknowns) |
| CDP and driver ports loopback-only                      | Done    | `127.0.0.1:9222` and `127.0.0.1:9333` checked with `ss -ltn`                                                                                                                                                                            |
| Owned processes and profiles cleaned up                 | Done    | Rechecked after the interrupted runs: no `pw-*` containers, no driver, runner or Chromium process, ports 9222/9333 free, no `/tmp` REA or Playwright profiles; profiles were container tmpfs                                            |
| Separate Claude Code review session                     | Open    | Not started                                                                                                                                                                                                                             |

## Interrupted runs

- In session `s1-desktop`, the **client** of scenario 03 (`run.mjs`) was killed with exit 137.
  The driver had already executed every step: all of them, including the final screenshot and
  ARIA snapshot, are in that session's timeline. The results were taken from the timeline, and
  the scenario was later replayed in full in the fresh profile `s2-desktop-fresh` with
  identical results.
- Later agent runs were interrupted by turn limits. After each interruption, ownership was
  rechecked: no owned container, process, port or profile remained.

## Resume instructions

1. Pick the P1 rows from the [residual matrix](residual-matrix.md), and add one scenario file per
   row under `research/excalidraw/scenarios/` (number 11 onwards).
2. Use a new external session directory (for example `s4-desktop`). Rebuild
   `evidence/sessions.json` with `build-evidence.mjs`, listing every session directory.
3. When new REA bundles are exported, validate them with
   `node rea-build/scripts/rea.mjs evidence-export <bundle> <out>` (outside the repository).
4. Run scenarios 04, 06, 07 and 08 in a fresh profile to close the fresh-rerun requirement.
   Run 08 only once.
5. Request the separate review session before marking the pull request ready.
