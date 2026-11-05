# Checkpoint: issue #1 status

Last updated: 2026-11-04 (fifth-review remediation, from retained evidence and local checks
only; no reference session ran after s7). Branch: `docs/1-excalidraw-research`. Issue #1 stays
open: the Draft PR refers to it (`Refs #1`) and does not close it.

## Acceptance criteria

| Criterion                                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `methodology.md`                                                   | Done    | One confidence rule: two tools reading one session count as one session. The page-load count (17) and where the metrics are asserted now match the committed evidence                                                                                                                                                                                                                                                                   |
| `feature-inventory.md` covers all discovered features              | Partial | Every entry has an ID (F-01–F-35) with a residual-matrix row. Still open: Find on canvas, language switch, library item flows, Export to Link (not clicked, because it publishes the scene). The exclusion of the generation features needs a maintainer decision. §2 is rated medium, on a raw comparison of the s1 and s6 ARIA snapshots, which are not identical                                                                     |
| `behavior-analysis.md`                                             | Partial | Every entry (B-01–B-37) has the eleven issue fields in order. Unobserved dimensions name their residual row, and "not applicable" is kept only with a stated reason. Claims that no session observed are withdrawn, among them the reload persistence claims and B-01's tool and selection after a drag. Many dimensions (undo, reload, mobile, edge cases) are open                                                                    |
| `network-analysis.md`                                              | Done    | Observed metadata and hypotheses are separated. Both analytics beacon key sets are described with their s6 counts; the cache counts come from `evidence/rea-windows.json`, and the storage names and the storage quota are raw-only                                                                                                                                                                                                     |
| `architecture-hypotheses.md`                                       | Done    | Every entry is labelled with a confidence                                                                                                                                                                                                                                                                                                                                                                                               |
| `rea-findings.md`                                                  | Done    | Window bounds and retention come from `evidence/rea-windows.json`; the lifecycle offsets, the scenario 13 Delete time, the REA side of the byte-identical screenshot pairs and the result sizes are marked as raw-only                                                                                                                                                                                                                  |
| `limitations.md`                                                   | Partial | It documents the inaccessible and unverified behaviour and lists the raw-only facts found by five reviews and their remediations. That list has not been audited exhaustively, and each review so far has found entries missing from it, so it is not claimed complete                                                                                                                                                                  |
| Desktop light/dark and mobile evidence sets                        | Partial | Desktop light and dark in s6, including dark element surfaces. Mobile light and dark in s7, where DPR 3 held at all 5 assertions (at 5 points: after 09's load and at the start and end of 10 and 14). Not captured: the dark desktop canvas context menu, command palette, library and sticky note (R-26), and many matrix rows have ❌ in the desktop-dark column, for example R-03, R-07, R-08, R-14, R-15 and R-17                  |
| Canvas interactions through the external driver while REA observes | Partial | Three REA CLI windows (scenarios 02, 10 and 13; the MCP tools were denied). Two retain navigation metadata only, the s7 window armed after scenario 10's first tap, and the third covers one origin (R-72)                                                                                                                                                                                                                              |
| Evidence sanitized and stored under the agreed directories         | Done    | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `evidence/`. Retained room values were removed or overwritten, and no copy is known to remain (see [privacy](#privacy-remediation))                                                                                                                                                                                                        |
| No source maps, official repository, package or assets             | Done    | 0 `.map` requests in all seven netlogs; no reference package installed                                                                                                                                                                                                                                                                                                                                                                  |
| Prioritised backlog with acceptance criteria                       | Partial | [backlog.md](backlog.md) has 22 items. Items 19–22 (libraries, alignment and distribution, offline start and reconnection, keyboard accessibility) have no observed behaviour, so all their behaviour criteria are **open** (R-15, R-51, R-57, R-27). Elsewhere, the criteria are not audited exhaustively against their entries: the sixth review found five labelled more strongly than their evidence (corrected), and many are open |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Partial | s6 re-ran the desktop chain and s7 the mobile chain, each in one fresh profile, and every s6 and s7 timeline row matches a committed scenario step. Not re-run: scenario 09b never ran; 12, 13 and 15 (s6) and 14 (s7) ran once; the committed storage inventory and the REA initial-page inspection are s1 only. Native picker, save and export flows cannot complete in headless Chromium                                             |
| Screenshot dimensions validated                         | Done    | PNG headers checked. From s6 on, CSS viewport, DPR, screen, touch points and canvas backing store asserted before the first input of every main scenario (follow-on scenarios run straight after one that asserted); the committed index has no `assertMetrics` step for s1–s5. s7 captures are 1170×2532 device pixels at DPR 3                                                                                                        |
| Generated JSON and REA bundles validated                | Partial | All committed JSON parses. With the changed tools, `sessions.json`, `rea-windows.json`, the five probe summaries and `rea-inspect-initial.summary.json` regenerate byte for byte from the retained records (checked in this remediation). `bundle-01-desktop.json` passed `rea evidence-export` earlier on 2026-11-04. The REA CLI records of s5–s7 cannot be exported as a bundle without the MCP `export_evidence_bundle` tool (R-73) |
| CDP and driver ports loopback-only                      | Done    | With this remediation's tooling, `isolation-check.sh` passed 11 of 11 (22:18 UTC) and `selftest.sh` 19 of 19 (22:19 UTC) against real local containers on 2026-11-04, on `dc6eef1`, contacting no website. Later commits change no tool those checks run. A probe that cannot run, and a failed docker listing during cleanup, count as FAIL                                                                                            |
| Owned processes and profiles cleaned up                 | Done    | After every session and every local check: no `pw-*` container or network, no driver process, no driver token files; profiles were container tmpfs                                                                                                                                                                                                                                                                                      |
| Separate Claude Code review session                     | Partial | Five independent reviews ran. The fifth (of `cb11dff`) is remediated in the current tree; no review of that remediation has run yet (R-75)                                                                                                                                                                                                                                                                                              |

## Checks of this remediation

- `npm run validate` passed on `0155717` (22:46 UTC: 27 test files, 415 tests) and on
  `626e849` (22:51 UTC: format, lint, typecheck, guardrails, secretlint, coverage and build;
  27 test files and 418 tests; coverage 98.13% statements, 95.1% branches, 96.85% functions and
  98.76% lines), on 2026-11-04.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed since
  `cb11dff`.
- Every behaviour fix was sabotage-checked: putting back the old behaviour, or removing the new
  check, made at least one new test fail. Most commit messages name that test; those of
  `0587fac`, `73bb550` and `ddc61f6` do not name it, and the sixth review's own sabotage runs
  confirmed all three.
- The 23 commits `0587fac`..`626e849` were pushed normally at 22:53 UTC; the remote branch head
  then read `626e849`. Their full bodies carry no trailers and no tool attribution, and
  `secret-scan.mjs` found no secret shape in their patches.
- On `626e849` all 8 GitHub check runs succeeded (Quality gates ran 27 test files and 418 tests,
  and the end-to-end job passed 1 test), CodeRabbit skipped the Draft, and 0 code-scanning
  alerts were open. PR #2 stayed a Draft with `Refs #1` and no closing reference; issue #1
  stayed open.
- After the local checks, no `pw-*` container or network, driver process, driver token file or
  listener on the check ports remained.
- The commit that adds the two items above changes only this file; its own checks are in the
  PR description.

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
     (`b3f04c5`, narrowed by the fifth review), redacted error text (`d57077c`), download names on
     disk (`7fcd5ce`), settled event waiters (`9fcadda`), on-screen mask boxes only (`6fdb170`),
     the `runLast` lock and halt reason kept across driver restarts (`e339650`), `rea-extract`
     never overwriting its PNG (`4ffbd7e`), and Docker cleanup checks that fail closed
     (`0c62612`).
5. **Review of `cb11dff`**: 0 critical, 1 major, 12 minor findings and 6 suggestions. Handled as
   follows; each fix has a test that fails against the previous code or wording:
   - **Major 1, criteria marked Done that the corpus calls partial:** this checkpoint. The
     backlog, the desktop light/dark and mobile evidence sets, the fresh-profile re-run and
     `limitations.md` are Partial, and the stop-session flow, multi-client collaboration and
     offline start are listed as planned observations, not as unobservable.
   - **Minor 1, mixed and letter-encoded room values:** `0587fac`.
   - **Minor 2, `rea-extract` could overwrite its input:** `9c9ef3f`.
   - **Minor 3, unredacted accessible names in `rea-extract`:** `73bb550`.
   - **Minor 4, empty halt reason and state-file mode:** `699f62a`.
   - **Minor 5, untested self-test checks:** `34c9fef`.
   - **Minor 6, withdrawn claims in scenario descriptions:** `57cfbb3`.
   - **Minor 7, raw-only labels in both directions:** `66a103d`.
   - **Minor 8, unsupported high ratings (B-32, feature inventory §2, B-13):** `9143523`.
   - **Minor 9, factual errors:** `da0df03`. Checking them showed that the reused
     `02-tool-probe` label also carried B-01's claim about the tool and selection after a drag;
     that claim is withdrawn in `29cd4e4`, and `ddc61f6` makes `timeline-summary.mjs` warn about
     such labels.
   - **Minor 10, contradictory notes on a remaining copy:** `062cb3b`.
   - **Minor 11, cross-reference gaps:** `ee714da`.
   - **Minor 12, PR body inaccuracies:** the PR description is rewritten against the remediated
     head.
   - **Suggestions:** masks must cover every element that may show a room value (s1,
     `dc6eef1`); failure text redacted again in the index (s2, `7205c58`); a room view without
     `runLast` halts the session (s3, `ba6486b`); `playwright-core` declared (s4, `ff12dc9`);
     wider link and secret-shape tests (s5, `675675b`); an accurate `browser.sh stop` report
     (s6, `9553059`). `a24596d` lists the new controls in the methodology, and `0155717` adds
     backlog items 19–22.

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
- **Retained copy, reconciled.** The orchestrator's mission record states that the
  capture-session transcript (`2b10b683`) and its six cached tool-result files were securely
  deleted at 18:59, after the third review, and that an earlier transcript (`3bfaaa56`) and its
  tool-results directory were deleted at 18:23 (times as recorded, without a time zone). A
  search for those two named prefixes under the Claude projects directory found no match on
  2026-11-04 at 20:23 UTC and again at 22:36 UTC. No other transcript was opened or scanned for
  images. No copy is known to remain.
- In the s6 rerun, the driver redacted ARIA text and masked every input and image of the share
  dialog; `check-masks.mjs` passed both masked captures, and no REA call ran during the
  collaboration window.
- The fourth and fifth reviews found tooling paths that could keep a room value: error text in
  the timeline and in the index built from it, on-disk download names, mixed and letter-encoded
  forms, accessible names copied by `rea-extract`, mask sets that missed the link, and a driver
  restarted on a new `--out` in a room view. All are fixed (see above). The 8 failure messages
  already in `sessions.json` hold no room value or secret shape, and a documentation test scans
  every research text under `docs/reverse-engineering`, `docs/investigation` and
  `research/excalidraw` for secret shapes.

## Blockers and residuals

- **REA MCP permission.** `mcp__rea__list_browser_targets` was denied twice in a non-interactive
  session, so s5–s7 used the REA CLI and their records were not exported as an MCP Evidence
  bundle. A maintainer can grant the project-local REA MCP tools and re-export (R-73).
- **Scope decisions.** The generation features (Text to diagram, Mermaid to Excalidraw,
  Wireframe to code) are excluded in [limitations](limitations.md) without maintainer approval
  (R-63), and Export to Link was not clicked because it publishes the scene (R-56).
- **Not observable in this headless setup.** Native file pickers, save and export flows; R-18
  and R-46 plan them in a headed browser.
- **Not observed yet, but planned.** The effective stop-session flow and multi-client
  collaboration (R-55), and offline start and reconnection (R-57).
- **Review of the remediation.** A fresh independent review of the fifth-review remediation is
  still to be run (R-75).

## Remaining observation work

The issue cannot be completed from retained evidence. These rows of the
[residual matrix](residual-matrix.md) need work before the behaviour contract is met:

- **Without a live session** (retained raw evidence only): set the driver netlog timestamps
  against the drawing steps for drawing-time traffic (R-66) and the worker trigger (R-64);
  re-export the s5–s7 REA records once the MCP tools are granted (R-73).
- **New live observation, priority 1:** keyboard accessibility (R-27); multi-point and modifier
  drawing (R-30, R-31); hit-testing (R-34); other handles, modifiers and nudging (R-36, R-37); named style controls
  (R-10, R-39); text editing and its undo (R-40); arrow endpoint placement, binding rules and
  undo (R-42); file flows in a headed browser (R-16, R-18, R-46, R-47); Ctrl+wheel at an
  off-centre pointer, zoom limits and pinch ratios (R-48); grouping, layers and alignment with
  their undo (R-49–R-51); zoom and selection across a reload, and scenario 09b run on a drawn
  scene with a scene probe after the reload (R-54).
- **New live observation, priority 2:** the tool and selection after a drag, read after a wait
  (R-02, R-29); a reload while dark and with zen, grid and snap on, and
  Ctrl+Z after a toggle or theme change (R-19); responsive breakpoints, a tablet viewport and
  landscape orientation (R-23); the missing dark desktop surfaces (R-26); library use (R-15);
  the stop-session flow and a second client (R-55); offline start and reconnection (R-57); undo
  for every entry listed in R-52; every other 🟡 or ❌ row of priority 2, including mobile
  versions of the desktop behaviours.
- **Second fresh-profile runs:** scenarios 12, 13 and 15 on desktop and 14 on mobile, each in a
  new fresh profile, with a storage inventory and a REA initial-page inspection in that session
  (R-76).
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
  fourth-review remediation and twice during the fifth. Ownership was rechecked after each: no
  owned container, network, process, port, token file or profile remained.

## Resume instructions

1. Run the checks first, without contacting any site: `research/excalidraw/isolation-check.sh`,
   `research/excalidraw/selftest.sh` and `npx vitest run --project 'research:*'`.
2. Start each session with `00` (desktop) or `09` (mobile), which emulate before the first
   navigation; `00c` re-emulates after a driver restart, and `11` re-emulates on purpose to probe
   DPR.
   Every main scenario asserts the metrics before its first input; the short follow-on
   scenarios (02b, 02c, 03b, 04b, 07b, 08b, 10b) rely on the one before them.
3. After any tool that may disturb emulation, run `00b`/`09b` (reload and assert). If the driver
   must restart mid-session, restart it on the same `--out` (its `runLast` lock and halt reason
   are kept in `driver-state.json`) and run `00c`. A driver that attaches to a room view with no
   `runLast` record halts at once.
4. Run `08`/`08b` last, at most once per session, and never during REA calls. The driver enforces
   the order and the single run; the REA rule stays manual.
5. Give every probe its own label, or `timeline-summary.mjs` warns that it merged reads.
6. Rebuild the index with `build-evidence.mjs` and the window summary with `rea-windows.mjs` for
   every session directory (see the [research README](../../research/excalidraw/README.md)), then
   update the documents until the documentation tests pass.
