# Checkpoint: issue #1 status

Last updated: 2026-11-04 (fourth-review remediation, from retained evidence and local checks
only; no reference session ran after s7). Branch: `docs/1-excalidraw-research`. Issue #1 stays
open: the Draft PR refers to it (`Refs #1`) and does not close it.

## Acceptance criteria

| Criterion                                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `methodology.md`                                                   | Done    | One confidence rule: two tools reading one session count as one session                                                                                                                                                                                                                                                                                                    |
| `feature-inventory.md` covers all discovered features              | Partial | Every entry has an ID (F-01–F-35) with a residual-matrix row. Still open: Find on canvas, language switch, library item flows, Export to Link (not clicked, because it publishes the scene). The exclusion of the generation features needs a maintainer decision                                                                                                          |
| `behavior-analysis.md`                                             | Partial | Every entry (B-01–B-37) has the eleven issue fields in order. Unobserved dimensions name their residual row, and "not applicable" is kept only with a stated reason. Persistence claims that no session observed are withdrawn (theme and modes across a reload, the 09b mobile reload, the s6 `00b` reloads). Many dimensions (undo, reload, mobile, edge cases) are open |
| `network-analysis.md`                                              | Done    | Observed metadata and hypotheses are separated. Both analytics beacon key sets are described with their s6 counts; facts from raw records are marked                                                                                                                                                                                                                       |
| `architecture-hypotheses.md`                                       | Done    | Every entry is labelled with a confidence                                                                                                                                                                                                                                                                                                                                  |
| `rea-findings.md`                                                  | Done    | Window bounds and retention come from `evidence/rea-windows.json`; the lifecycle offsets and the scenario 13 Delete time are marked as raw-only, and the coverage text no longer places the whole clear inside the window                                                                                                                                                  |
| `limitations.md`                                                   | Done    | Lists every fact read only from raw records, the live tooling results and the claims withdrawn by the third and fourth reviews                                                                                                                                                                                                                                             |
| Desktop light/dark and mobile evidence sets                        | Done    | Desktop light and dark in s6, including dark element surfaces. Mobile light and dark in s7 at a DPR 3 asserted at every scenario boundary                                                                                                                                                                                                                                  |
| Canvas interactions through the external driver while REA observes | Partial | Three REA CLI windows (scenarios 02, 10 and 13; the MCP tools were denied). Two retain navigation metadata only, the s7 window armed after scenario 10's first tap, and the third covers one origin (R-72)                                                                                                                                                                 |
| Evidence sanitized and stored under the agreed directories         | Done    | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `evidence/`. Retained room values were removed or overwritten (see [privacy](#privacy-remediation))                                                                                                                                                                           |
| No source maps, official repository, package or assets             | Done    | 0 `.map` requests in all seven netlogs; no package installed                                                                                                                                                                                                                                                                                                               |
| Prioritised backlog with acceptance criteria                       | Done    | [backlog.md](backlog.md). Criteria are labelled no more strongly than their behaviour entries; unobserved reload, tool and layout rules are **open**                                                                                                                                                                                                                       |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Done    | s6 ran the whole desktop chain and s7 the mobile chain, each in one fresh profile; every s6 and s7 timeline row matches a committed scenario step. Native picker, save and export flows cannot complete in headless Chromium                                                                      |
| Screenshot dimensions validated                         | Done    | PNG headers, CSS viewport, DPR, screen, touch points and canvas backing store asserted at every scenario start. s7 captures are 1170×2532 device pixels at DPR 3                                                                                                                                  |
| Generated JSON and REA bundles validated                | Partial | All committed JSON parses and the probe summaries regenerate unchanged. `bundle-01-desktop.json` passes `rea evidence-export`. The REA CLI records of s5–s7 cannot be exported as a bundle without the MCP `export_evidence_bundle` tool (R-73)                                                   |
| CDP and driver ports loopback-only                      | Done    | The fixed `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 against real local containers on 2026-11-04 (20:02/20:03 UTC, and again on `75f8eae` at 20:22/20:23 UTC), contacting no website. A probe that cannot run, and a failed docker listing during cleanup, now count as FAIL |
| Owned processes and profiles cleaned up                 | Done    | After every session and every local check: no `pw-*` container or network, no driver process, no driver token files; profiles were container tmpfs                                                                                                                                                |
| Separate Claude Code review session                     | Partial | Four independent reviews ran. The fourth (of `fcad19c`) is remediated in the current tree; no review of that remediation has run yet (R-75)                                                                                                                                                       |

## Independent reviews

1. **Review of `3f9fc06`** (posted on PR #2): 7 major findings, 8 minor findings and 5
   suggestions.
2. **Review of `18b94a6`**: 5 blockers (CDP reachable on the bridge, docs citing a removed REA
   bundle, driver hardening and reproduction commands, evidence without committed scenarios,
   open issue criteria) and non-blocking findings.
3. **Review of `3e1f4f7`**: 6 major findings. M1 behaviour entries lacked the issue's fields; M2
   unsupported zoom, binding and persistence statements; M3 overstated REA observations; M4 a
   screenshot could be written while the URL held a room value; M5 an incomplete residual
   matrix; M6 the open issue #1 criteria and maintainer decisions. M1–M5 were remediated up to
   `fcad19c`. M6 is not a defect to fix in the tree: it blocks closing issue #1 until the
   [remaining observation work](#remaining-observation-work) and the maintainer decisions are
   done. The `fcad19c` checkpoint listed only M1–M5.
4. **Review of `fcad19c`**: 0 critical, 2 major and 10 minor findings. Handled as follows:
   - **Major 1, stale PR body:** the PR description is rewritten against the remediated head.
   - **Major 2, persistence claims without observation:** withdrawn in `d6d08dd` and `c0439bc`;
     the reloads that never happened are planned in R-19 and R-54 (`9f38820`).
   - **Minors 1–3, REA window, raw provenance, analytics beacons:** corrected in `48b77b1`.
   - **Minor 4, confidence labels:** one rule in `2ed5e02`.
   - **Minors 5–7, "not applicable", undo rows, responsive scope:** `9f38820`.
   - **Minor 8, backlog generalisations:** `935fdb2`.
   - **Minor 9, malformed docs and a weak test:** `05780fe` and `75f8eae`; 17 of the new
     documentation checks fail against the `fcad19c` documents.
   - **Minor 10, tooling privacy:** every item was reproduced first, then fixed with tests that
     fail against the previous code: room and link values in any case and encoding depth
     (`b3f04c5`), redacted error text (`d57077c`), download names on disk (`7fcd5ce`), settled
     event waiters (`9fcadda`), on-screen mask boxes only (`6fdb170`), the `runLast` lock and
     halt reason kept across driver restarts (`e339650`), `rea-extract` never overwriting its
     input (`4ffbd7e`), and Docker cleanup checks that fail closed (`0c62612`).

## Privacy remediation

Values were never printed; only counts and file names were recorded.

- `bundle-02-collab-mobile.json` (7 records) and `s1-desktop/rea/d03-inspect-collab.json` held
  the room id and key. Both were already gone from the workspace at about 14:29 UTC. The
  Evidence they carried is listed as lost in [REA findings](rea-findings.md#evidence-ids).
- A value scan found the room id or key in 3 more files (a workspace log, one capture-session
  transcript and one of its cached tool results). Every occurrence was overwritten in place and
  then replaced with a neutral `<redacted-room-fragment>` marker; a re-scan found 0 matches.
- The s1 screenshots `collab-01-session-dialog`, `collab-02-in-session` and `collab-04-stopped`
  showed part of the room id and a QR code. They were removed with `shred`; their digests remain
  as `retired_screenshots` in `evidence/sessions.json`.
- **Retained copy, reconciled.** The `fcad19c` checkpoint said a Claude transcript still held the
  two s1 collaboration screenshots as images. That was stale. The orchestrator's mission record
  states that the capture-session transcript (`2b10b683`) and its six cached tool-result files
  were securely deleted at 18:59, after the third review, and that an earlier transcript
  (`3bfaaa56`) and its tool-results directory were deleted at 18:23 (times as recorded, without
  a time zone). This remediation checked those two named prefixes under the Claude projects
  directory on 2026-11-04, last at 20:23 UTC, and found no match. No other transcript was opened
  or scanned for images.
- In the s6 rerun, the driver redacted ARIA text and masked every input and image of the share
  dialog; `check-masks.mjs` passed both masked captures, and no REA call ran during the
  collaboration window.
- The fourth review found tooling paths that could keep a room value: error text in the
  timeline (which reaches `sessions.json`), on-disk download names, double-encoded and
  upper-case forms, and off-screen mask boxes. All are fixed (see above). The 8 failure messages
  already in `sessions.json` were checked and hold no room value or secret shape, and a
  documentation test now scans every committed research document for secret shapes.

## Blockers and residuals

- **REA MCP permission.** `mcp__rea__list_browser_targets` was denied twice in a non-interactive
  session, so s5–s7 used the REA CLI and their records were not exported as an MCP Evidence
  bundle. A maintainer can grant the project-local REA MCP tools and re-export (R-73).
- **Scope decisions.** The generation features (Text to diagram, Mermaid to Excalidraw,
  Wireframe to code) are excluded in [limitations](limitations.md) without maintainer approval
  (R-63), and Export to Link was not clicked because it publishes the scene (R-56).
- **Not observable here.** Native file pickers, save and export flows, the effective
  stop-session flow, multi-client collaboration and offline start.
- **Review of the remediation.** A fresh independent review of the fourth-review remediation is
  still to be run (R-75).

## Remaining observation work

The issue cannot be completed from retained evidence. These rows of the
[residual matrix](residual-matrix.md) need work before the behaviour contract is met:

- **Without a live session** (retained raw evidence only): set the driver netlog timestamps
  against the drawing steps for drawing-time traffic (R-66) and the worker trigger (R-64);
  re-export the s5–s7 REA records once the MCP tools are granted (R-73).
- **New live observation, priority 1:** keyboard accessibility (R-27); multi-point and modifier
  drawing (R-30, R-31); hit-testing (R-34); other handles, modifiers and nudging (R-36, R-37);
  named style controls (R-10, R-39); text editing and its undo (R-40); arrow endpoint placement,
  binding rules and undo (R-42); file flows in a headed browser (R-16, R-18, R-46, R-47);
  Ctrl+wheel at an off-centre pointer, zoom limits and pinch ratios (R-48); grouping, layers and
  alignment with their undo (R-49–R-51); zoom and selection across a reload, and scenario 09b
  run on a drawn scene with a scene probe after the reload (R-54).
- **New live observation, priority 2:** a reload while dark and with zen, grid and snap on, and
  Ctrl+Z after a toggle or theme change (R-19); responsive breakpoints, a tablet viewport and
  landscape orientation (R-23); undo for every entry listed in R-52; every other 🟡 or ❌ row of
  priority 2, including mobile versions of the desktop behaviours.
- **New live observation, priority 3:** the remaining priority 3 rows.
- **Maintainer decisions:** Export to Link (R-56); the generation features (R-63); whether to
  grant the REA MCP tools for a validated bundle (R-73).

## Interrupted and aborted runs

- s1: the client of scenario 03 was killed (exit 137) after the driver had executed every step.
  The results come from the timeline, and 03 replayed identically in s2 and s6.
- s5: aborted at scenario 01 by the metrics assertion (screen read 800×600).
- s6: four further metric aborts (01 twice, 12 once, and 00b once after a driver restart). Each
  scenario was rerun after 00b or 00c restored the metrics. The driver was restarted twice in s6.
- Agent runs were interrupted by turn limits several times, including twice during the
  fourth-review remediation. Ownership was rechecked after each: no owned container, network,
  process, port, token file or profile remained.

## Resume instructions

1. Run the checks first, without contacting any site: `research/excalidraw/isolation-check.sh`,
   `research/excalidraw/selftest.sh` and `npx vitest run --project 'research:*'`.
2. Start each session with `00` (desktop) or `09` (mobile). These are the only steps that emulate.
   Every later scenario asserts the metrics first.
3. After any tool that may disturb emulation, run `00b`/`09b` (reload and assert). If the driver
   must restart mid-session, restart it on the same `--out` (its `runLast` lock and halt reason
   are kept in `driver-state.json`) and run `00c`.
4. Run `08`/`08b` last, at most once per session, and never during REA calls. The driver enforces
   the order and the single run; the REA rule stays manual.
5. Rebuild the index with `build-evidence.mjs` and the window summary with `rea-windows.mjs` for
   every session directory (see the [research README](../../research/excalidraw/README.md)), then
   update the documents until both documentation tests pass.
