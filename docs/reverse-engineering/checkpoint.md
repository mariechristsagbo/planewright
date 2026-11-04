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

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Re-run each documented interaction from a fresh profile | Partial | 02, 03 and 05 were replayed in fresh profile s2 with identical probe results (05's fit scroll differs, explained by its dependency on 04b). 04, 06, 07, 08 and every `b` scenario ran only in s1. 09 ran in fresh profiles s3 and s4; 10 and 10b ran only in s3                                                                                                                                              |
| Screenshot dimensions validated                         | Done    | Every PNG header checked; REA viewport matched                                                                                                                                                                                                                                                                                                                                                               |
| Generated JSON and REA bundles validated                | Done    | All 16 committed JSON files parse. `sessions.json` and the three probe summaries regenerate byte-identically from the external sessions. Both REA bundles re-validated with `rea evidence-export` (exit 0; 3 and 7 records, 0 unknowns)                                                                                                                                                                      |
| CDP and driver ports loopback-only                      | Done    | `127.0.0.1:9222` and `127.0.0.1:9333` checked with `ss -ltn`                                                                                                                                                                                                                                                                                                                                                 |
| Owned processes and profiles cleaned up                 | Done    | Rechecked after the interrupted runs: no `pw-*` containers, no driver, runner or Chromium process, ports 9222/9333 free, no `/tmp` REA or Playwright profiles; profiles were container tmpfs                                                                                                                                                                                                                 |
| Separate Claude Code review session                     | Done    | An independent review of Draft PR #2 (2026-11-04) found 5 blocking issues: the arrow start-binding claim, the rectangle roundness default, the scenario 10 DPR claim, driver hardening, and ad-hoc evidence lacking scenarios. It also found non-blocking contradictions. All were addressed on this branch; the DPR question was re-verified live (session `s4-dpr-probe`). Residual scope stays open below |

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
   row under `research/excalidraw/scenarios/` (number 12 onwards; 11 is the DPR probe).
2. Use a new external session directory (for example `s5-desktop`). Rebuild
   `evidence/sessions.json` with `build-evidence.mjs`, listing every session directory.
3. When new REA bundles are exported, validate them with
   `node rea-build/scripts/rea.mjs evidence-export <bundle> <out>` (outside the repository).
4. To close the fresh-rerun requirement, replay the whole desktop chain in one fresh profile.
   Most scenarios depend on the previous end state, so they cannot run in isolation (see
   [scenario order](../../research/excalidraw/README.md#scenario-order-and-dependencies)):
   `00 → 01 → 02 → 02b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 08 → 08b`.
   Run 08 and 08b only once. Start the driver with a fresh `--out` and pass the same directory
   to `run.mjs --out` so it can read the per-run token.
5. For mobile, avoid re-applying emulation after the page has loaded (scenario 10's first step).
   Either restart the driver and reload, or drop that step, and check `devicePixelRatio` with a
   `metrics` step before relying on DPR.
