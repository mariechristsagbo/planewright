# Checkpoint: issue #1 status

Last updated: 2026-11-04 (after the fresh-profile reruns s6 and s7). Branch:
`docs/1-excalidraw-research`. Issue #1 stays open: the Draft PR refers to it (`Refs #1`) and does
not close it.

## Acceptance criteria

| Criterion                                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `methodology.md`                                                   | Done    | Updated for the isolated network, the hardened driver, the capture fix and the REA CLI                                                                                                                                                                                                                                                                                      |
| `feature-inventory.md` covers all discovered features              | Partial | Added in s6/s7: element context menu, panel Actions section, arrow and text controls, Preferences submenu, Clear canvas confirmation and the mobile dark dialogs. Still open: Find on canvas, language switch, library item flows, Export to Link (not clicked, because it publishes the scene). The exclusion of the generation features needs a maintainer decision       |
| `behavior-analysis.md`                                             | Done    | Every documented behaviour that rests on a probe was replayed in fresh profile s6 or s7 with identical results (47 of 47 shared desktop probe labels; mobile touch, tap, pinch zoom and pan delta). Edge cases marked [U] remain in the [residual matrix](residual-matrix.md)                                                                                               |
| `network-analysis.md`                                              | Done    | Observed metadata and hypotheses are separated; REA WebSocket frame shapes are marked lost                                                                                                                                                                                                                                                                                  |
| `architecture-hypotheses.md`                                       | Done    | Every entry is labelled with a confidence                                                                                                                                                                                                                                                                                                                                   |
| `rea-findings.md`                                                  | Done    | Evidence IDs reconciled: retained, lost, and new REA CLI records                                                                                                                                                                                                                                                                                                            |
| `limitations.md`                                                   | Done    |                                                                                                                                                                                                                                                                                                                                                                             |
| Desktop light/dark and mobile evidence sets                        | Done    | Desktop light and dark in s6, including dark element surfaces. Mobile light and dark in s7 at a DPR 3 asserted at every scenario boundary, including the dark Help, Export, Command palette, Share, Clear canvas, Preferences and Actions surfaces                                                                                                                          |
| Canvas interactions through the external driver while REA observes | Done    | REA 6.8.0 (build `5b953e1`) observed while the driver drew: `observe-web-session` during desktop scenario 02 and mobile scenario 10, and `inspect-web-page` during scenario 13. These ran through the REA CLI from `../rea-build`, because the project-local REA MCP tools were denied permission in this non-interactive session (see [blockers](#blockers-and-residuals)) |
| Evidence sanitized and stored under the agreed directories         | Done    | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `evidence/`. Retained room values were removed or overwritten (see [privacy](#privacy-remediation)). One residual copy exists outside the workspace (see blockers)                                                                                                             |
| No source maps, official repository, package or assets             | Done    | 0 `.map` requests in all seven netlogs; no package installed                                                                                                                                                                                                                                                                                                                |
| Prioritised backlog with acceptance criteria                       | Done    | [backlog.md](backlog.md), updated with the save timing and the element context menu                                                                                                                                                                                                                                                                                         |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Done    | s6 ran the whole desktop chain (00, 02, 02c, 02b, 12, 01, 13, 03, 03b, 04, 04b, 05, 06, 06b, 07, 07b, 15, 08, 08b) and s7 the mobile chain (09, 10, 10b, 14, 11), each in one fresh profile. Every s6 and s7 timeline row matches a committed scenario step. Native picker, save and export flows cannot complete in headless Chromium                                                                                                                                                                                                                                                                                                             |
| Screenshot dimensions validated                         | Done    | PNG headers checked, and now also CSS viewport, DPR, screen, touch points and canvas backing store, asserted at every scenario start. s7 captures are 1170×2532 device pixels at DPR 3                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Generated JSON and REA bundles validated                | Partial | All committed JSON parses and the s1–s3 probe summaries regenerate unchanged. `bundle-01-desktop.json` passes `rea evidence-export`. The new REA CLI records cannot be exported as a bundle without the MCP `export_evidence_bundle` tool; their screenshot records were checked against their own digests instead. `bundle-02-collab-mobile.json` no longer exists                                                                                                                                                                                                                                                                                |
| CDP and driver ports loopback-only                      | Partial | `isolation-check.sh` reported 11 of 11 checks passed (2026-11-04 15:43 and 16:53 UTC) and `selftest.sh` 18 checks, both on the tree before the third-review remediation. That version of `isolation-check.sh` printed `UNREACHABLE:probe-error` for a probe container that failed to run and counted it as PASS, and the per-probe outcome lines of those runs were not kept, so the 11 of 11 result does not exclude probe failures. The fixed script reports such probes as FAIL; it, `browser.sh` and the driver have not been rerun live since. The previous launcher was reachable from a default-bridge container (probe result `REACHABLE`) |
| Owned processes and profiles cleaned up                 | Done    | After every session: no `pw-*` container or network, no driver process, ports 9222/9333 free, no driver token files; profiles were container tmpfs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Separate Claude Code review session                     | Partial | Three independent reviews ran. The third found that a screenshot could be written while the URL held the room value (M4) and related tooling gaps; they are remediated in the current tree with stub-based tests that fail when each fix is reverted. No review of that remediation has run yet                                                                                                                                                                                                                                                                                                                                                    |

## Independent reviews

1. **Review of `3f9fc06`** (posted on PR #2). It found **7 major findings** (mobile DPR, claims that
   contradicted the probes, a room id and key in external REA evidence, driver hardening, CDP
   reachable on the Docker bridge, coverage against issue #1 and "Fixes #1", reproducibility),
   plus 8 minor findings and 5 suggestions. The previous version of this checkpoint said that
   review had 5 blocking findings and that all were addressed. That was wrong: it left out the
   room key, the bridge exposure and coverage, and the room key had not been dealt with.
2. **Review of `18b94a6`**. It found 5 blockers: CDP still reachable on the bridge, docs citing a
   removed REA bundle, incomplete driver hardening and broken reproduction commands, cited
   evidence without committed scenarios, and the open issue #1 criteria. It also raised
   non-blocking findings: missing tests, null-step, port, token-mode and download-name defects,
   confidence labels, the B-09 position, wrong Evidence IDs, and the room values in a session log.

How each was handled on this branch, from `dbbab22` onwards:

- **CDP isolation:** a per-run network with inter-container traffic disabled, plus a gateway-only
  forwarder, proven by `isolation-check.sh`.
- **Driver hardening:**
  - Origin, Fetch Metadata and declared-length checks, and a streamed body cap applied before
    parsing.
  - A navigation allowlist (the reference origin and `about:blank`) and a separate fixture step.
  - Validated ports, a recreated token file, and logged null or primitive steps.
  - Download names that always pass the name rules, and captures that are never overwritten.
  - Integration tests that drive the real server over loopback.
- **Reproduction commands:** fixed here and in the research README (`--out` and
  `run.mjs --quit`).
- **Ad-hoc evidence:** replaced by committed scenarios 12, 13, 14 and 15 and rerun fresh. Claims
  now cite s6/s7.
- **DPR:** assertions after emulation abort on any mismatch. The cause of the old DPR 1 readings
  was isolated (Playwright screenshots) and fixed, and the mobile run was redone at a verified
  DPR 3.
- **Documentation:** confidence labels, the B-09 position, Evidence IDs and this checkpoint
  corrected.
- **Privacy:** see below.

## Privacy remediation

Values were never printed; only counts and file names were recorded.

- `bundle-02-collab-mobile.json` (7 records) and `s1-desktop/rea/d03-inspect-collab.json` held
  the room id and key. Both were already gone from the workspace at about 14:29 UTC. No
  retained transcript records who removed them. The Evidence they carried is listed as lost in
  [REA findings](rea-findings.md#evidence-ids).
- A value scan found the room id or key in 3 more files, 4 occurrences each:
  - `logs/claude-excalidraw-research-03.stream.jsonl`;
  - one capture-session transcript;
  - one of its cached tool results.

  Every occurrence was first overwritten in place. The equal-length placeholders were then
  replaced with a neutral `<redacted-room-fragment>` marker, so that no shape scanner, strict or
  naive, still matches a room id and key. A re-scan finds 0 matches, and the JSONL files still
  parse. None of the 8 images embedded in that log dates from s1's collaboration window
  (13:43:45–13:46 UTC), so none can show the room link.

- The s1 screenshots `collab-01-session-dialog`, `collab-02-in-session` and `collab-04-stopped`
  showed part of the room id and a QR code that encodes the link. They were removed with
  `shred` (overwritten, then deleted). Their digests remain as `retired_screenshots` in
  `evidence/sessions.json`.
- In the s6 rerun, the driver redacted ARIA text and masked every input and image of the share
  dialog. `check-masks.mjs` passed both masked captures. The in-session capture was refused
  while the dialog was open. A later recheck of the s6 timeline (step names and counts only)
  found 7 mask boxes in each masked capture and no capture after the session ended. No REA call ran during the collaboration window, because REA target
  listings keep URL fragments.
- Shape scans (`secret-scan.mjs`) on 2026-11-04 found:
  - no secret-shaped values in the repository working tree or its full Git history;
  - none in the workspace logs, checkpoints and state, the s2–s7 raw sessions, the s1
    session outside its REA directory, or the orchestrator logs;
  - in the s1 raw REA directory, only the public web-config API key that is embedded in the
    reference's shipped script: 9 occurrences, 3 in each of 3 files (the exported main script
    and two REA records that contain it). It is public configuration, not a credential of this
    project, and it stays outside Git;
  - in the Claude project directory, the same public key 3 times in one cached REA result, and
    PEM header literals (no key material) in this session's transcript, written while testing
    the scanner.

## Blockers and residuals

- **REA MCP permission.** `mcp__rea__list_browser_targets` was denied twice in this
  non-interactive session (once during s5, and once on a disposable `about:blank` browser at
  16:19 UTC). Because of this:
  - the s5–s7 observations used the REA CLI of the same build;
  - the new records were not exported as an MCP Evidence bundle.

  A maintainer can grant the project-local REA MCP tools and re-export.

- **Retained copy outside the workspace.** This session's own Claude transcript contains the two
  s1 collaboration screenshots, as images, because they were opened once to confirm what they
  showed. The QR code in them still encodes the old room link. The file is under
  `~/.claude/projects/` and should be deleted after the session ends.
- **Scope decision.** The generation features (Text to diagram, Mermaid to Excalidraw, Wireframe
  to code) are excluded in [limitations](limitations.md) without maintainer approval.
- **Not observable here.** Native file pickers, save and export flows, the effective
  stop-session flow, multi-client collaboration, offline start, and the other ❌ rows of the
  [residual matrix](residual-matrix.md).
- **Third review.** A fresh independent review of the remediation is still to be run.

## Interrupted and aborted runs

- s1: the client of scenario 03 was killed (exit 137) after the driver had executed every step.
  The results come from the timeline, and 03 replayed identically in s2 and s6.
- s5: aborted at scenario 01 by the new metrics assertion (screen read 800×600).
- s6: four further metric aborts (01 twice, 12 once, and 00b once after a driver restart). Each
  stopped at its first step without changing the scene, and the scenario was rerun after 00b or
  00c restored the metrics. The driver was restarted twice in s6: once to load the new 00b
  scenario, and once to load the CDP capture fix.
- Agent runs were interrupted three times by turn limits. Ownership was rechecked after each:
  no owned container, network, process, port, token file or profile remained.

## Resume instructions

1. Run the checks first, without contacting any site. `browser.sh`, `isolation-check.sh` and
   the driver changed in the third-review remediation and have not been rerun live, so the first
   two are required before the next session:
   - `research/excalidraw/isolation-check.sh`
   - `research/excalidraw/selftest.sh`
   - `npx vitest run --project 'research:*'`
2. Start each session with `00` (desktop) or `09` (mobile). These are the only steps that emulate.
   Every later scenario asserts the metrics first.
3. After any tool that may disturb emulation, run `00b`/`09b` (reload and assert). Do not
   restart the driver mid-session; if you must, run `00c`.
4. Run `08`/`08b` last, at most once per session, and never during REA calls. The driver's
   `runLast` lock enforces the order and the single run; the REA rule stays manual.
5. Rebuild the index with `build-evidence.mjs` for every session directory (see the
   [research README](../../research/excalidraw/README.md)).
