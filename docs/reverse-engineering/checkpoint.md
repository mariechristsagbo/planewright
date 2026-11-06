# Checkpoint: issue #1 status

Last updated: 2026-11-06 (library undo, offline and language batch: live sessions s68–s70 on
2026-11-06 at 06:21–06:33 UTC, on mobile only, under the gate that stops on a 403 of any request
type, with no 403 met; see
[Library undo, offline and language batch](#library-undo-offline-and-language-batch-s68s70)).
Branch: `docs/1-excalidraw-research`. Issue #1 stays
open: the Draft PR refers to it (`Refs #1`) and does not close it.
Commit ranges are written as Git reads them: `A`..`B` is the commits after `A` up to and
including `B`. A span that includes its first commit is written from `A` to `B`.

## Acceptance criteria

| Criterion                                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `methodology.md`                                                   | Done    | One confidence rule: two tools reading one session count as one session, and results that match only once a setup difference is allowed for count as different. The page-load count (21) and where the metrics are asserted now match the committed evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `feature-inventory.md` covers all discovered features              | Partial | Each entry has an ID (F-01–F-35) with a residual-matrix row. Still open: library export and import, desktop Export to Link and the desktop generation features, as the desktop met a verification page. On mobile, Find on canvas, the language switch, the canvas background and a library item were used, each in two sessions or more (s61–s70; R-05, R-15), the one planned upload ran in s52 (R-56) and one generation in s49 (R-63); s22 found Diamond, Ellipse and Line in the mobile tool choices (R-24). §2 is rated medium: the s1 and s6 ARIA snapshots differ (raw comparison); R-76 raised the dark text panel, the desktop dark Preferences and the mobile dark surfaces to high on raw comparisons (s6 and s10, s7 and s11)                                     |
| `behavior-analysis.md`                                             | Partial | Every entry (B-01–B-49) has the eleven issue fields in order. Unobserved dimensions name their residual row, and "not applicable" is kept only with a stated reason. Claims no session observed, such as reload persistence, are withdrawn. R-76 raised B-02, B-35 and B-31's first-load list to high; B-30's save timing stays medium as s6 and s9 differ. Many dimensions (undo, reload, edge cases) are open; s16 added a mobile reload (B-30); s22–s57 added mobile binding, handles, layers, alignment, grouping, styles, lines, arrow types, text, freehand, Autoshape, Delete, links, Export to Link and inserts, most twice, with undo, and s58–s70 keyboard focus, offline start, layout, Find, language, library, its undo and background (B-43 to B-49), most twice |
| `network-analysis.md`                                              | Done    | Observed metadata and hypotheses are separated. Both analytics beacon key sets are described with their s6 counts; the cache counts come from `evidence/rea-windows.json`, and the storage names and the storage quota are raw-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `architecture-hypotheses.md`                                       | Done    | Every entry is labelled with a confidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rea-findings.md`                                                  | Done    | Window bounds and retention come from `evidence/rea-windows.json`; the lifecycle offsets, the scenario 13 Delete time, the REA side of the byte-identical screenshot pairs and the result sizes are marked as raw-only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `limitations.md`                                                   | Partial | It documents the inaccessible and unverified behaviour and lists the raw-only facts found by the fourth, fifth and sixth reviews and their remediations; the list began with the fourth. Each of those reviews found facts that were not yet listed, and the list has not been audited exhaustively, so it is not claimed complete                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Desktop light/dark and mobile evidence sets                        | Partial | Desktop light and dark in s6, including dark element surfaces. Mobile light and dark in s7, where DPR 3 held at all 5 assertions (at 5 points: after 09's load and at the start and end of 10 and 14), and again in s11 (R-76). Not captured: the dark desktop canvas context menu, command palette, library and sticky note (R-26), and many matrix rows have ❌ in the desktop-dark column, for example R-03, R-07, R-08, R-14, R-15 and R-17. From s15 the mobile emulation asks for and asserts a portrait-primary screen; s7, s11 and s12 most likely reported landscape-primary (limitations)                                                                                                                                                                            |
| Canvas interactions through the external driver while REA observes | Done    | REA CLI windows over driver scenarios: 02, 10 and 13 in s6 and s7, 12, 13, 15 and 14 in s8–s11, armed before their first step, 10 in s12, armed 4.1 s before (coverage 3.5 s before) allowing 7 HTTP(S) origins, so mobile drawing is covered (R-72 ✅), 19, 10 and 22 in s15 and s16 (4.2–4.6 s), one over each of 28–35 in s22–s36 (4.7–5.8 s), of 36–43 in s37–s49 (2.9–3.8 s), of each run of 45–48 in s53–s57 (1.6–3.3 s), 24 over 49–59 in s59–s67 (1.6–3.6 s) and 6 over 60, 61 with 51, 53 and 54 in s68–s70 (3.1–3.6 s). Two retain navigation metadata only, the s7 window armed after 10's first tap, the s8–s11 windows cover one origin and REA keeps no time per request; the s13 and s14 windows saw only a verification page, and s16's over a reload failed   |
| Evidence sanitized and stored under the agreed directories         | Done    | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `evidence/`. Retained room values were removed or overwritten, and no copy is known to remain (see [privacy](#privacy-remediation))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| No source maps, official repository, package or assets             | Done    | 0 `.map` requests in all eleven netlogs; no reference package installed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Prioritised backlog with acceptance criteria                       | Partial | [backlog.md](backlog.md) has 22 items. Items 19–22 (libraries, alignment and distribution, offline start and reconnection, keyboard accessibility) have no observed desktop behaviour, so those criteria are **open** (R-15, R-51, R-57, R-27); item 20 records the mobile commands and their undo (s25–s43), and items 19, 21 and 22 the mobile library item, offline start and keyboard focus of s58–s64. Elsewhere, the criteria are not audited exhaustively against their entries: the sixth review found five labelled more strongly than their evidence (corrected), and many are open                                                                                                                                                                                  |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Partial | s6 re-ran the desktop chain and s7 the mobile chain, each in one fresh profile, and every s6 and s7 timeline row matches a committed scenario step. The R-76 sessions s8–s11 ran 12, 13 and 15 on desktop and 14 on mobile once more, each in a new fresh profile with a storage inventory and a REA initial-page inspection, and each of their timelines is exactly the steps of its scenarios (R-76 ✅). s12 ran scenario 10 a third time, in a new fresh profile, and its 6 probes match s11's and s3's. s16 ran 10 a fourth time and 22 a second time, in a new fresh profile: their 13 ARIA snapshots match s12's byte for byte, and the probes match but for a 3 px scroll after the pinch, which s7 has too. s17–s21 ran 25 and 27 three times and 26 twice, each in a new fresh profile: s21's 34 probe labels match s19's, and s20's 14 match s18's in every zoom, but for the scroll. s28–s32, s35 and s36 re-ran scenarios 29–35, each in a new fresh profile, and every probe they share with s23–s27, s33 and s34 (83 labels) is identical. s42–s45, s47 and s49 re-ran scenarios 37–42, each in a new fresh profile, and every probe they share with s38–s41, s46 and s48 (51 labels) is identical; 43 ran once, to keep the generation requests to one, and 44 once, in s52, to keep to one upload. s55 and s57 re-ran 45, which s53 ran first, and 48, and s56 re-ran 46 and 47, each in a new fresh profile, and every probe they share is identical (20, 20, 12 and 30 labels). s62–s64 re-ran 49, 52, 50, 51, 24, 53 and 54, each in a new fresh profile: s63's 8 shared labels match s60's, and s62's 48 and s64's 13 match s59's and s61's but for two rows of 52, after 56 left a choice open, and 54's French labels, which a 403 kept away; s65–s67 re-ran 49, 56, 52, 57, 53, 58, 59 and 55, each in a new fresh profile: s65's 88 labels match s62's, s66's 16 match s64's and s67's 11 match s61's, all identical, so 55–59 have now each run twice. s69 re-ran s68’s chain of 60, 09b, 50, 61, 51 and 24, in a new fresh profile, and its 19 labels match s68’s, all identical, so 09b, which had never run, and the new 60 and 61 have each run twice; s70 re-ran 53 and 54, and its 13 labels match s61’s, all identical, so 54’s French labels have loaded twice. Not re-run: 15 ran after 00 and 07c, not after 01–07b. Native picker, save and export flows cannot complete in headless Chromium                                                                                                                                                                                                                                                                                       |
| Screenshot dimensions validated                         | Done    | PNG headers checked. From s6 on, CSS viewport, DPR, screen, touch points and canvas backing store asserted, and from s15 on the screen orientation, before the first input of every main scenario (follow-on scenarios run straight after one that asserted); the committed index has no `assertMetrics` step for s1–s5. s7 and s11 captures are 1170×2532 device pixels at DPR 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Generated JSON and REA bundles validated                | Done    | All committed JSON parses. With the current tools, `sessions.json`, `rea-windows.json`, the nine probe summaries, the five initial-inspection summaries and `static-api-surface.json` regenerate byte for byte from the retained records. This was checked in the fifth-review remediation on 2026-11-04, by the sixth review on `46b2b01`, by the review of `a78a210` on that head and, for R-76, on `f0aa21b` on 2026-11-05: first the nine files committed before R-76, then the s1–s11 files built after it; all 17 again by the tenth review on `f1562ed`, on `5f955a6` in its remediation, on `776dc05` in the eleventh-review remediation, by the twelfth review on `4e9c663`, which compared 7 of them byte for byte and the 10 that a builder prints to stdout by a canonical digest, because writing them to a file was refused, and on `e59ecf8` in its remediation; the thirteenth review, on `6d5d264`, compared the same 7 byte for byte and the same 10 by a canonical digest, for the same reason, and argued from their layout, without a literal comparison, that Prettier would give those 10 the same bytes. `rea-extract.mjs` changed in `f0aa21b`, to read REA CLI envelopes, and `lib/windows.mjs`, which it shares with `rea-windows.mjs`, in `8bfdfe3`, to refuse failed ones, and again in `5574b04`, with `rea-windows.mjs` in `a64611a`, which changes only their failure messages, and in `2b5ff0e`, to count a missing timeline as unknown, and `495e95e`, with both scripts, to name a file that is not valid JSON, neither of which changes a committed file; the other builders and the libraries they import are unchanged since `46b2b01`. `bundle-01-desktop.json` passed `rea evidence-export` earlier on 2026-11-04. `netlog-steps.json`, added in `545b97b` and built by `netlog-steps.mjs`, regenerates byte for byte with the tools at `eff8534`, as do the other 17 ([Netlog placement](#netlog-placement-r-64-r-66)). The fourteenth review, on `620eccf`, regenerated all 18 and compared them byte for byte; in its remediation `46f447a` regenerated `netlog-steps.json` in the start order of `7bceb59`, which moves one s6 placement, and all 18 regenerate byte for byte with the tools at `f6a9ffe`. The fifteenth review, on `a9a4619`, regenerated all 18 and found them identical byte for byte after Prettier, with no missing or extra file. In the observation batch, the 23 REA CLI records of s5–s11 and the 7 of s12–s14 became two bundles that REA's MCP import validated and `export_evidence_bundle` wrote (R-73 ✅), and with the tools at `78b6192` all 22 committed evidence files, the 4 of s12–s14 included, regenerate byte for byte in three runs |
| CDP and driver ports loopback-only                      | Done    | With the sixth-review tooling, `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 against real local containers on 2026-11-05 at 00:15–00:16 UTC, on `e38955a`, contacting no website; their output is committed in [local-checks/](local-checks/). Before the R-76 sessions they passed again, 11 of 11 and 19 of 19, on `0b4fb19` on 2026-11-05 at 04:45–04:46 UTC; that output is committed there too. Before the observation batch they passed again, 11 of 11 and 19 of 19, on `78b6192` on 2026-11-05 at 16:47–16:49 UTC (output in local-checks/), and each of s12–s14 probed its own browser before the driver attached. Before the mobile follow-up they passed again, 11 of 11 and 19 of 19, on `b21edd4` at 17:53–17:54 UTC (output in local-checks/), and s15 and s16 each probed its own browser. Before the mobile priority-1 batch they passed again, 11 of 11 and 19 of 19, on `ddc3e81` at 19:54–19:55 UTC (output in local-checks/), and s17–s21 each probed its own browser. Before the mobile touch-control batch they passed again, 11 of 11 and 19 of 19, on `0f22218` at 21:24–21:25 UTC (output in local-checks/), and s22–s36 each probed its own browser. Before the mobile control batch they passed again, 11 of 11 and 19 of 19, on `de052c8` at 22:50–22:51 UTC and, after a probe change, on `32448e3` at 23:01 UTC (output in local-checks/), and s37–s50 each probed its own browser. Before the mobile radio and edit batch's scenarios they passed again, 11 of 11 and 19 of 19, on `19fbe93` at 01:01–01:02 UTC, after the input and probe changes (output in local-checks/); s51 and s52 ran earlier, at `2a6ec57`, whose driver the `32448e3` checks cover, and s51–s57 each probed its own browser. Before the keyboard, offline and layout batch's scenarios they passed again, 11 of 11 and 19 of 19, on `5ec677a` at 02:53 UTC, after the driver change (output in local-checks/); s58 ran earlier, at `d81dc03`, whose driver the `19fbe93` checks cover, and s58–s64 each probed its own browser. Before the replay batch they passed again, 11 of 11 and 19 of 19, on `61c695a` at 05:20–05:21 UTC (output in local-checks/), and s65–s67 each probed its own browser. Before s68–s70 they passed again, 11 of 11 and 19 of 19, on `c097333` at 06:17–06:18 UTC (output in local-checks/), and each session probed its own browser. The earlier runs on `dc6eef1` (2026-11-04, 22:18 and 22:19 UTC) kept no output. This holds from s5 on: s1–s4 ran on the default Docker bridge, where the DevTools forwarder was reachable from other containers (see the methodology). A probe that cannot run, and a failed docker listing during cleanup, count as FAIL |
| Owned processes and profiles cleaned up                 | Done    | After every session and every local check: no `pw-*` container or network, no driver process, no driver token files; profiles were container tmpfs. The removal checks of the `e38955a` and `0b4fb19` runs are in local-checks. After each of s8–s14 the container, its network, the driver, the listeners on 9222 and 9333, the token file and any REA CLI process were checked gone, and after s12–s70 also any container of the browser image                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Separate Claude Code review session                     | Partial | Fifteen independent reviews ran. The fifteenth (of `a9a4619`) meets the R-75 exit rule: 0 critical, 0 major and 0 minor findings, and its 3 suggestions are listed with their handling. The observation batch after `db16323`, with the mobile batches after `2864145`, `a4990b6`, `823dae7`, `7e547de`, `2a6ec57`, `d81dc03`, `61c695a` and `5d2126b`, is behaviour-changing and no review covers it yet, so R-75 is 🟡; as the maintainer decided, one fresh independent review runs once, at readiness, after every acceptance observation of issue #1, and none ran in the batch or the follow-up. It reviewed the fourteenth-review remediation, `620eccf`..`a9a4619`, which handled the minor finding and 6 suggestions of the fourteenth review. R-75 closes only under the exit rule in [Independent reviews](#independent-reviews), which applies to every behaviour-changing commit, so it is ✅ until a behaviour-changing commit follows `a9a4619`: the ninth review met it on `a85eb82`, but the R-76 commits after `935f2fc` were behaviour-changing and no review covered them until the tenth (see [R-76 runs](#r-76-runs-s8s11)), and the thirteenth met it on `6d5d264`, but no review covered the netlog placement after `c010f7e` until the fourteenth. The tenth to the fifteenth are automated Claude Code reviews, not human approval. R-75 aside, the other Partial criteria and requirements keep issue #1 open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Checks of the fifth-review remediation

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
- The 23 commits from `0587fac` to `626e849` were pushed normally at 22:53 UTC; the remote branch head
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

## Checks of the sixth-review remediation

- `npm run validate` passed on `e59bac5` (2026-11-05, 00:18–00:19 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 29 test files and 455 tests; coverage 98.17%
  statements, 95.27% branches, 96.91% functions and 98.78% lines).
- `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 on `e38955a` against local
  containers only (see [local-checks/](local-checks/)); afterwards no `pw-*` container or network
  remained.
- Sabotage checks: with the `46b2b01` source put back, the new tests failed: the `goto` refusal
  6, the timeline redaction 1, the capture re-check 2 and the `browser.sh stop` report 2. With
  the `46b2b01` documents put back, 21 of the 23 new documentation checks failed; the other two,
  "end the raw-only list at its own bullet" and "lists under priority 2 only rows of that
  priority", guard the end of the raw-only list and the priority 2 list, which were already
  right. With the `02-tool-probe` raw-only item removed, the bounded `rawOnly()` fails where the
  old one passed.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `sessions.json`, `rea-windows.json`, the probe summaries and the inspect summary were not
  regenerated again: `build-evidence.mjs`, `timeline-summary.mjs`, `rea-windows.mjs` and
  `rea-extract.mjs` are unchanged since `46b2b01`, where the sixth review regenerated them byte
  for byte.
- New commit bodies carry no trailers and no tool attribution, and `secret-scan.mjs` found no
  secret shape in their patches; the push and the GitHub checks are in the PR description.

## Checks of the seventh-review remediation

- `npm run validate` passed on `db24b1f` (2026-11-05, 01:11–01:13 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 30 test files and 461 tests; coverage 98.17%
  statements, 95.27% branches, 96.91% functions and 98.79% lines).
- Sabotage checks, each in a temporary copy outside the repository: with the handler result
  written unredacted again, the new `selector` and `role` test failed (`room-fragment` 2); with
  key names kept as they are, which had passed all 404 research tests, the new key-name test
  failed (`room-fragment` 2). With the `a78a210` `server.mjs` put back, both new timeline tests
  failed and the other 410 research tests passed. With the `a78a210` checkpoint and residual
  matrix put back, the 7 new documentation checks failed. With the `a78a210` tests and the
  `46b2b01` documents, 22 of the 24 sixth-review documentation checks failed; the two that
  passed are the two named in the sixth-review checks above, and the 24th, on the retained
  local-check output, was added in `e59bac5`.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `isolation-check.sh` and `selftest.sh` were not run again. The timeline change is tested with
  a stub page and the real `selector` and `role` handlers only.
- The committed index and summaries were not regenerated: the builders and the libraries they
  import are unchanged since `46b2b01`, and the review of `a78a210` regenerated all 8 files byte
  for byte on that head.
- The bodies and patches of the new commits are checked before the push (trailers, tool
  attribution and `secret-scan.mjs`); those results, the push and the GitHub checks are in the PR
  description.

## Checks of the eighth-review remediation

- `npm run validate` passed on `080e238` (2026-11-05, 02:10–02:11 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 31 test files and 468 tests; coverage 98.17%
  statements, 95.27% branches, 96.91% functions and 98.79% lines).
- The new reply test failed against the `8029c1e` runner (`room-fragment` 3) and passed after
  the fix. The new exit-rule and record checks failed against the documents before each change.
- Sabotage checks, each in a temporary copy outside the repository:
  - redacting only the top level of a result failed the nested-result test (`room-fragment` 5),
    and the other 412 research tests passed; leaving arrays as they are failed it too;
  - the reply carrying the result as returned failed the reply test (`room-fragment` 3), and the
    other 413 passed; handlers given the redacted step, and a reply redacted by overwriting the
    handler's own result, failed it too;
  - with the `a78a210` checkpoint and residual matrix, 6 of the 34 checks in the two files that
    held the record checks failed. With a simulated eighth review recorded consistently, the
    rewritten checks passed and the `8029c1e` versions failed 2; with that review listed but the
    review note left as it was, 3 checks failed;
  - the exit-rule check failed with the `8620915` documents, with a rule that leaves out minor
    findings and with a rule without the record-only clause. R-75 marked ✅ while the latest
    review reports minor findings failed 2 checks.
  - the record checks of the review of `8029c1e` failed with the `080e238` documents (3 checks)
    and with that review said to meet the exit rule (2); a later review listed without saying
    whether it meets the rule failed 1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `isolation-check.sh` and `selftest.sh` were not run again. The reply change is tested with stub
  handlers, a stub page and the real `run.mjs` client over loopback only; `selftest.sh` reads only
  numeric and error fields from the reply.
- The committed index and summaries were not regenerated: the builders and the libraries they
  import are unchanged since `46b2b01`, and the review of `8029c1e` regenerated all 8 files byte
  for byte on that head.
- The bodies and patches of the new commits are checked before the push (trailers, tool
  attribution and `secret-scan.mjs`); those results, the push and the GitHub checks are in the PR
  description.
- The remediation ends at `a85eb82`, the commit that records it; the review of `a85eb82` covers
  all of it.

## Checks of the ninth-review record

- This record changes only the checkpoint, the residual matrix and the record checks. `407b28c`
  adds to the exit rule that updating the record checks counts as recording, `306c35c` takes the
  R-75 status from the latest review, and the commit that adds this section records the review.
  No research tooling, tooling test or research claim outside this record changed after
  `a85eb82`.
- `npm run validate` passed on `306c35c` (2026-11-05, 03:44–03:45 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 31 test files and 471 tests; coverage 98.17%
  statements, 95.27% branches, 96.91% functions and 98.79% lines).
- Sabotage checks, each in a temporary copy outside the repository, after an unchanged control
  copy passed:
  - with the `a85eb82` record checks and `review-list.mjs` put back and this record kept, 4 of
    the 419 research tests failed: the exit-rule statement, the record of the review of
    `8029c1e`, the open review row and the latest listed review;
  - with this record and R-75 left 🟡, 2 checks failed; with the review said to report one
    minor finding, 5; without the bullet that ends the eighth-review remediation at `a85eb82`,
    5; with this section named as a ninth-review remediation, 6; with the review listed under
    `080e238`, 6;
  - with the `407b28c` documents, the derived checks passed and only the 4 checks of this
    record failed. With the `306c35c` checks and those documents, R-75 marked ✅ while the eighth
    review reports a minor finding failed 2 checks, and the `a85eb82` checkpoint failed the
    exit-rule check of `407b28c`.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `isolation-check.sh` and `selftest.sh` were not run again, and the committed index and
  summaries were not regenerated: no tooling changed after `a85eb82`, where the review of
  `a85eb82` regenerated all 9 committed evidence files byte for byte.
- The bodies and patches of the new commits are checked before the push (trailers, tool
  attribution and `secret-scan.mjs`); those results, the push and the GitHub checks are in the PR
  description.

## R-76 runs (s8–s11)

R-76 asked for scenarios 12, 13 and 15 on desktop and 14 on mobile, each again in a new fresh
profile, with a storage inventory and a REA initial-page inspection in that session.

- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19
  on `0b4fb19` at 04:45–04:46 UTC (output in [local-checks/](local-checks/)), and the research
  Vitest projects passed 25 test files and 431 tests on that head. `0b4fb19` adds 07c (only 07's
  dark-theme switch, so that 15 can follow 00) and 16 (one storage read, for the mobile session);
  neither emulates, navigates or captures.
- **Sessions,** on 2026-11-05, one after another, each in its own new container, network and
  tmpfs profile, with one load of the reference page and no failed step. Their orders are in
  the [research README](../../research/excalidraw/README.md#scenario-order-and-dependencies):
  `s8-desktop-r76-12` (04:48–04:50 UTC), `s9-desktop-r76-13` (04:50–04:52),
  `s10-desktop-r76-15` (04:52–04:53) and `s11-mobile-r76-14` (04:53–04:55). Each first load came
  from the network, not a service worker (network analysis).
- **REA,** the CLI of build `5b953e13…`, with raw output only under the workspace artifact tree:
  a target listing and a 2 s initial-page inspection with s1's parameters after 00 or 09, and
  an `inspect_web_page` window armed before 12, 13, 15 or 14 that covered every step of it
  ([REA findings](rea-findings.md#evidence-ids)). No REA call ran outside these.
- **Bounds kept:** Export to Link, the generation features and collaboration were not used, no
  account was involved, and the netlogs hold 0 `.map` requests. The driver ran with every
  control added after s7; no session opened a room view or halted.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, no REA CLI process left.
- **Integrity:** each timeline is exactly the steps of its scenarios in order; `secret-scan.mjs`
  found no secret shape in the four raw session trees or in `docs/reverse-engineering`; the
  generated files regenerate byte for byte (see the regeneration note above).
- **What changed:** B-02, B-35, B-31's first-load inventory and several dark and mobile
  surfaces are high, because the second runs match; B-30's save timing stays medium, because s9
  saved one shape by the 255 ms read where s6 had none saved by the third read; scenario 15
  matches s6 only once its different scroll and styles are allowed for, so B-34 stays medium,
  and B-06's dark text box, first rated high, is medium since the tenth review.
  s8–s11 ran a later build than s1–s7: the one `index-*.js` script that every s1–s7 netlog
  requests is requested in no s8–s11 netlog, and every s8–s11 netlog requests another one
  (`evidence/sessions.json`); the REA initial-page inspections list it as the main chunk.
- **Reviewed by the tenth review.** The review of `f1562ed` covers these commits
  (`935f2fc`..`f1562ed`). They change research tooling, tests and claims, so they are
  behaviour-changing. When they were pushed, the R-75 exit rule spoke only of review
  remediations, so R-75 stayed as the ninth review had set it; the tenth review reported that
  gap (its Minor 4), and the rule now covers every behaviour-changing commit.
- **Commit message warning.** commitlint reported `footer-leading-blank` (a warning, 0 problems)
  on `f9dc3db`, whose body has a line that starts like a footer token; the commit is kept.
- **Checks of the record.** `npm run validate` passed on `7bec65f` (2026-11-05, 05:44–05:46 UTC:
  format, lint, typecheck, guardrails, secretlint, coverage and build; 36 test files and 507
  tests; coverage 98.17% statements, 95.27% branches, 96.91% functions and 98.79% lines). Each
  commit's tests ran first on exactly its staged tree, and each new or rewritten check failed
  under a mutation in a temporary copy outside the repository, after an unchanged copy passed.
  `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  bodies and patches of the new commits are checked before the push (trailers, tool
  attribution and `secret-scan.mjs`); those results, the push and the GitHub checks are in the
  PR description.

## Checks of the tenth-review remediation

- **Commits.** `8bfdfe3`, `38b973e`, `42c0664`, `19bfa5d`, `52523e0`, `f0eac4f`, `5eb8852` and
  `5f955a6`, each mapped to its finding in the review of `f1562ed`, and the commit that adds this
  section. The remediation ends at `79fc538`, the commit that adds this section. It changes research
  tooling (`lib/windows.mjs` and `rea-extract.mjs`), tests and documented claims; nothing under
  `apps/` or `packages/` changed.
- `npm run validate` passed on `5f955a6` (2026-11-05, 07:50–07:51 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 39 test files and 528 tests; coverage 98.17%
  statements, 95.27% branches, 96.91% functions and 98.79% lines).
- **Sabotage.** Each new check failed under at least one of 60 mutations, each in a temporary copy
  outside the repository, after an unchanged copy passed (4 control copies, all passed): 4 of the
  netlog, 8 of the placement, 16 of the bundle tool, 16 of the scenarios and 16 of the record
  checks. One record mutation first matched no text and ran again with the exact text.
- **Reproducibility.** With the tools at `5f955a6`, all 17 committed evidence files regenerate
  byte for byte from the retained records: `sessions.json`, `rea-windows.json`, the nine probe
  summaries, the five initial-inspection summaries and `static-api-surface.json`. The stricter
  REA envelope reader changes none of them.
- **No new observation.** The raw s11 netlog and timeline were read again for the timing in the
  network analysis; no live session ran, no site was contacted and no REA tool was called.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
  `isolation-check.sh` and `selftest.sh` were not run again: the driver, the browser scripts and
  the self-test are unchanged since `0b4fb19`, where both passed.
- **Commits and secrets.** `secret-scan.mjs` found no secret shape and no driver token file in
  `git log -p f1562ed..5f955a6`, in the messages of those commits, or in `docs/reverse-engineering`
  and `research/excalidraw`. The commit bodies carry no trailers and no tool or AI attribution.
  commitlint reported `footer-leading-blank` (a warning, 0 problems) on `8bfdfe3`, whose body has
  a wrapped line that starts like a footer token; the commit is kept. The push and the GitHub
  checks are in the PR description.
- **Review.** The review of `79fc538`, the eleventh, covers this remediation (`f1562ed`..`79fc538`).
  It reported one minor finding, so the exit rule is not met; see that review.

## Checks of the eleventh-review remediation

- **Commits.** `d61898e`, `5574b04`, `a64611a`, `c30387d`, `328c7fb`, `bdaa4a4`, `28db3b4` and
  `776dc05`, each mapped to its finding in the review of `79fc538`, and the commit that adds this
  section. The remediation ends at `4e9c663`, the commit that adds this section. It changes
  research tooling (`lib/windows.mjs` and `rea-windows.mjs`), its tests, the coverage include list
  of `vitest.config.ts` and documented claims; nothing under `apps/` or `packages/` changed.
- `npm run validate` passed on `776dc05` (2026-11-05, 09:13–09:14 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 42 test files and 546 tests; coverage 98.31%
  statements, 96% branches, 97.23% functions and 98.88% lines, now with `lib/windows.mjs` at 100%;
  no threshold changed). With the `79fc538` include list, the coverage summary had no entry for
  `lib/windows.mjs`.
- **Sabotage.** Each commit's tests ran on its tree before the commit, and each new or rewritten
  check failed under at least one of 38 mutations, each in a temporary copy outside the
  repository, after an unchanged copy passed (9 control copies, all passed).
- **Reproducibility.** With the tools at `776dc05`, all 17 committed evidence files regenerate
  byte for byte from the retained records: `sessions.json`, `rea-windows.json`, the nine probe
  summaries, the five initial-inspection summaries and `static-api-surface.json`.
- **No new observation.** The committed index and the raw REA files were read, the latter by
  shape only (every retained CLI output reports `ok: true` with an Evidence id); no live session
  ran, no site was contacted and no REA tool was called.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
  `isolation-check.sh` and `selftest.sh` were not run again: the driver, the browser scripts and
  the self-test are unchanged since `0b4fb19`, where both passed.
- **Commits and secrets.** `secret-scan.mjs` found no secret shape and no driver token file in
  `git log -p 79fc538..776dc05`, in the messages of those commits, or in `docs/reverse-engineering`,
  `docs/investigation` and `research/excalidraw` (130 files). The commit bodies carry no trailers
  and no tool or AI attribution. commitlint reported `footer-leading-blank` (a warning, 0
  problems) on `bdaa4a4`; the commit is kept. The push and the GitHub checks are in the PR
  description.
- **Review.** The review of `4e9c663`, the twelfth, covers this remediation (`79fc538`..`4e9c663`).
  It reported two minor findings, so the exit rule is not met; see that review.

## Checks of the twelfth-review remediation

- **Commits.** `2b5ff0e`, `1d21d38`, `495e95e`, `ffd18a8`, `27e702b`, `32c4647` and `e59ecf8`,
  each mapped to its finding in the review of `4e9c663` or recording that review, and the commit
  that adds this section. The remediation ends at `6d5d264`, the commit that adds this section. It
  changes research tooling (`lib/windows.mjs`, `rea-windows.mjs` and `rea-extract.mjs`), its
  tests, the research README and documented claims; nothing under `apps/` or `packages/` changed.
- `npm run validate` passed on `e59ecf8` (2026-11-05, 10:28–10:29 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 44 test files and 560 tests; coverage 98.32%
  statements, 96.03% branches, 97.25% functions and 98.88% lines, with `lib/windows.mjs` at 100%;
  no threshold changed).
- **Sabotage.** The new tests of `2b5ff0e` and `495e95e` were written first and failed with the
  `4e9c663` code. Each new or rewritten check failed under at least one of 32 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (7 control copies, all
  passed). The checks on room values in the new tests compare booleans, so a failing run never
  printed the synthetic room value.
- **Reproducibility.** With the tools at `e59ecf8`, all 17 committed evidence files regenerate
  byte for byte from the retained records: `sessions.json`, `rea-windows.json`, the nine probe
  summaries, the five initial-inspection summaries and `static-api-surface.json`. Neither change
  to the REA readers alters them: every retained observation record has a timeline list, and
  every raw file that the builders read is valid JSON.
- **No new observation.** The three raw `observe_web_session` records were read by shape only
  (their timeline lists hold 0, 12 and 1 events); no live session ran, no site was contacted and
  no REA tool was called.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
  `isolation-check.sh` and `selftest.sh` were not run again: the driver, the browser scripts and
  the self-test are unchanged since `0b4fb19`, where both passed, and none of them imports
  `lib/windows.mjs`.
- **Commits and secrets.** `secret-scan.mjs` found no secret shape and no driver token file in
  `git log -p 4e9c663..e59ecf8`, in the messages of those commits, or in `docs/reverse-engineering`,
  `docs/investigation` and `research/excalidraw` (132 files). The commit bodies carry no trailers
  and no tool or AI attribution, and commitlint reported no problem and no warning on any of them.
  The push and the GitHub checks are in the PR description.
- **Review.** The review of `6d5d264`, the thirteenth, covers this remediation
  (`4e9c663`..`6d5d264`). It reported no critical, major or minor finding, so the exit rule is met;
  see that review.

## Checks of the thirteenth-review record

- This record changes only the checkpoint, the residual matrix, the record checks and the number
  words of `review-list.mjs`. `668d79b` adds the words for a thirteenth review, without which the
  record checks fail on a thirteenth entry, and the commit that adds this section records the
  review. No research tooling, tooling test or research claim outside this record changed after
  `6d5d264`, and none of the four suggestions is addressed.
- `npm run validate` passed on `668d79b` (2026-11-05, 11:43–11:45 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 45 test files and 565 tests; coverage 98.32%
  statements, 96.03% branches, 97.25% functions and 98.88% lines; no threshold changed).
- **Tests first.** Before each change its new checks failed: the netlog checks (4 of 4), the
  placement checks (7 of 8, the eighth a guard that a netlog without start times keeps its
  summary), the bundle checks (the unit file could not load, and 4 of the 5 script checks failed,
  the fifth a guard that an existing output is kept), the scenario checks (38 of 38, in a copy
  without the new scenarios) and the record checks of this section (6 of 8 with the `db16323`
  documents; the other 2 read only the evidence index and fail under its mutations).
- **Sabotage.** Each new or rewritten check failed under at least one of 26 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (2 control copies, both
  passed). For the word lists: the `6d5d264` lists, either word left out, the ordinal misspelt and
  a fourteenth word added. For the record: the `668d79b` documents; R-75, the review requirement
  or the blocker left open, or R-75 left at priority 1; a **Not covered by a review.** bullet kept
  in either place; the twelfth-review remediation not ended at `6d5d264`, or the eleventh at
  `4e9c663`; a minor finding; all 17 files said to be compared byte for byte, or the missing
  literal comparison left out; a suggestion dropped or said to be addressed; a limit, the session
  or the review count wrong; the review missing from the R-75 row; this section named as a
  remediation; a wrong test count; and the `6d5d264` record checks of the twelfth review, which
  fail 5 checks with these documents.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `isolation-check.sh` and `selftest.sh` were not run again, and the committed index and summaries
  were not regenerated: no research tooling changed after `e59ecf8`, where the twelfth-review
  remediation regenerated all 17 committed evidence files byte for byte.
- **No new observation.** The raw evidence was not read; no live session ran, no site was contacted
  and no REA tool was called.
- The bodies and patches of the new commits are checked before the push (trailers, tool
  attribution and `secret-scan.mjs`); those results, the push and the GitHub checks are in the PR
  description.

## Netlog placement (R-64, R-66)

This work used retained raw evidence only: no live session ran, no site was contacted, and no
browser, container, driver or REA process was started. It is not a review remediation, and none of
the four suggestions of the review of `6d5d264` is addressed.

- **Commits.** `6051fd5` adds `netlog-steps.mjs` and `lib/placement.mjs`; `545b97b` commits
  `evidence/netlog-steps.json` for s1–s11; `3a1d1a3` says that a netlog time is when the driver
  wrote the entry, once the request had finished or failed, not when the request started;
  `e44ba19` sets every drawing step against the netlog (R-66); `a078f83` places the dedicated
  worker event (R-64); `eff8534` keeps the latest review's own verdict apart from later commits in
  the record checks; `0b2ebda` adds this section, records the work and reopens R-75; and the
  commit after it corrects two counts in this section.
  They change research tooling, its tests and documented claims; nothing under `apps/` or
  `packages/` changed.
- **What the times show.** Both raw files take their times from the driver process's clock. The
  netlog writes a request once it has finished or failed, and the timeline records when each step
  started, so a placement is an inference from two observed times [I, raw netlog and timeline
  times] and bounds a request's start only from above.
  - R-66: no netlog entry, on any origin, was written during any of the 82 drawing steps of
    s1–s11 (71 in s1–s7). Whether drawing starts a request that ends later, or causes console
    output on mobile or WebSocket traffic in a room, stays unverified, so R-66 stays 🟡.
  - R-64: in s1 and s6 the dedicated worker event was written during the Export to SVG step, but
    both sessions had clicked Export to PNG 15.0 s before in the same dialog, so the trigger stays
    a hypothesis and R-64 stays 🟡.
  - The s8–s11 statements that put a request's start in a scenario or between two times now say
    when the netlog wrote it; their counts and times are unchanged.
- `npm run validate` passed on `eff8534` (2026-11-05, 13:02–13:03 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 50 test files and 605 tests; coverage 98.46%
  statements, 96.45% branches, 97.59% functions and 98.97% lines, with `lib/placement.mjs` at 100%;
  no threshold changed).
- **Tests first.** Each commit's new or rewritten checks ran on its tree before the change and
  failed: the tooling tests while the code was missing, the evidence checks while the summary was
  missing (4), the timing checks (4), the R-66 checks (6), the R-64 checks (3), the verdict checks
  (2), and the record checks of this section (5) and the rewritten entry check of the thirteenth
  review (1).
- **Sabotage.** Each new or rewritten check failed under at least one of 91 mutations,
  each in a temporary copy outside the repository, after an unchanged copy passed (9 control
  copies, all passed). One more mutation, which took `0b2ebda` out of the Commits bullet, first
  passed, because the check read the whole section; the check now reads that bullet only and
  fails under it.
- **Reproducibility.** With the tools at `eff8534`, all 18 committed evidence files regenerate byte
  for byte from the retained records: the 17 listed in the regeneration note and
  `netlog-steps.json`, whose two runs before its commit were also byte-identical.
- **No new observation.** The raw timelines and netlogs of s1–s11 and the s8–s11 session logs were
  read in place.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
  `isolation-check.sh` and `selftest.sh` were not run again: the driver, the browser scripts and
  the self-test are unchanged since `0b4fb19`, and none of them imports `lib/placement.mjs`.
- **Commit message errors.** The body of `545b97b` says that the summary places 523 entries against
  1,825 timeline rows; it is 1,815. The body of `3a1d1a3` names R-66 among the documents that said
  a request started; R-66 said only when requests came, and that commit added the finish-time
  limit to it. The body of `0b2ebda` says that the new record checks failed 6 tests; 5 were new
  and 1 was the rewritten entry check of the thirteenth review. The body of `e44ba19` says that
  its new checks derive every count, gap and time from the summary; the beacon split, the four
  desktop inputs and the socket closes were not derived until `329bc50`. The commits are kept,
  because no commit is rewritten.
- **The record of its review.** `exitRuleState` read where reviewed work ends only from the checks
  of a review remediation; since `50b2632` it also reads this section, and since `bdc8140`
  `reviewState` gives the state of any listed review. The work ends at `620eccf`, the commit after
  `0b2ebda` that corrects two counts here.
- **Covered by the review of `620eccf`.** The commits after `c010f7e`, from `6051fd5` to `620eccf`,
  are behaviour-changing. The review of `620eccf` covers them and reports one minor finding, so it
  does not meet the exit rule; the remediation of that finding is recorded with that review.

## Checks of the fourteenth-review remediation

- **Commits.** `93e4ae2` and `50b2632` let the record checks read a fourteenth review and the netlog
  placement as the work it covers; `134b173`, `5c6a886`, `329bc50`, `bdc8140`, `7bceb59`, `46f447a`,
  `2f0cd20`, `0b77988` and `f6a9ffe` remediate the minor finding and the six suggestions of the
  review of `620eccf`; and the commit that adds this section records that review. The remediation
  ends at `a9a4619`, the commit that adds this section. It changes research tooling
  (`lib/placement.mjs`), its tests, the committed placement, the research README and documented
  claims; nothing under `apps/` or `packages/` changed.
- `npm run validate` passed on `f6a9ffe` (2026-11-05, 14:49–14:51 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 51 test files and 625 tests; coverage 98.5%
  statements, 96.51% branches, 97.67% functions and 99% lines, with `lib/placement.mjs` at 100%; no
  threshold changed).
- **Tests first.** Each new or rewritten check ran before its change. These failed: the word checks
  (2 of 5), the covered-work check (1), the guard against start-time wording (1), the write-time
  passage (1), the review-state checks (3), the trigger-order checks (3) and the README order check
  (1), the key-step check (1), the label checks (2), the time checks (2) and the README time check
  (1). The other new checks guard claims or code that were already right, so they passed when added:
  the beacon split, range and desktop inputs and the socket closes (`329bc50`), the exact Partial
  list and the `3a1d1a3` disclosure (`bdc8140`), the second covered-work check (`50b2632`), and the
  same-millisecond drawing boundary and the trigger rows that do not match (`7bceb59`). The record
  checks of this record failed 11 with the `f6a9ffe` documents, 8 new and 3 rewritten.
- **Sabotage.** Each new or rewritten check failed under at least one of 69 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (12 control copies, all
  passed); 68 of the mutations failed a check. The one that passed allows two millisecond digits in
  the time pattern, which the read-back already refuses, so no input tells it apart. With the
  `329bc50` record check of the thirteenth review, an extra Partial testing requirement passes, as
  the review found; the new check fails under it. The record checks of this record fail under each
  of 18 further mutations of this record, after an unchanged copy passed. The checks on room values
  compare booleans, so a failing run never printed the synthetic room value.
- **Reproducibility.** With the tools at `7bceb59`, `netlog-steps.json` regenerates with one change,
  committed in `46f447a`: the s6 beacon after Ctrl+S is placed under the key step at timeline line
  459 instead of the download step at line 460. With the tools at `f6a9ffe`, all 18 committed
  evidence files regenerate byte for byte, and all 2,338 retained times are in the canonical form.
- **No new observation.** The raw timelines and netlogs of s1–s11 were read in place; no live
  session ran, no site was contacted and no REA tool was called.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
  `isolation-check.sh` and `selftest.sh` were not run again: the driver, the browser scripts and the
  self-test are unchanged since `0b4fb19`, and none of them imports `lib/placement.mjs`.
- **Commits and secrets.** The bodies and patches of the new commits are checked before the push
  (trailers, tool attribution and `secret-scan.mjs`); those results, the push and the GitHub checks
  are in the PR description.
- **Review.** The review of `a9a4619`, the fifteenth, covers this remediation
  (`620eccf`..`a9a4619`). It reported no critical, major or minor finding, so the exit rule is met;
  see that review.

## Checks of the fifteenth-review record

- This record changes only the checkpoint, the residual matrix, the record checks and the number
  words of `review-list.mjs`. `ab2a687` adds the words for a fifteenth review, without which the
  record checks fail on a fifteenth entry, and the commit that adds this section records the review.
  No research tooling, tooling test or research claim outside this record changed after `a9a4619`,
  and none of the three suggestions is addressed.
- `npm run validate` passed on `ab2a687` (2026-11-05, 15:53–15:54 UTC: format, lint, typecheck,
  guardrails, secretlint, coverage and build; 52 test files and 633 tests; coverage 98.5%
  statements, 96.51% branches, 97.67% functions and 99% lines; no threshold changed).
- **Tests first.** The rewritten word checks failed with the `a9a4619` word lists (2 of 9), and the
  new and rewritten record checks failed with the `ab2a687` documents (11 checks: the 9 new ones and
  2 of the 3 rewritten ones), before each change. The third rewritten check, of the netlog placement
  record, now reads the state of the review of `620eccf` instead of R-75 at the latest head, so it
  passes with both documents; it fails under the sabotage below.
- **Sabotage.** Each new or rewritten check failed under at least one of 67 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (4 control copies, all
  passed). For the word lists (9): the `a9a4619` lists, either word left out, the ordinal misspelt,
  fourteen in place of fifteen, a sixteenth word added, an earlier number or ordinal repeated and
  thirteen misspelt. For the record (58): the `ab2a687` documents; R-75 left 🟡 or at priority 1, its
  evidence without `a9a4619` or `620eccf`, and its next step, its suggestions or its note on the
  netlog placement wrong; the review requirement left Partial, another criterion or requirement
  changed, or the issue not kept open in the review note or the header; the blocker left open; the
  review bullet of the fourteenth-review remediation turned back into an unreviewed one or changed,
  the end of that remediation or the bullet of the fourteenth review that names its review removed,
  and this section named as a remediation; the review of `620eccf` made to meet the rule; and each
  count, verdict, head, range, session, disclosure, limit and suggestion of the new entry and of
  this section changed. Four record mutations first matched no text, or more than one place, and ran
  again with the exact text; one more, which renamed `reviewState` only in the title of Suggestion
  3, passed, because the bullet names it again, and with both names removed it fails. The `a9a4619`
  record checks of the fourteenth review and of the netlog placement fail 3 checks with these
  documents, the 3 that are rewritten.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed.
- `isolation-check.sh` and `selftest.sh` were not run again, and the committed evidence files were
  not regenerated: no research tooling changed after `f6a9ffe`, where the fourteenth-review
  remediation regenerated all 18 byte for byte, as the fifteenth review did on `a9a4619`.
- **No new observation.** The raw evidence was not read; no live session ran, no site was contacted
  and no REA tool was called.
- The bodies and patches of the new commits are checked before the push (trailers, tool attribution
  and `secret-scan.mjs`); those results, the push and the GitHub checks are in the PR description.

## Observation batch (s12–s14)

This batch ran live sessions again, for R-66 and R-72, R-64, R-56, R-63 and R-73. It is not a
review remediation and addresses none of the open review suggestions. On 2026-11-05 the maintainer
placed every guest-accessible feature in scope, so Export to Link and the generation features are
no longer excluded.

- **Commits.** `20d9dfe` adds each request's start time to the netlog (`startedAt`), `3b4d35e`
  places start times against the timeline, `b9a6a79` adds `rea-bundle.mjs`, and `78b6192` adds
  scenarios 17–23. The commit after it adds the s12–s14 evidence files, and the one after that the
  local check output and the documents. They change research tooling, its tests and
  documented claims; nothing under `apps/` or `packages/` changed.
- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19
  on `78b6192` at 16:47–16:49 UTC (output in [local-checks/](local-checks/)).
- **Sessions,** on 2026-11-05, each in its own new container, network and tmpfs profile:
  `s12-mobile-draw-rea` (16:50–16:52 UTC: 09, 10, 22, 16), `s13-desktop-draw-rea` (16:52–16:54:
  00, 12, 23, 16) and `s14-desktop-svg-only` (16:54–16:56: 00, 17). Before its driver attached,
  each session checked its own browser: DevTools published on 127.0.0.1:9222 only and reachable
  from the host, and unreachable from a probe container on the default bridge, from one on the
  run's own network and through the default bridge gateway (5 PASS lines each in the raw session
  log). The session helper that ran these probes is outside Git; it calls the committed
  `browser.sh`, driver and `run.mjs`, and the probe of `isolation-check.sh` with
  `lib/probe-outcome.sh`.
- **The verification page.** In s13 and s14 the reference answered the desktop load with HTTP 403
  and a hosting-provider verification page (a script, a worker and two fetches under
  `/.well-known/vercel/`) instead of the app [O]. With no canvas on the page, the metrics assertion
  stopped 12, 23 and 17 at their first step, so no input reached the site, and the REA windows over
  them retained no request. This research does not bypass such a page: no user agent was changed
  and no load was retried or left to wait it out. So the sessions planned for 18, 19, 20 and 21
  did not run, and no further session contacted the site. s12, at 16:50–16:52 UTC with scenario
  09's mobile user agent, had loaded the app with HTTP 200 [O]. Whether the page depends on the
  user agent, the headless browser or the time is unverified [U].
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 00 or 09, and an `inspect_web_page` window that allows the 7 HTTP(S) origins
  any s1–s11 netlog recorded (REA accepts exact HTTP(S) origins only, so the collaboration
  WebSocket origin cannot be listed). In s12 the window over scenario 10 (`ev_8f4584f5`) armed
  4.1 s before its first step, its network coverage 3.5 s before, and it ended after the last; it retained 67 requests, 0 WebSocket
  connections and 0 console events, and the driver netlog has the same 67 requests with a start
  inside it, on 3 of the 7 origins (R-72 ✅).
- **Request start times (R-66).** s12's netlog records the start of all 104 of its requests. None
  fell while one of scenario 10's 3 touch drags was the latest step to start, and the next entry
  came 2.9 s or more after a drawing step (`evidence/netlog-steps-s12-s14.json`) [I, raw netlog
  and timeline times]. The 63 scripts that the service worker served in scenario 10 began 0.5 to
  0.7 s after the tap that closed the main menu after the Dark mode switch; in s11 all 63 were
  written during 10 too. What starts them is a hypothesis [H]. R-66 stays 🟡: on desktop no
  window allows every origin and no netlog has start times yet.
- **Mobile generation dialogs (R-63).** Scenario 22 ran in s12 after 10, in dark theme. Mermaid to
  Excalidraw opened a dialog with two tabs, Text to diagram and Mermaid, the Mermaid tab offering
  an example flowchart with Insert and a Ctrl+Enter hint (B-38). Opening it loaded 14 scripts,
  after 2 aborted script requests. Insert added 21 elements: 5 rectangles, 1 diamond, 5 bound
  arrows and 10 labels in containers. The Text to diagram tab has a heading, two paragraphs, a
  prompt box and an unnamed button that is disabled while the box is empty; nothing was typed or
  sent. Wireframe to code opened no dialog and set the tool to `magicframe` (B-39).
- **R-73.** The project-local REA MCP tools were allowed in this session. `rea-bundle.mjs` laid
  the 23 REA CLI records of s5–s11 and the 7 of s12–s14 out as two bundles in the artifact tree;
  `import_evidence_bundle` validated each (23 and 7 records imported), `export_evidence_bundle`
  wrote it, `reset_investigation` cleared the MCP session between the two, and `rea
evidence-import` read each export back, with the same records in the same order (R-73 ✅). The
  bundles hold raw records and stay outside Git.
- **Bounds kept:** no account, no room and no verification page bypassed; Export to Link was not
  clicked and Text to diagram generated nothing, because their scenarios did not run; the three
  netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the three raw
  session trees, in the bundles or in `docs/reverse-engineering`.
- **Integrity:** s12's timeline is exactly the steps of its four scenarios, in order, and in s13
  and s14 each stopped scenario recorded only its first step. All 22 committed evidence files
  regenerate byte for byte with the tools at `78b6192`, in three runs.
- **Tests first.** Before each change its new checks failed: the netlog checks (4 of 4), the
  placement checks (7 of 8, the eighth a guard that a netlog without start times keeps its
  summary), the bundle checks (the unit file could not load, and 4 of the 5 script checks failed,
  the fifth a guard that an existing output is kept) and the scenario checks (38 of 38, in a copy
  without the new scenarios).
- **Sabotage.** Each new check failed under at least one of 44 mutations, each in a temporary copy
  outside the repository, after an unchanged copy passed (3 control copies, all passed): 4 of
  the netlog, 8 of the placement, 16 of the bundle tool and 16 of the scenarios.
- **Record checks.** The checks of earlier records that count the committed evidence files leave
  out the four new ones, and the fifteenth-review record checks read the state of that review,
  not R-75 at the latest head.
- **Not covered by a review.** The commits after `db16323` are behaviour-changing, and no review
  covers them, so R-75 is 🟡. As the maintainer decided, no review ran in this batch: one fresh
  independent review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the
  new commits (trailers, tool attribution and `secret-scan.mjs`), the push and the GitHub checks
  are in the PR description.

## Mobile follow-up (s15–s16)

This follow-up ran live sessions on mobile only, for R-64, R-63 and R-54, because the reference had
answered the headless desktop client with a verification page in the observation batch; no desktop
session ran. It is not a review remediation and addresses none of the open review suggestions.

- **Commits.** `cec0444` emulates and asserts a portrait screen orientation, `b21edd4` adds scenario
  24 and `f4a460f` adds the s15 and s16 evidence files; the commit that adds this section adds the
  local check output and the documents. They change research tooling, its tests and documented
  claims; nothing under `apps/` or `packages/` changed.
- **Screen orientation.** Before any session, a local run on the self-authored fixture found that
  the driver's mobile emulation, unchanged since `77ad658` and so the one s7, s11 and s12 used, left
  headless Chromium reporting a `landscape-primary` screen at angle 0 for the 390×844 portrait
  screen [O, local fixture]. From `cec0444`, 09 asks for portrait-primary at angle 0 and every
  mobile metrics assertion checks it. The self-test failed with that check and without the emulation
  change, and passed with both. That the earlier mobile sessions reported landscape-primary is [I]
  ([limitations](limitations.md#environment-limits)).
- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 on
  `b21edd4` at 17:53–17:54 UTC (output in [local-checks/](local-checks/)).
- **Sessions,** on 2026-11-05, each in its own new container, network and tmpfs profile, with the
  isolation probes of the observation batch before the driver attached (5 PASS lines each in the raw
  session log): `s15-mobile-svg-only` (17:56–17:58 UTC: 09, 19) and `s16-mobile-generation-reload`
  (17:58–18:02: 09, 10, 22, 16, 24). A gate in the session helper stopped a session unless its load
  returned HTTP 200 with no verification-page request and every metric asserted; both loads passed
  it [O]. After each load every metrics read gave 390×844 CSS px, DPR 3, a 390×844 portrait-primary
  screen at angle 0, 5 touch points, a coarse pointer and canvases of 1170×2532
  (`evidence/sessions-s15-s16.json`).
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 and an `inspect-web-page` window allowing the 7 HTTP(S) origins of the
  observation batch, armed 4.2 s before 19 in s15 and 4.3 and 4.6 s before 10 and 22 in s16
  (`evidence/rea-windows-s15-s16.json`). Each kept as many requests as the netlog started inside it:
  1, 67 and 18, 2 of them aborted. REA recorded HTTP 403 for those 2, the script chunks of Mermaid
  to Excalidraw, which the gates, reading documents and verification paths only, let pass (found
  on 2026-11-06; see [Blockers and residuals](#blockers-and-residuals)) [O, raw REA record]. The
  window armed before 24 returned no Evidence:
  `inspect_web_page` reported `target_unavailable`, because the reload changed the document
  ([REA findings](rea-findings.md#5-rea-limitations-met)). Its output was moved unchanged to
  `rea-failed/` in the raw tree, where no builder reads it.
- **Export to SVG on mobile (R-64).** In s15, 19 drew one rectangle and clicked Export to SVG once,
  with no Export to PNG before it. Headless Chromium gave no download event (B-32), the export
  dialog's ARIA was the same before and after the click [O, raw ARIA], and the netlog has no
  `worker` event; REA's window listed no worker either, though its worker capture is attach-limited
  [O]. The only request after the load was an analytics beacon whose query keys include `event`,
  started 229 ms after the click step [I, raw netlog and timeline times]. So this export of a scene
  without text started no dedicated worker; whether the desktop worker needs the text that the s1
  and s6 scenes held, or the PNG export before it, is [H]. R-64 stays 🟡.
- **Generation dialogs, second run (R-63).** s16 repeated s12's 09, 10 and 22 in a new fresh
  profile, now with the portrait orientation and REA windows over 10 and 22. The 13 ARIA snapshots
  the two sessions share, the four of 22 among them, are identical byte for byte [O, raw ARIA].
  Opening Mermaid to Excalidraw again wrote 2 aborted script requests and 14 scripts from the
  service worker, Insert again added 21 elements of the same types, sizes, bindings and styles, and
  Wireframe to code again set the tool to `magicframe`
  (`evidence/probes-s16-mobile-generation-reload.json`) [O]. Every inserted element's x is 3.4
  smaller than in s12, with the scroll after scenario 10's pinch at −132 instead of −135, as s7 also
  read [O]. B-38 and B-39 are high for these results; R-63 stays 🟡, because nothing was generated
  and desktop is not observed.
- **Mobile reload (R-54).** In s16, 24 read the stored scene and app state and captured the view,
  reloaded, asserted the metrics, and read and captured again, with no input. The reload's document
  came from the service worker with HTTP 200 [O]. The stored scene (22 elements) and app state (60
  keys: dark theme, zoom 0.875, the same scroll, the selection tool, nothing selected) read the same
  before and after [O]. The two captures show the same view, and their ARIA differs in one line
  only: Undo was enabled before the reload and disabled after it [O, raw ARIA and captures], so the
  undo history did not survive the reload (B-30). Selection across a reload stays unobserved,
  because nothing was selected.
- **Request start times (R-66).** None of the 20 request starts of s15 and the 123 of s16 fell while
  a touch drag (1 and 3) was the latest step to start; the next entry came 4.5 s and 4.3 s or more
  after a drawing step (`evidence/netlog-steps-s15-s16.json`) [I, raw netlog and timeline times].
- **Bounds kept:** no account, no room, no desktop session and no verification page; Export to Link
  was not clicked, nothing was typed and Text to diagram generated nothing; the two netlogs hold 0
  `.map` requests. The page was loaded once in each session and reloaded once in s16.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the two raw
  session trees or in `docs/reverse-engineering`.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order (the driver writes
  the trigger of 19's download before it), with one failed step: the download of 19, which timed out
  in headless Chromium as expected. With the tools at `b21edd4` the 22 earlier evidence files
  regenerate byte for byte, and the 5 new ones regenerate byte for byte in two runs.
- **Tests first.** Before each change its new checks failed: the orientation checks (14 of 15, the
  fifteenth a guard that a step naming no orientation sends none), the scenario 24 checks (7 of 7)
  and the record checks of this section (all 8, 6 new and 2 rewritten, with the `f4a460f`
  documents).
- **Sabotage.** Each new or rewritten check failed under at least one of 43 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (4 control copies, all
  passed): 15 for the orientation checks, 12 for scenario 24's, 2 for the evidence-count exclusion
  and 14 for the record checks. Five record mutations first matched no single-line text, were
  refused by the literal guard and ran again with the exact text.
- **Record checks.** The checks of earlier records that count the committed evidence files leave out
  the five new ones, and the R-64 and network-analysis checks that said no mobile scenario clicks
  Export to SVG now check that s15's one click wrote no worker event.
- **Not covered by a review.** The commits after `2864145` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits (trailers, tool attribution and `secret-scan.mjs`), the push and the GitHub checks are in
  the PR description.

## Mobile priority-1 batch (s17–s21)

This batch ran live sessions on mobile only, for R-34, R-48 and R-54, the priority-1 rows that a
guest can observe on mobile without an account or a human step. No desktop session ran, because the
reference had served the headless desktop client a verification page in the observation batch. It is
not a review remediation and addresses none of the open review suggestions.

- **Commits.** `ddc3e81` adds scenarios 25, 26 and 27 with their checks, `625a520` makes 25 ask for
  the swatch that the Background popover names, and `c8ecac5` adds the s17–s21 evidence files; the
  commit that adds this section adds the local check output and the documents. They change research
  scenarios, their tests and documented claims; nothing under `apps/` or `packages/` changed.
- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 on
  `ddc3e81` at 19:54–19:55 UTC (output in [local-checks/](local-checks/)). `625a520` changes only
  scenario 25, its checks and the research README, not the driver, the browser scripts or the
  self-test.
- **Sessions,** on 2026-11-05, each in its own new container, network and tmpfs profile, with the
  isolation probes of the observation batch before the driver attached (5 PASS lines each in the raw
  session log): `s17-mobile-hit-reload` (19:55–19:58 UTC: 09, 25, 27, 24, 16, at `ddc3e81`),
  `s18-mobile-pinch` (20:01–20:02: 09, 26, 16), `s19-mobile-hit-reload-2` (20:03–20:06),
  `s20-mobile-pinch-2` (20:06–20:08) and `s21-mobile-hit-reload-3` (20:08–20:11), the last four at
  `625a520`, s19 and s21 in s17's order and s20 in s18's. A gate stopped a session unless its load
  returned HTTP 200 with no verification-page request and every metric asserted, and after each of
  25, 26, 27 and 24 unless the netlog still held no verification-page request and no 403 document;
  every load and every reload passed [O]. No metrics assertion failed (7 in each of s17, s19 and
  s21, 3 in each of s18 and s20), and the metrics read after each load gave 390×844 CSS px, DPR 3, a
  390×844 portrait-primary screen at angle 0, 5 touch points, a coarse pointer and canvases of
  1170×2532 (`evidence/sessions-s17-s21.json`).
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09, and an `inspect-web-page` window allowing the 7 HTTP(S) origins of the
  observation batch over each of 25, 27 and 26, armed 1.2–5.3 s before the scenario's first step and
  ending after its last. A window cannot span a reload (s16), so 24 ran outside any window, and REA
  listed the targets again and inspected the reloaded page for 3 s after it. All 11 windows returned
  Evidence and kept 0 requests, 0 WebSocket connections and 0 console events
  (`evidence/rea-windows-s17-s21.json`) [O], and the netlog started and wrote no request inside any
  of them [I, raw netlog and window times].
- **Hit-testing (R-34).** Scenario 25 drew a transparent rectangle [100,110,120,80] and one of the
  same size [100,260,120,80], gave the second the Blue background from the Background popover
  (`#a5d8ff`, solid fill), and tapped each left stroke at its vertical middle at offsets from −24 to
  +24 px and at the centre, each after a deselecting tap, at zoom 1 with the stock 2 px stroke. A
  tap from −4 to +4 px selected the transparent rectangle, and a tap at ±8 px or more, or at the
  centre, did not, in all four of its ladders: s19's, s21's and both of s17's, whose second
  rectangle stayed transparent because the earlier 25 asked for a swatch name that the popover does
  not have [O]. On the filled rectangle (s19, s21) every tap from −4 px inward selected it, the
  centre included, and a tap 8 px or more outside did not [O]. So at zoom 1 a touch tap reaches a
  stroke from between 4 and 8 px away, and only a filled interior is hit throughout
  (`evidence/probes-s19-mobile-hit-reload-2.json`). The emulated touch point has a 1 px contact
  radius, and one zoom, one stroke width and one edge were tested.
- **Pinch ratios, anchor and limits (R-48).** After a small reference rectangle, scenario 26 made 13
  pinches with a still midpoint. In s18 and s20 alike each pinch multiplied the zoom by its
  finger-distance ratio (2, 0.5, 1.5, 1/3, 0.2 and 5) until the zoom reached 0.1 or 30, which held:
  two more pinches of 0.2 left it at 0.1, and a pinch of 5 from 12.5 gave 30 [O]. The reference
  rectangle never moved. Across the pinch axis the point that stayed fixed was the finger midpoint
  within 2.2 px in every pinch that changed the zoom; along it, in the 8 pinches that stayed within
  the limits, it lay 34.5 to 111.5 px from the midpoint toward the second finger, up to 9.3 px apart
  between the sessions for the same pinch
  [I, from the committed scroll, rounded to whole scene units]. At a limit a pinch still moved the
  scroll along its axis, by 180 or 200 px of the view at zoom 0.1 [O]. That the shift comes from the
  order in which CDP delivers the fingers' moves is a hypothesis [H]
  ([limitations](limitations.md#environment-limits)). The pinch of 1.5 in 27 gave the same zoom and
  scroll in s17, s19 and s21 (`evidence/probes-s18-mobile-pinch.json`).
- **Reload with a selection (R-54).** 27 pinched by 1.5 and drew a third rectangle, which stayed
  selected, and 24 then reloaded with no input. In s17, s19 and s21 the stored scene (3 elements),
  the selection (1 element), zoom 1.5 and the scroll read the same before and after the reload, and
  the reload's document came from the service worker [O]; the selected element's id was the same on
  both sides [O, raw timeline]. The two captures show the same view with the selection's handles,
  and their ARIA differs in one line only: Undo, enabled before and disabled after, as in s16
  [O, raw ARIA and captures]. In s19 and s21 the third rectangle took the Blue background picked for
  the second, so a background chosen for a selected element became the default for the next [O].
- **Background popover (R-11).** Its ARIA, the same in s17, s19 and s21, lists 15 colours named with
  their shortcut letter, a shades row and a hex code box [O, raw ARIA].
- **Request start times (R-66).** No request start fell while a touch drag was the latest step to
  start, in any session: 4 drags and 38 starts in each of s17, s19 and s21, 14 drags and 19 starts
  in each of s18 and s20. After the drags of s17, s19 and s21 the next entry came 15.7 s or more
  later, and after those of s18 and s20 the netlog wrote none (`evidence/netlog-steps-s17-s21.json`)
  [I, raw netlog and timeline times].
- **Cross-session replay.** s21 shares 34 probe labels with s19, and 34 of 34 are identical; s17
  shares 34 with s19, and 23 are identical, the other 11 differing only in the background colours
  and in the taps inside the second rectangle. s20 shares 14 labels with s18, and 1 is identical,
  the other 13 differing only in scroll.
- **Bounds kept:** no account, no room, no desktop session and no verification page; nothing was
  typed, exported, published or generated; the five netlogs hold 0 `.map` requests. The page was
  loaded once in each session and reloaded once in each of s17, s19 and s21.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the five raw
  session trees or in `docs/reverse-engineering` and `research/excalidraw`.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order, with one failed
  step, s17's swatch step of the earlier 25. With the tools at `625a520` all 35 committed evidence
  files, the 8 new ones included, regenerate byte for byte, in two runs. The REA summaries of the
  three inspections after a reload stay raw: they hold cache names that the
  [limitations](limitations.md#tooling-limits) list as raw-only.
- **Tests first.** Before each change its new checks failed: the scenario checks (27 of 27, without
  the scenarios), the two rewritten swatch checks (with the earlier 25) and the record checks of
  this section (8 of 8 with the `c8ecac5` documents, as did the rewritten R-54 check of the
  mobile follow-up).
- **Sabotage.** Each new or rewritten check failed under at least one of 50 mutations, each in a
  temporary copy outside the repository, after an unchanged copy passed (3 control copies, all
  passed): 24 for the scenario checks, 2 for the swatch checks and 24 for the record checks. One
  scenario mutation first changed the pinch step instead of the wait after it, passed, and failed
  once it changed the wait; four record mutations first matched no single-line text, were refused by
  the literal guard and ran again with the exact text.
- **Record checks.** The checks of earlier records that count the committed evidence files leave out
  the eight new ones, and the mobile follow-up's check of R-54 now expects the mobile column that
  s17–s21 completed.
- **Not covered by a review.** The commits after `a4990b6` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits (trailers, tool attribution and `secret-scan.mjs`), the push and the GitHub checks are in
  the PR description.

## Mobile touch-control batch (s22–s36)

This batch ran live sessions on mobile only, for the priority-1 rows that a guest can reach by touch
and the compact property bar: R-42, R-36, R-49–R-51, R-10 and R-39, and R-30. No desktop session ran,
because the reference had served the headless desktop client a verification page in the observation
batch. It is not a review remediation and addresses none of the open review suggestions.

- **Commits.** `0f22218` adds scenarios 28 (popover inventory), 29 (arrow binding) and 30 (handles)
  with their checks and an opt-in `--points` flag of `timeline-summary.mjs`; `8ba37c8` adds 31
  (Actions popover), 32 (style controls) and 33 (line taps), written from the names that s22 saved;
  `08faebc` adds 34 and 35 for what s25–s27 left open; the commit that adds this section adds the
  evidence of s22–s36, the local check output and the documents. They change research scenarios, a
  summariser flag, their tests and documented claims; nothing under `apps/` or `packages/` changed.
- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 on
  `0f22218` at 21:24–21:25 UTC (output in [local-checks/](local-checks/)). `8ba37c8` and `08faebc`
  change only scenarios, their checks and the research README, not the driver, the browser scripts
  or the self-test.
- **Sessions,** on 2026-11-05, each in its own new container, network and tmpfs profile, with the
  isolation probes of the observation batch before the driver attached (5 PASS lines each in the raw
  session log), each running 09, one scenario inside a REA window and 16: `s22-mobile-popovers` (28),
  `s23-mobile-arrow-binding` (29) and `s24-mobile-handles` (30) at `0f22218`, 21:25–21:35 UTC;
  `s25-mobile-actions` (31), `s26-mobile-styles` (32) and `s27-mobile-line-taps` (33) at
  `8ba37c8`, 21:35–21:41; and at `08faebc` `s33-mobile-distribute` (34) and `s34-mobile-fill-line`
  (35), then the second runs `s28-mobile-arrow-binding-2` (29), `s29-mobile-handles-2` (30),
  `s30-mobile-actions-2` (31), `s31-mobile-styles-2` (32), `s32-mobile-line-taps-2` (33),
  `s35-mobile-distribute-2` (34) and `s36-mobile-fill-line-2` (35), 21:43–21:58. A gate stopped a
  session unless its load returned HTTP 200 with no verification-page request and every metric
  asserted, and after the scenario unless no step had failed fatally and the netlog still held no
  verification-page request and no 403 document; every load passed [O]. In all 15 sessions no step
  failed and no metrics assertion failed (3 in each), and the metrics read after each load gave
  390×844 CSS px, DPR 3, a portrait-primary screen at angle 0, 5 touch points, a coarse pointer and
  canvases of 1170×2532 (`evidence/sessions-s22-s36.json`).
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a target
  listing after 09, and one `inspect-web-page` window allowing the 7 HTTP(S) origins over each
  scenario, armed 4.7–5.8 s before its first step and ending after its last. All 15 windows returned
  Evidence and kept 0 requests, 0 WebSocket connections and 0 console events
  (`evidence/rea-windows-s22-s36.json`) [O]. Every netlog entry lies in 09's load, none inside a
  window, so no request started while a touch drag was the latest step
  (`evidence/netlog-steps-s22-s36.json`) [O].
- **Inventory (s22).** Scenario 28 saved the popovers of the compact bar: the Stroke colour popover
  (15 colours named with a shortcut letter, shades and a hex box), the style popover (Stroke width,
  Stroke style, Sloppiness and Edges as groups of radios with no accessible name, and an Opacity
  slider; no Edges for an arrow) and the Actions popover (Layers and Actions for one element, Align
  and Group selection for two) [O, raw ARIA]. A tap on the Rectangle tool opened a Rectangle,
  Diamond and Ellipse choice, which the ARIA of s3, s7, s11, s12 and s16 already listed and the
  earlier record had missed (R-24) [O, raw ARIA].
- **Arrow binding (R-42), s23 and s28.** A touch-drawn arrow from P's centre to Q's centre bound both
  ends and kept them at the centres; ends released on R's left stroke or 8 units outside it were bound
  and placed 6 units outside it, an end 16 units inside was bound where released, and ends 16, 24 and
  40 units outside were not bound. The Undo button removed the arrow and both `arrow` entries, Redo
  restored them, and moving Q moved the bound end with it [O] (B-04).
- **Handles (R-36), s24 and s29.** A one-finger drag from 4 units outside the south-east, north-west,
  east or north handle moved that corner or side by exactly the drag with the opposite one fixed, and
  the rotation handle 20 units above the top edge turned a rectangle to angle 1.6; Undo and Redo
  reversed and re-applied the last resize and the rotation [O] (B-16, B-17).
- **Layers, alignment and grouping (R-49–R-51), s25, s30, s33 and s35.** Bring forward, Bring to
  front, Send backward and Send to back reordered the stored elements as named, with Undo and Redo;
  Align left, Align top and Center vertically aligned three rectangles, and Distribute horizontally and
  vertically equalised uneven gaps, each reversed by one Undo; Group selection gave three rectangles
  one group, a tap on a member then selected all three, Undo straight after grouping removed the group
  and Ungroup selection removed it too [O] (B-22–B-24). Undo after a deselecting tap restored the
  selection and changed no element, so selection changes are undo steps on mobile [O] (B-10, B-12).
  In s25 and s30, Distribute horizontally changed nothing because scenario 31's rectangles were
  already evenly spaced, and the Undo after grouping, a deselecting tap and a tap on a member
  restored the empty selection before that tap and kept the group; 34 covered both.
- **Styles (R-10, R-39), s26, s31, s34 and s36.** Each named or touched control changed the selected
  rectangle as intended (stroke widths 1 and 4, dashed and dotted, roughness 0 and 2, sharp edges,
  opacity 50, `#e03131`, `#ffec99`, then the `hachure` and `cross-hatch` fills), and the next rectangle
  inherited all eight values [O] (B-20, B-21). The style radios were touched at the centres measured on
  s22's capture, as they have no accessible name ([limitations](limitations.md#environment-limits)).
- **Lines (R-30), s22, s27, s32, s34 and s36.** A tap with the Arrow or the Line tool made a 2-point
  element 100 units long centred on the tap and ended the tool, so later taps added no point; a drag
  from a selected line's middle added a third point, with or without a double tap first [O] (B-40).
- **Cross-session replay.** Each scenario of 29–35 ran twice, and every probe of each second run is
  identical to the first run: 12, 10, 22, 13, 6, 13 and 7 shared labels for 29–35, none differing
  (`differing` over the committed probes).
- **Bounds kept:** no account, no room, no desktop session and no verification page; nothing was
  typed, exported, published, linked or generated; the page was loaded once per session and never
  reloaded; the 15 netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver stopped,
  nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or container of the
  browser image left. `secret-scan.mjs` found no secret shape in the 15 raw session trees or in the
  committed evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order, with no failed
  step. The 15 new probe summaries are built with `--points`; with the tools of the commit that adds
  this section, every committed evidence file, the 18 new ones included, regenerates byte for byte.
- **Not covered by a review.** The commits after `823dae7` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Mobile control batch (s37–s50)

This batch ran live sessions on mobile only, for the mobile columns that the touch-control batch
left open: the four remaining handles and a two-element resize (R-36), Diamond and Ellipse (R-24),
three alignments (R-51), the Arrow type radios, Edit arrow and the undo of an added point (R-30), a
shade, a hex code, Duplicate and the text and freehand popovers (R-10, R-11), the Mermaid insert's
undo and one Text to diagram generation (R-63), and Export to Link (R-56), which s37 found in the
mobile Save to... dialog. No desktop session ran, because the reference had served the headless
desktop client a verification page in the observation batch. It is not a review remediation and
addresses none of the open review suggestions.

- **Commits.** `de052c8` adds scenario 36 (a second popover inventory) with its checks; `2d3f779`
  makes the scene probe and `timeline-summary.mjs` keep an arrow's elbowed flag, which no earlier
  timeline holds, so every earlier summary is unchanged; `32448e3` adds scenarios 37–40 and
  `24e6c5a` scenarios 41–44, each with their checks; `a7af326` commits the evidence of s37–s50, and
  the commit that adds this section adds the local check output and the documents. Nothing under
  `apps/` or `packages/` changed.
- **Before contacting the site:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 on
  `de052c8` at 22:50–22:51 UTC, and again on `32448e3` at 23:01 UTC, because `2d3f779` changed a
  driver probe (output in [local-checks/](local-checks/)). `24e6c5a` changes only scenarios, their
  checks and the research README.
- **Sessions,** on 2026-11-05, each in its own new container, network and tmpfs profile, with the
  isolation probes of the observation batch before the driver attached (5 PASS lines each in the raw
  session log), each running 09, one scenario inside a REA window and 16 (s49 two scenarios, s50
  only 09): `s37-mobile-inventory-2` (36) at `de052c8`, 22:51–22:53 UTC; at `32448e3`
  `s38-mobile-handles-3` (37), `s39-mobile-shapes-align` (38), `s40-mobile-arrow-types` (39) and
  `s41-mobile-colours` (40), 23:01–23:08, then the second runs `s42-mobile-handles-4`,
  `s43-mobile-shapes-align-2`, `s44-mobile-arrow-types-2` and `s45-mobile-colours-2`, 23:10–23:16;
  and at `24e6c5a` `s46-mobile-text-controls` and `s47-mobile-text-controls-2` (41),
  `s48-mobile-mermaid-undo` (42) and `s49-mobile-mermaid-generate` (42, then 43 in a second window),
  23:18–23:25, and `s50-mobile-export-link` (for 44), 23:25–23:26. The gates of the touch-control
  batch stopped a session unless its load returned HTTP 200 with no verification-page request and
  every metric asserted, and after each scenario unless no step had failed fatally and the netlog
  still held no verification-page request and no 403 document. At s49's load the manifest got HTTP
  403 twice, three minutes before s50's verification page, which these gates did not check (found
  on 2026-11-06; `evidence/sessions-s37-s50.json`) [O]. In s37–s49 every load passed and no
  metrics assertion failed (3 in each, 5 in s49), and the metrics read after each load gave 390×844
  CSS px, DPR 3, a portrait-primary screen at angle 0, 5 touch points, a coarse pointer and canvases
  of 1170×2532 (`evidence/sessions-s37-s50.json`) [O]. The only failed steps were the Close steps
  that 42 (s48, s49) and 43 (s49) run after Insert, which their descriptions allow to fail: Insert
  had already closed the dialog [O].
- **Verification page on mobile (s50).** At 23:26 UTC the load of 09 got its document with HTTP 403
  and the hosting-provider verification page: a challenge script, a WebAssembly file and a challenge
  request under `/.well-known/vercel/`, after which the page navigated to `/` itself and got the app
  with HTTP 200 [O, raw netlog]. The load gate stopped the session at once, before any REA call or
  input, so scenario 44 never ran: no Export to Link upload happened and no link exists. As in the
  observation batch, no further live session ran, and the desktop was not tried.
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 in s37–s49, and one `inspect-web-page` window allowing the 7 HTTP(S)
  origins over each scenario, two in s49, armed 2.9–3.8 s before its first step and ending after its
  last. All 14 windows returned Evidence and kept 0 WebSocket connections and 0 console events, and
  as many requests as the netlog started on the 7 origins inside them: 0 over 36–39, 1 over each run
  of 40 and 41 (the Lilita One font file, fetched when the font picker opened and served by the
  service worker [I, raw netlog and timeline times]), 82 over each run of 42 and 3 over 43
  (`evidence/rea-windows-s37-s50.json`) [O]. Over 43 the netlog started one more request, the
  generation's, on an origin outside the 7. No REA call ran in s50.
- **Inventory (s37).** With Blue picked, the Stroke colour popover held five buttons named Shade,
  the darkest marked as chosen, and the hex box read `1971c2`. While a text was edited, the bar held
  Stroke, a second Stroke, Show font picker and Text align, and for a selected text the same and
  Actions. The Draw tool's bar held Stroke, Background and the second Stroke, with a choice of
  Freedraw (pressed) and Autoshape, and a selected freehand stroke's bar added Actions. Tapping Edit
  arrow removed that button from the bar while it lasted, and the capture shows the ends as circles
  and a dot at the middle. Save to... opened a dialog with Save to file under Save to disk, Export
  to Link under Shareable link, and an Export button under Excalidraw+, closed by its Close button
  without touching any of them [O, raw ARIA and capture].
- **Handles (R-36), s38 and s42.** A one-finger drag from 4 units outside the south-west,
  north-east, west or south handle moved that corner or side by exactly the drag with the opposite
  one fixed; Undo and Redo reversed and re-applied the last resize. A drag of the south-east handle
  of two rectangles selected together, from 6 units outside their joint corner by (100,20), scaled
  both boxes and the gap between them by 1.5 across and 1.2 down about the pair's north-west corner,
  the drag's ratios to the pair's box, and Undo and Redo reversed and re-applied it [O] (B-16).
- **Diamond, ellipse and alignment (R-24, R-51), s39 and s43.** Diamond and Ellipse, picked by name
  from the Rectangle tool's choice, drew a diamond and an ellipse whose boxes equal the drags, and
  the toolbar button then took the picked shape's name. On a rectangle, the diamond and the ellipse,
  Align right, Align bottom and Center horizontally aligned the boxes' right edges, bottom edges and
  centres on the selection's, and one Undo reversed each [O] (B-01, B-23).
- **Arrow types and Edit arrow (R-30), s40 and s44.** The first and third radios of the Arrow type
  popover, touched at the centres measured on s34's capture, made the arrow sharp (no roundness) and
  elbowed (`elbowed` true, no roundness), and the second, checked at first, made it round again
  (roundness type 2), so the radios are sharp, round and elbow, in that order; Undo and Redo
  switched between elbow and sharp, and a selected elbow arrow's bar had no Edit arrow. A drag from
  the arrow's middle added a third point, which Undo removed and Redo restored. With Edit arrow, a
  drag of the end point moved it by the drag and one Undo moved it back; a tap on empty canvas then
  ended the editing and left the arrow selected [O] (B-40).
- **Colours, Duplicate, text and freehand (R-10, R-11), s41, s45, s46 and s47.** The second Shade
  after Blue made the stroke `#a5d8ff`, and `123abc` typed into the hex box with Enter made it
  `#123abc`; each became the default stroke colour [O, raw timelines]. Duplicate in the Actions
  popover added a copy 10 units right and down, which Undo removed and Redo restored. For a selected
  text the second Stroke button held only an Opacity slider, Show font picker listed Excalifont as
  in the scene and Comic Shanns, Lilita One and Nunito as available, and Text align held a Font size
  group of four unnamed radios and a Text align group of three; Nunito widened the text from 40.5 to
  40.9 and changed the stored font family from 5 to 6 [O, raw timelines for the family], which Undo
  reversed and Redo re-applied. For a selected freehand stroke the second Stroke button held Stroke
  width, Pressure and Opacity, and Background the 15 colours and a hex box [O] (B-06, B-18, B-20,
  B-21).
- **Mermaid and Text to diagram (R-63), s48 and s49.** Insert in the Mermaid dialog added 21
  elements, 11 of them selected, and closed the dialog; one Undo left the stored scene empty and
  Redo restored all 21. In s49 one self-authored prompt, submitted with Enter, started one POST to a
  path for streamed text-to-diagram chats on a separate AI origin; the netlog wrote it as aborted
  (`net::ERR_ABORTED`) 2.8 s later, yet the dialog then showed the result with Insert, View as
  Mermaid and Delete message buttons, a box for refining it and a count of the requests left for the
  day [O, raw netlog and ARIA]. That the netlog reports a completed streamed response as aborted is
  a hypothesis [H]. Insert added 20 elements, 12 of them selected, and one Undo removed exactly
  those 20 [O] (B-38, B-39).
- **Request start times (R-66).** No request start fell while a touch drag was the latest step to
  start, in any session; the drags of s37–s45 were followed by no netlog entry, except in s41 and
  s45, 20.2 and 20.5 s later (`evidence/netlog-steps-s37-s50.json`) [I, raw netlog and timeline
  times].
- **Cross-session replay.** Each of scenarios 37–42 ran twice, and every probe that a second run
  shares with the first is identical: 11, 10, 13, 9, 5 and 3 shared labels for 37–42, none differing
  (`differing` over the committed probes). The 28 ARIA snapshots that the pairs share are identical
  byte for byte [O, raw ARIA]; captures of drawn shapes differ.
- **Bounds kept:** no account, no room, no desktop session; one generation request (s49) and no
  upload (s50 stopped at its load); nothing was published, linked or exported; the page was loaded
  once per session and never reloaded by the driver; the 14 netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the 14 raw session
  trees or in the new evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order. s50 ran no
  labelled probe, so it has no probe summary. With the tools of the commit that adds this section,
  every committed evidence file, the 16 new ones included, regenerates byte for byte, in two runs.
- **Tests first.** The two new elbowed-flag checks failed before `2d3f779` changed the probe and the
  summariser; its third check, that a probe without the flag adds no key, guards a claim that
  already held. The scenario checks were written with their scenarios and checked by mutation. The 9
  record checks of this section all failed with the `a7af326` documents, the documents before this
  record; one of them had first passed there, because it read the matrix's Evidence cell instead of
  Limitations, and was corrected before the commit.
- **Sabotage.** 31 mutations, each in a temporary copy outside the repository, after an unchanged
  control copy passed, and each failed the check it targeted: 3 for scenario 36's checks, 6 for
  those of 37–40, 6 for those of 41–44 (a second upload, a second Enter, an unguarded capture, an
  unsaved ARIA read, a link click and a tap before the font's Undo among them), 2 for the elbowed
  flag and 14 for the record checks. No mutation was refused by its literal guard, and none passed.
- **Not covered by a review.** The commits after `7e547de` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Mobile radio and edit batch (s51–s57)

This batch ran live sessions on mobile only, on 2026-11-06, after s50 had met the verification page
on mobile: first one bounded load check, then the one Export to Link upload (R-56), then the unnamed
text and freehand radios (R-10), Delete and Add link (R-11), a fourth point and deleting a point
(R-30), a group's alignment (R-51) and Autoshape and pressure (R-43). No desktop session ran. It is
not a review remediation and addresses none of the open review suggestions.

- **Commits.** `ee71bd3` adds the `touchPath` step, which the netlog placement counts as a drawing
  step only in a session that has one; `0efd71d` makes the scene probe read a link's origin and path
  and a freehand stroke's pressure fields, and `timeline-summary.mjs` keep them and, with `--text`,
  a text's font size, family and alignment. Earlier timelines have none of these fields and none of
  these steps, so every earlier summary is unchanged. `19fbe93` adds scenarios 45–47 and `4457359`
  scenario 48, each with their checks; `91170cb` commits the evidence of s51–s57, and the commit
  that adds this section adds the local check output and the documents. Nothing under `apps/` or
  `packages/` changed.
- **Load check first.** s51 (00:39–00:40 UTC, at `2a6ec57`) loaded 09 once in a fresh profile with
  the current client configuration, as one availability check: HTTP 200, no request under
  `/.well-known/vercel/`, and every metric asserted (390×844 CSS px, DPR 3, a portrait-primary
  screen at angle 0, 5 touch points, a coarse pointer, canvases of 1170×2532); REA listed the target
  and inspected the loaded page for 4 s (`ev_1f1ddf78`), with no input [O]. Had the verification
  page appeared, the batch would have stopped there.
- **Before the scenarios with the new steps:** `isolation-check.sh` passed 11 of 11 and
  `selftest.sh` 19 of 19 on `19fbe93` at 01:01–01:02 UTC, because `ee71bd3` and `0efd71d` changed
  driver input and probes (output in [local-checks/](local-checks/)); s51 and s52 ran at `2a6ec57`,
  whose driver the `32448e3` checks cover.
- **Sessions,** each in its own new container, network and tmpfs profile, with the isolation probes
  before the driver attached (5 PASS lines each in the raw session log) and the load, fatal and
  netlog gates of the control batch: `s51-mobile-load-gate` (09 only), 00:39–00:40 UTC, and
  `s52-mobile-export-link` (44), 00:40–00:41, at `2a6ec57`; `s53-mobile-radios-autoshape` (45),
  01:02–01:05, and `s54-mobile-edits-link` (46, then 47), 01:05–01:08, at `19fbe93`; and at
  `4457359` `s55-mobile-radios-points` (45, then 48), 01:13–01:17, `s56-mobile-edits-link-2` (46,
  47), 01:17–01:20, and `s57-mobile-radios-points-2` (45, 48), 01:20–01:24. Each session after s52
  ran 16 last. Every load got HTTP 200 with no verification-page request and no 403 document, every
  metrics assertion passed (1 in s51, 3 in s52 and s53, 5 in each of s54–s57), and the metrics read
  after each load were those above (`evidence/sessions-s51-s57.json`) [O]. The only failed step was
  the second Close of 44 in s52, which its description allows: the first Close had closed the dialog
  [O].
- **Export to Link (R-56), s52.** Save to... and then Export to Link, tapped once, turned the dialog
  into one headed Shareable link, with a Link textbox holding a URL of the reference origin with a
  `#json=` fragment, a Copy link button and a note that the upload is end-to-end encrypted [O, raw
  ARIA, the value redacted by the driver]. The tap started one analytics beacon, one POST to
  `https://json.excalidraw.com/api/v2/post/` (HTTP 200) and the Firebase SDK chunk from the service
  worker, 0.3, 0.3 and 0.7 s after it [I, raw netlog and timeline times]. The page's URL kept no
  fragment, and the stored scene, the selection and the 6 storage keys with their value lengths were
  the same before and after [O] (B-41). The link value was redacted in the ARIA text before it was
  written, both captures ran with no dialog open, the clipboard was never granted, the URL probe
  keeps key names and lengths only, and REA made no call after the target listing, so no record
  keeps the value.
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 in every session, before any input; the 4 s inspection of s51; and one
  `inspect-web-page` window allowing the 7 HTTP(S) origins over each run of 45–48, armed 1.6–3.3 s
  before its first step and ending after its last. All 10 inspections returned Evidence and kept 0
  requests, 0 WebSocket connections and 0 console events, and the netlog started none inside them
  (`evidence/rea-windows-s51-s57.json`) [O]. REA did not observe the export.
- **Text and freehand radios (R-10), scenario 45 in s53, s55 and s57.** Touched at the centres
  measured on s46's and s41's captures, the Font size radios S, L and XL stored font sizes 16, 28
  and 36 (20 at first), keeping the text's left edge and vertical centre; the Text align radios
  centre and right stored `center` and `right`; a freehand stroke's Stroke width radios bold and
  thin stored 2 and 0.5 (1 at first); and its second Pressure radio changed the stroke options'
  `variability` from `constant` to `variable`. Undo reversed L, centre, bold and the pressure, and
  Redo re-applied L, bold and the pressure [O] (B-05, B-06, B-21).
- **Autoshape (R-43), scenario 45.** Picked by name from the Draw tool's choice, Autoshape made the
  tool `autoshape`, and a closed rough rectangle drawn with one finger through nine points was
  stored as a rectangle `[58,527,244,106]`, the extent of the input; Undo removed it [O] (B-05).
- **Delete and the points (R-11, R-30), scenarios 46 and 48.** Delete in the Actions popover removed
  a rectangle, Undo restored it and Redo removed it again. On a sharp arrow, a drag from its middle
  added a third point, as before (B-40), but a drag from the middle of a segment of the selected
  three-point arrow moved the whole arrow by 60 instead: the plain selection shows no midpoint
  handle, and in Edit arrow a tap on a midpoint and Delete changed nothing (46; s54, s56). Edit
  arrow shows a midpoint handle on each segment: a drag from one added a fourth point, Undo and Redo
  removed and restored it with the editing going on, and a tap on the new point and Delete in the
  Actions popover removed only that point, which Undo restored (48; s55, s57) [O] (B-25, B-40).
- **Group alignment (R-51), scenario 46.** Two rectangles grouped with Group selection and
  box-selected with a wider rectangle moved as one unit: Align left put the group's left edge on the
  wider rectangle's, the members going from x 40 and 200 to 20 and 180, and Align bottom its bottom
  edge, the members going from y 330 and 400 to 440 and 510; one Undo after each restored them [O]
  (B-22, B-23).
- **Add link (R-11), scenario 47 in s54 and s56.** Add link opened a textbox named "Type or paste
  your link here"; the self-authored `https://example.com/planewright-r11`, typed with the keyboard
  and Enter, was stored as a link with that origin and path, and shown with Edit, Link to object and
  Remove buttons. One Undo then removed the linked rectangle itself and Redo restored it without the
  link [O]; that the link edit is not recorded in the history is [H] (B-42). The link was never
  followed, and no request went to its origin.
- **Request start times (R-66).** In s51 and s53–s57 every netlog entry belongs to the load, so no
  request start fell in 45–48, whose 31 touch drags and 3 touch paths include every drawing step of
  the batch but 44's one drag; in s52 only the three export requests followed the load
  (`evidence/netlog-steps-s51-s57.json`) [I, raw netlog and timeline times].
- **Cross-session replay.** Scenario 45 ran three times, and every probe that s55 and s57 share with
  s53 is identical (20 labels each); 48's 12 labels are identical in s55 and s57, and 46's and 47's
  30 in s54 and s56 (`differing` over the committed probes). Every ARIA snapshot that a later run
  shares with an earlier one is identical byte for byte (6, 6, 13 and 11) [O, raw ARIA]; captures of
  drawn shapes differ.
- **Bounds kept:** no account, no room, no desktop session and no generation request; one upload
  (s52), whose link value no record keeps; the self-authored link was never followed; the page was
  loaded once per session and never reloaded by the driver; the 7 netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the 7 raw session
  trees or in the new evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order. s51 ran no
  labelled probe, so it has no probe summary. With the tools of the commit that adds this section,
  every committed evidence file, the 9 new ones included, regenerates byte for byte, in two runs.
- **Tests first.** The 6 new checks of `ee71bd3` and the 4 of `0efd71d` failed with the tools of
  `2a6ec57`; the 3 checks that a session or probe without the new steps or fields adds nothing are
  guards that already held. The scenario checks were written with their scenarios and checked by
  mutation. 8 of the 9 record checks of this section failed with the `91170cb` documents, the
  documents before this record; the ninth, that no committed file keeps a link value, is a guard
  that already held.
- **Sabotage.** Each mutation ran in a temporary copy outside the repository, after an unchanged
  control copy passed, and each failed the check it targeted: 8 for the checks of 45–47, 5 for those
  of 48 and 11 for the record checks of this section, one of which its literal guard first refused
  and which then ran with a literal on one line. None passed.
- **Not covered by a review.** The commits after `2a6ec57` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Keyboard, offline and layout batch (s58–s64)

This batch ran live sessions on mobile only, on 2026-11-06: one bounded load check, then keyboard
accessibility (R-27), an offline start and the reconnection (R-57), the layout across viewports
and a live resize (R-23), and Find on canvas, the language list, the canvas background (R-05) and
the library (R-15). No desktop session ran, and the desktop was not tried. It is not a review
remediation and addresses none of the open review suggestions. A 403 on a script asset in s64
stopped all live contact after s64, so the planned s65 never ran.

- **Commits.** `238beca` adds the `focus`, `connectivity` and `layout` probes, the `offline` and
  `selectOption` steps and the app state's canvas background, with their summary rows; it also
  carried the README notes on 49–55 one commit early, because the script meant to split them out
  failed before writing, and its own tree passes the research tests (70 files, 949 tests).
  `5ec677a` adds scenarios 49–55 and `b133618` scenarios 56–59, each with their checks, and both
  extend the list of scenarios that emulate (52 and 57 resize the loaded page). `9ea1c1c` makes
  `timeline-summary.mjs` keep probe rows only: `selectOption` names its option in a `label`
  field, which s61's first build had read as two probe labels. `9714c1b` commits the evidence of
  s58–s64, and the commit that adds this section adds the local check output and the documents.
  Nothing under `apps/` or `packages/` changed.
- **Load check first.** s58 (02:34–02:35 UTC, at `d81dc03`) loaded 09 once in a fresh profile:
  HTTP 200, no request under `/.well-known/vercel/`, every metric asserted, a REA target listing
  and a 4 s inspection with no input [O].
- **Before the sessions with the new steps:** `isolation-check.sh` passed 11 of 11 and
  `selftest.sh` 19 of 19 plus the check-masks line on `5ec677a` at 02:53 UTC, because `238beca`
  changed the driver (output in [local-checks/](local-checks/)); the later commits changed no
  driver code. A local run of the new steps on a self-authored page in a disposable container,
  contacting no website, read `navigator.onLine` back false and true and refused a value that is
  not a boolean.
- **Sessions,** each in its own new container, network and tmpfs profile, with the isolation
  probes before the driver attached (5 PASS lines each) and the load, fatal and netlog gates of the
  earlier batches: `s58-mobile-load-gate` (09 only); at `5ec677a`, `s59-mobile-keyboard-resize`
  (49, 52), 02:54–02:57, `s60-mobile-offline` (50, 51, 24), 02:58–03:00, and
  `s61-mobile-find-language-library` (53, 54, 55), 03:01–03:04; at `b133618`,
  `s62-mobile-keyboard-resize-2` (49, 56, 52, 57), 03:12–03:17, `s63-mobile-offline-2` (50, 51,
  24), 03:18–03:20, and `s64-mobile-find-library` (53, 54, 58, 59), 03:20–03:24. Each ran 16 last.
  Every load fetched one document with HTTP 200 and no verification-page request, every metrics
  assertion passed (1 in s58, 15 in s59, 6 in s60 and s63, 7 in s61, 29 in s62 and 9 in s64), and
  the only failed steps were the Close after 56’s Space in s62 and the second Close of 58 in s64,
  both allowed by their scenarios: the sidebar had already closed (`evidence/sessions-s58-s64.json`)
  [O].
- **The stop.** In s64, picking Français (54) asked for the `fr-FR` locale chunk; REA saw HTTP 403
  for it, the driver's netlog recorded it as `net::ERR_ABORTED`, the page kept its English labels
  while its document language became `fr-FR`, and the REA windows over 54, 58 and 59 kept 2
  console events each, whose text REA did not capture [O]. The same request had been answered with
  HTTP 200 through the service worker in s61 [O]. The gates checked documents and verification
  paths only, so the session went on to its end; a 403 on an asset is read as the hosting
  provider's protection reaching this client [H], so the batch stopped all live contact after s64
  and s65, which would have replayed 55–59, never ran. 56–59 ran once each.
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 in every session, and again after 50 and 24 in s60 and s63; the 4 s
  inspection of s58 and a 3 s inspection after each online reload of 24; and 15 windows over
  scenarios, armed 2.5–3.6 s before their first step, allowing the 7 HTTP(S) origins. The windows
  over 54 kept its one locale request (200 in s61, 403 in s64), the s64 windows over 54, 58 and 59
  kept 2 console events each, and every other window kept 0 requests, 0 WebSocket connections and
  0 console events (`evidence/rea-windows-s58-s64.json`) [O]. No window spans a reload.
- **Keyboard focus (R-27), 49 in s59 and s62, 56 in s62.** On the first load the focus is on a
  full-viewport container (a `DIV` with tab index 0), and 30 Tab presses and 4 Shift+Tab presses
  never moved the focus from it; it matches `:focus-visible`, but its outline style is `none` and
  it has no box shadow [O]. A clicked Library button holds the focus without a ring; Enter on it
  closed the sidebar and showed a 1 px box-shadow ring, and Space then changed nothing [O]. A click
  on the active Selection tool opened its Selection and Lasso choice, and Tab and Shift+Tab moved
  between those two only, with a 2 px ring [O]. The main menu put the focus on its menu container,
  which 5 Tab presses never left. Help put the focus on the first of its four links, Tab cycled
  through its four links and Close and back, links showing the browser's own outline and Close a
  box shadow. Escape closed the menu and the dialog and left the focus on the body, not on the
  control that opened them [O]. No live region (`aria-live`, `status`, `alert` or `log`) existed
  at any read [O] (B-43).
- **Offline start and reconnection (R-57), 50 and 51 in s60 and s63.** After one online load and a
  drawn rectangle, the service worker controlled the page with an active registration at `/`, and
  the `offline` step read `navigator.onLine` back false [O]. The offline reload got HTTP 200: the
  document, its scripts, stylesheet, fonts, manifest and icons all came from the service worker,
  the analytics beacon and the error-report POST failed with `net::ERR_INTERNET_DISCONNECTED`, and
  the analytics script loaded with 200 without the service worker, most likely from the HTTP cache
  [I]. The app started with the stored rectangle, Undo disabled and no offline indicator in ARIA or
  the captures [O]. `navigator.onLine` read true in the reloaded page, although its requests still
  failed as offline [O]; the emulation's online state does not carry over a reload [I], so the app
  started believing it was online. A second rectangle drawn offline was stored; back online, the
  page made no request in the 6 s that followed, and REA's window over 51 kept none [O]. 24's
  online reload was again served by the service worker, with the beacon sent, and kept both
  rectangles [O] (B-44).
- **Layout by viewport (R-23), 52 in s59 and s62, 57 in s62.** Every resize held its assertions (10
  in each run of 52, 10 in 57) with no reload and 09's user agent. The phone layout (tools at the
  bottom, Library at the top right) showed at 390×844, 480×844, 500, 540 and 580×960 and at 844×390
  and 844×450; the wide one (the Shapes toolbar at the top, Canvas actions with zoom buttons, Undo
  at the bottom left) from 600×960 up and at 844×520 and above, so it switches at a width between
  580 and 600 px and a height between 450 and 520 px [O]. In the wide layout the hints showed at
  heights of 800 px and more and not at 768 or less [O]; the shortcut letters and the trial banner
  showed at 1024×1366, 1280×800, 1280×720, 1366×1024 and 844×520 but not at 1024×768, 1180×820,
  1100×1000 or 844×600, which no single width or height explains [O]. Back at 390×844, every box was
  as before (B-45).
- **Find on canvas (R-05), 53 in s61 and s64.** It opened a sidebar tab with the focus in its
  search box; typing Plan listed both self-authored words and showed 1 / 2 results, Enter twice
  changed neither the selection nor the view, and Escape closed it with the focus on the body [O]
  (B-46).
- **Language and canvas background (R-05), 54 in s61 and s64, 59 in s64.** Français set the document
  language to `fr-FR` and, in s61, the labels to French after one locale request through the
  service worker; English came back with no request [O] (B-47). Canvas background opens a hex box
  of that name; the typed `ffc9c9` was stored as `#ffc9c9`, and Undo and Redo then toggled the
  deselection before them, not the background [O, once] (B-49).
- **Library (R-15), 55 in s61 and s64's 58.** Empty, the mobile sidebar shows a tablist of 4 unnamed
  tabs, Close, an options button, an empty-state note and the off-site Browse libraries link; with
  a selection it shows a search box, Personal Library and an add tile. Tapping that tile added the
  selection and cleared it; after a deselect, tapping the first tile placed a copy of the
  rectangle centred in the viewport, at [165,382,60,80], selected, and the sidebar closed by itself
  [O, once] (B-48). Nothing was exported, imported or browsed.
- **Cross-session replay.** s62's 49 and 52 against s59's: 48 labels, all identical but the first
  two rows of 52, which list a second Selection button because 56 had left its choice open in s62;
  s63 against s60: 8 labels, all identical; s64 against s61: 13 labels, all identical but `54-fr`,
  whose labels stayed English after the 403 (`differing` over the committed probes). Every ARIA
  snapshot a later run shares with an earlier one is identical byte for byte (11 of 12, 7 of 7, 10
  of 11) but for the same two [O, raw ARIA].
- **Bounds kept:** no account, no room, no upload, no generation request, no desktop session; no
  link was followed and nothing was typed but self-authored words and one hex code; the page was
  reloaded only by 50 and 24; the 7 netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver
  stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI process or
  container of the browser image left. `secret-scan.mjs` found no secret shape in the 7 raw session
  trees or in the new evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order. With the tools of
  the commit that adds this section, every committed evidence file, the 9 new ones included,
  regenerates byte for byte, in three runs.
- **Tests first.** With the tools of `d81dc03`, 14 of the 16 new checks of `238beca` failed; the 2
  that no live region text or background key reaches the summary are guards that already held. The
  scenario test files could not load before their scenarios existed, so no check ran; two checks
  caught faults in the first draft. The check of `9ea1c1c` failed before its change. The 10 record
  checks of this section failed with the `9714c1b` documents, the documents before this record. Two
  older checks were rewritten for it: the count of behaviour entries, now 50, and the R-57 check,
  which now expects the mobile observation and A-07's citation of it.
- **Sabotage.** Each mutation ran in a temporary copy outside the repository, after an unchanged
  control copy passed, and each failed the check it targeted: 13 for the probes and steps (one, an
  assignment of `undefined` that the JSON output drops, was equivalent and was rerun in a
  non-equivalent form), 2 for the summary filter, 15 for the scenarios 49–59 and their wording (one
  more, aimed at a step that was not a key press, was rerun on one), and 13 for the record checks of
  this section (three first refused by their literal guard and rerun with a literal on one line, and
  one first aimed at a citation that the row still made elsewhere and rerun with every citation
  removed).
- **Not covered by a review.** The commits after `d81dc03` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Replay batch (s65–s67)

This batch ran live sessions on mobile only, on 2026-11-06 at 05:21–05:33 UTC, about two hours
after s64, to replay 55–59, which had run once when live contact stopped. Its sessions take the
next free names: the s65 planned after s64, in another order, never ran. No desktop session ran,
and the desktop was not tried. It is not a review remediation and addresses none of the open
review suggestions.

- **Commits.** `8183c0c` commits the evidence of s65–s67, `2245cac` records the asset 403s that the
  earlier gates passed (see [Blockers and residuals](#blockers-and-residuals)), and the commit that
  adds this section adds the local check output and the documents. No tooling, scenario or file
  under `apps/` or `packages/` changed; the sessions ran at `61c695a`.
- **A stricter gate.** From s65 the session helper, kept outside the repository, stops on a 403 or
  429 of any request type, on any request under `/.well-known/vercel/`, on any request to the
  reference origin or its subdomains that failed with `net::ERR_ABORTED`, as s64's 403 showed in
  the netlog, and on any REA window that is not ok or holds such a response. A watcher read the
  netlog every 0.5 s, ready to stop the browser at once, and the netlog and the REA window were read
  again after the load and after every scenario. Run over the retained records of s2–s64, the gate
  fails s12, s13, s14, s16, s49, s50 and s64 and passes the other 56 sessions. Before the live load,
  the watcher stopped a real browser on `about:blank`, contacting no website, after a 403 line, an
  aborted line and a half-written 403 line once it was complete, and not after a 200 line.
- **Before the sessions:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 plus the
  check-masks line on `61c695a` at 05:20–05:21 UTC (output in [local-checks/](local-checks/)), and
  the research projects passed (74 files, 1010 tests); the driver had not changed since `5ec677a`.
- **Sessions,** each in its own new container, network and tmpfs profile, with the isolation
  probes before the driver attached (5 PASS lines each): `s65-mobile-keyboard-resize-3` (49, 56, 52,
  57), 05:21–05:27, the chain of s62; `s66-mobile-library-background-2` (53, 58, 59), 05:27–05:30,
  the chain of s64 without 54; and `s67-mobile-library-sidebar-2` (53, 55), 05:31–05:33, the chain
  of s61 without 54. Each ran 16 last. 54 was left out because its locale chunk is the request that
  got HTTP 403 in s64, and every asset 403 found so far was a script chunk loaded on demand or the
  manifest [O]; running it would ask for that chunk again. Every load fetched one document with
  HTTP 200 from the network, with no 403, 429 or failed request and no verification-page request
  at any point, and every metrics assertion passed (29 in s65, 7 in s66 and 5 in s67), with 390×844
  CSS px, DPR 3, a portrait-primary screen at angle 0, 5 touch points and canvases of 1170×2532
  after each load. The only failed steps were the Close after 56’s Space in s65 and the second
  Close of 58 in s66, which their scenarios allow, as in s62 and s64
  (`evidence/sessions-s65-s67.json`) [O].
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 in every session and 9 windows over scenarios, armed 1.6–3.3 s before
  their first step, allowing the 7 HTTP(S) origins. Every window kept 0 requests, 0 WebSocket
  connections and 0 console events, and the netlog placed all 20 entries of each session in 09's
  load and the wait after it (`evidence/rea-windows-s65-s67.json`,
  `evidence/netlog-steps-s65-s67.json`) [O].
- **Replays.** Against the first runs, s65’s 88 labels match s62’s, s66’s 16 match s64’s and s67’s
  11 match s61’s, all identical; s65 differs from s59 in the same two rows of 52 as s62 did, because
  56 leaves the Selection choice open. So 55–59 have each run twice, each time in a new fresh
  profile, and 58 and 59 gave the same rows without 54 before them [O]. Of the ARIA snapshots the
  replays share with their first runs, 41 of 47 are identical byte for byte; the other 6 (one of
  56, three of 58 and two of 55) differ only in a query value of the off-site Browse libraries
  link, which changes per session [O, raw ARIA].
- **Observed again:** Tab and Shift+Tab never moved the focus from the app container on the first
  load, Enter on the clicked Library button closed the sidebar and showed a ring, Tab from
  Selection moved between Selection and Lasso only, and Escape left the focus on the body (B-43);
  the phone and wide layouts switched between the same sizes (B-45); Find listed both words
  (B-46); the add tile cleared the selection, the item was placed at [165,382,60,80] and the
  sidebar closed by itself (B-48); the typed `ffc9c9` was stored as `#ffc9c9`, and Undo and Redo
  left it there again (B-49) [O].
- **Bounds kept:** no account, room, upload or generation request, no desktop session and no
  reload; nothing was typed but 53's two self-authored words and 59's hex code, no link was
  followed and 54 did not run. The 3 netlogs hold 0 `.map` requests.
- **Cleanup,** checked after each session: the container and its network removed, the driver and
  the watcher stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI
  process or container of the browser image left. `secret-scan.mjs` found no secret shape in the 3
  raw session trees or in the new evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order. With the tools of
  the commit that adds this section, every committed evidence file, the 6 new ones included (93
  in all), regenerates byte for byte, in four runs.
- **Tests first.** The 2 checks of `2245cac` failed with the `8183c0c` documents, and the 5 record
  checks of this section with the `2245cac` documents; without the evidence list change of
  `8183c0c`, 6 older record checks fail. Each mutation ran in a temporary copy outside the
  repository, after an unchanged control copy passed, and failed the check it targeted: 8 for the
  checks of `2245cac` and 14 for the record checks of this section (one first refused by its own
  script, whose variable hid the helper's file name, and rerun).
- **Not covered by a review.** The commits after `61c695a` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Library undo, offline and language batch (s68–s70)

This batch ran live sessions on mobile only, on 2026-11-06 at 06:21–06:33 UTC, for the guest-mode
mobile observations still open that need no account and no headed browser: Undo after placing a
library item (R-15), the offline state applied again after a reload (R-57), scenario 09b, which
had never run, and a second run of 54 with its French labels (R-05). No desktop session ran, and
the desktop was not tried. It is not a review remediation and addresses none of the open review
suggestions.

- **Commits.** `56b88ff` makes the `offline` step also send its CDP network conditions to the page
  on the driver's own session, because Playwright skips a value its context already holds;
  `c097333` adds scenarios 60 and 61 with their checks; `b5a8a17` commits the evidence of s68–s70,
  and `de77f20` adds this section, the local check output and the documents. The commit after it
  makes one record check of this section compare the reference host exactly, where CodeQL flagged
  a bare suffix match: a failed request on the reference host or a subdomain fails the check, in a
  temporary copy each, and one on a lookalike host does not. Nothing under `apps/` or `packages/`
  changed.
- **The driver change, checked locally first.** On `about:blank` in a disposable container,
  contacting no website, the driver of `5d2126b` showed what s60 and s63 showed: after a reload,
  `navigator.onLine` read true while the context was still offline, and repeating `offline` with
  the value true stopped the batch at its read-back. With `56b88ff`, `navigator.onLine` stayed
  false across the reload, the repeated step read it back false, and `offline` false read it back
  true [O, local]. A separate DevTools session that attached to the page and detached again left
  `navigator.onLine` true at the next read [O, local], so one REA window spans both 61 and 51, and
  no REA call ends between them.
- **Before the sessions:** `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 plus the
  check-masks line on `c097333` at 06:17–06:18 UTC, because `56b88ff` changed the driver (output in
  [local-checks/](local-checks/)), and the research projects passed (77 files, 1031 tests).
- **Sessions,** each in its own new container, network and tmpfs profile, with the isolation probes
  before the driver attached (5 PASS lines each) and the strict gate of the replay batch: a watcher
  read the netlog every 0.5 s, and the netlog and every REA record were read again after the load,
  every scenario and every REA call. `s68-mobile-library-undo-offline` (09, 60, 09b, 50, 61, 51,
  24, 16) ran at 06:21–06:24, `s69-mobile-library-undo-offline-2`, the same chain, at
  06:27–06:30, and `s70-mobile-language-2` (09, 53, 54, 16) at 06:31–06:33: the chain of s61
  without 55, run last because 54 asks for the locale chunk that got HTTP 403 in s64. Each load
  fetched one document with HTTP 200 from the network, and the three reloads of s68 and of s69
  (09b's, 50's offline one and 24's) got theirs from the service worker. No 403, 429,
  verification-page request or aborted request on the reference origin occurred, every REA record
  was ok, every metrics assertion passed (9 in s68 and s69, 5 in s70), and no step failed
  (`evidence/sessions-s68-s70.json`) [O].
- **REA,** the CLI of build `5b953e13…`, with raw output only in the workspace artifact tree: a
  target listing after 09 in every session and after 09b, 50 and 24 in s68 and s69, a 3 s
  inspection after 09b's and 24's online reloads, and 6 windows over scenarios, armed 3.1–3.6 s
  before their first step and allowing the 7 HTTP(S) origins: over 60 and over 61 with 51 in s68
  and s69, and over 53 and over 54 in s70. No window spans a reload. Every window and inspection
  kept 0 requests, 0 WebSocket connections and 0 console events, but for s70's window over 54,
  which kept its one locale request, with HTTP 200 (`evidence/rea-windows-s68-s70.json`) [O].
- **Undo after the library item (R-15), 60 in s68 and s69.** The add tile put the selected
  rectangle into the library and cleared the selection, as in 58 [O]. Undo, pressed after Close,
  did not take back the add: it removed the rectangle itself, the step before it, so the stored
  scene held no element and Undo was then disabled; Redo restored the rectangle, selected
  (`60-added-undo`, `60-added-redo`), and the library still held its item [O, raw ARIA]. The tile
  then placed the copy at [165,382,60,80], selected, and closed the sidebar, as in 58; Undo
  removed the copy and cleared the selection, and Redo restored it, selected (`60-placed-undo`,
  `60-placed-redo`), with the library's one item there before and after [O, raw ARIA] (B-48).
- **09b and the reloads (R-54), s68 and s69.** 09b, run for the first time, reloaded the page after
  60: its document came from the service worker and every metric held at its assertion, and 50
  then read 60's two rectangles, so the scene survived the reload (`50-online`) [O]. 24's online
  reload kept all four rectangles (`24-after-reload`) [O] (B-30).
- **The offline state across a reload (R-57), 50, 61 and 51 in s68 and s69.** With `56b88ff`,
  `navigator.onLine` read false after 50's offline reload (`50-offline-reloaded`) and before 61's
  step (`61-reloaded`), where s60 and s63 read true [O]; 61's repeated step read it back false, so
  it changed nothing (`61-reapplied`) [O]. 51 then drew offline in a page that read offline, and
  going back online turned it true (`51-online-again`) [O]. The first read came 4.5 s and 5.6 s
  after the reload, so whether the app read offline from its start is not known. The app still
  showed no offline indicator: the 7 ARIA snapshots s68 shares with s63 are identical byte for
  byte, 61's equals 50's after the reload, and the captures show none [O, raw ARIA and captures].
  The offline reload was served as in s63, with the analytics beacon and the error report failing
  offline, and after the connection returned the page made no request in the 6 s that followed,
  nor did the REA window over 61 and 51 keep any [O] (B-44).
- **The French labels (R-05), 54 in s70.** Français set the document language to `fr-FR` and, as in
  s61, the labels to French after one request for the `fr-FR` locale chunk, answered with HTTP 200
  through the service worker; English came back with no request [O] (B-47).
- **Cross-session replay.** s69 against s68: 19 labels, all identical, and of their 14 shared ARIA
  snapshots 11 are identical byte for byte, while the 3 of 60's library sidebar differ only in the
  query value of the off-site Browse libraries link. s70 against s61: 13 labels and 11 ARIA
  snapshots, all identical; against s64, all labels but `54-fr`, which stayed English there after
  the 403. s68's 50, 51 and 24 differ from s60's and s63's in 7 of their 8 shared labels, because
  60's two rectangles were on the canvas and `navigator.onLine` read false after the offline reload
  [O]. So 09b, 60 and 61 have each run twice, each time in a new fresh profile, and 54's French
  labels have loaded twice.
- **Bounds kept:** no account, room, upload or generation request, and no desktop session; nothing
  was typed but 53's two self-authored words, no link was followed, and the page was reloaded only
  by 09b, 50 and 24. The 3 netlogs hold 0 `.map` requests, and none of the 152 request starts of
  s68 and s69 fell in one of their 6 drawing steps (`evidence/netlog-steps-s68-s70.json`).
- **Cleanup,** checked after each session: the container and its network removed, the driver and
  the watcher stopped, nothing listening on 9222 or 9333, the token file deleted, and no REA CLI
  process or container of the browser image left; the local tests were checked the same way.
  `secret-scan.mjs` found no secret shape in the 3 raw session trees or in the new evidence.
- **Integrity:** each timeline holds exactly the steps of its scenarios, in order (140, 140 and 101
  rows). With the tools of the commit that adds this section, every committed evidence file, the
  6 new ones included (99 in all), regenerates byte for byte, in three runs.
- **Tests first.** The 2 new checks of `56b88ff` failed with the step of `5d2126b`, and the 12
  checks of `c097333` could not load before their scenarios existed; without the evidence list
  change of `b5a8a17`, 6 older record checks fail. The 9 record checks of this section failed with
  the `b5a8a17` documents. Three older checks were rewritten for it: the two that said 09b never
  ran now expect its first runs, and the replay record's check no longer expects 54 to stay open.
  Each mutation ran in a temporary copy outside the repository, after an unchanged control copy
  passed, and failed the check it targeted: 5 for the `offline` step, 16 for scenarios 60 and 61,
  and 35 for the record checks of this section and the two rewritten 09b checks.
- **Not covered by a review.** The commits after `5d2126b` are behaviour-changing, and no review
  covers them, so R-75 stays 🟡. As the maintainer decided, no review ran: one fresh independent
  review runs once, at readiness, after every acceptance observation of issue #1.
- `npm run test:e2e` was not run locally: nothing under `apps/` or `packages/` changed. The
  `npm run validate` result for the tree of the commit that adds this section, the bodies of the new
  commits, the push and the GitHub checks are in the PR description.

## Independent reviews

**R-75 exit rule.** R-75 may become ✅ only after a fresh independent review of the latest
behaviour-changing commit reports 0 critical, 0 major and 0 minor findings. Suggestions that do not
block may stay open if they are listed here with their handling. A commit is behaviour-changing when
it changes the research tooling, its tests or a documented research claim, whether or not it
remediates a review; the R-76 commits `935f2fc`..`f1562ed`, from `0b4fb19` to `f1562ed`, were. A
behaviour-changing commit that no listed review covers is named under a **Not covered by a
review.** bullet in this checkpoint, and R-75 stays 🟡 while such a bullet remains. Commits that
only record a review, its checks or the PR description are not, so a review that meets the rule
does not call for another one. Updating the record checks (the documentation checks that read the
review list, R-75 and the review records) so that they accept a new record also counts as
recording. Until then R-75 stays 🟡. Meeting the rule closes R-75 only: issue #1 also needs the
remaining observation work and the maintainer decisions.

**Unreviewed bullet.** The bullet is kept by hand: whoever pushes a behaviour-changing commit
after the latest reviewed head adds it. The record checks test only that the review list, that
bullet, the remediation checks and R-75 agree with one another; they do not read the Git history.
In CI they run only in the `quality` job, which checks out one commit, at the checkout action's
default depth, and fetches nothing more. The jobs that fetch the whole history, `secret-history`
and `conventions` (`fetch-depth: 0`), do not run them, and a squash merge keeps none of the
branch commits on `main`. A check of the bullet against the history could run in `conventions`,
but none does yet, so only a review finds a missing bullet, as the tenth review did.

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
6. **Review of `46b2b01`**: 0 critical, 0 major, 7 minor findings and 7 suggestions. Handled as
   follows; each fix has a test that fails against the `46b2b01` code or wording:
   - **Minors 1–5** (backlog labels, raw-only facts, how the newer controls were verified, what
     the commit messages record, priorities and new row R-76) and **suggestions 4 and 5** (§2
     rated medium, three architecture hypotheses narrowed): `4a43c1a`. A scripting error
     committed these seven corrections and their tests together under a message that names only
     the §2 rating; the commit was kept, because no commit is rewritten.
   - **Minor 6, a `goto` could join a room before the halt:** refused before navigation in
     `c766e9d`; step records are redacted before the raw timeline in `d7e4ea9`. Rooms are still
     created through the UI under `runLast`.
   - **Minor 7, live checks without retained output:** `e59bac5` commits the output of fresh `isolation-check.sh` (11 of 11) and `selftest.sh` (19 of 19) runs on `e38955a`, and the Done notes say that s1–s4 ran on the default bridge.
   - **Suggestions:** surfaces measured again after the capture (s1, `253e4a0`); `browser.sh stop`
     reports UNKNOWN (s2, `6725cda`, after moving a test in `479df72`); the raw-only bound and the
     exact entry count (s3, `e38955a`; the new checks are derived from evidence, but the earlier
     exact-phrase checks remain); wording (s6, `868820e`); the code map (s7, `0d38da1`).
7. **Review of `a78a210`**: 0 critical, 0 major, 3 minor findings and 3 suggestions. Handled as
   follows; each fix in the tree has a test that fails against the `a78a210` code or wording:
   - **Minor 1, handler results unredacted in the raw timeline:** the `selector` and `role`
     handlers echo their step fields in the result, which the runner wrote as returned; the
     result is now redacted like the step record (`b72d28d`).
   - **Minor 2, PR description overstatements:** it no longer claims a commit for every review
     finding (reviews 1–3 are summarised here without per-finding commits), and it says that
     only the behaviour criteria of backlog items 19–22 are open. The description is outside the
     tree, so no test covers it.
   - **Minor 3, stale check provenance in this checkpoint:** the regeneration note, the review
     count of the `limitations.md` note and the name of a passing sixth-review check
     (`db24b1f`).
   - **Suggestion 1, key-name redaction untested:** `4f25d13`.
   - **Suggestions 2 and 3** are not addressed in this remediation: the seven corrections of
     `4a43c1a` are to be listed in the squash-merge body by whoever merges, and the earlier
     exact-phrase documentation checks remain; the new checks derive what they can from the
     review list and the test sources.
8. **Review of `8029c1e`**: 0 critical, 0 major, 1 minor finding and 4 suggestions. It does not
   meet the R-75 exit rule, because it reports one minor finding. Handled as follows; the reply
   fix has a test that fails against the `8029c1e` code, and every new test or check failed under
   a sabotage in a temporary copy:
   - **Minor 1, handler results unredacted in the HTTP reply:** since `b72d28d` the result was
     redacted in the raw timeline only. The reply, and so what `run.mjs` prints, still carried it
     as the handler returned it, and the PR description said that the handlers already redacted
     those reads. The reply now carries the redacted result of the timeline row (`ff04c79`); the
     PR description is corrected outside the tree.
   - **Suggestion 1, nested result values untested:** `0e847d2`.
   - **Suggestion 2, two wording nits in the PR description** (which findings are mapped to a
     commit, and what the first bullet of backlog items 19–22 records): corrected in the
     description, outside the tree, so no commit or test covers it.
   - **Suggestion 3, record checks that assumed the last entry:** the review list is read by head,
     and the counts and ordinals come from the list (`8620915`). The earlier exact-phrase checks
     remain (Suggestion 3 of the review of `a78a210`).
   - **Suggestion 4, no exit rule for R-75:** the rule above (`080e238`).
   - Suggestion 2 of the review of `a78a210` stays open: the seven corrections of `4a43c1a` are
     to be listed in the squash-merge body by whoever merges.
9. **Review of `a85eb82`**: 0 critical, 0 major, 0 minor findings and 10 suggestions. It met the
   R-75 exit rule as the rule then stood: it covered `a85eb82`, where the eighth-review
   remediation ends, and the commits after it only recorded this review, updated the record
   checks and said in the rule that doing so counts as recording. R-75 was ✅ until the R-76
   commits after `935f2fc`, which are behaviour-changing; the review of `f1562ed` found that the
   rule did not cover them, and R-75 is 🟡 again. Handled as follows:
   - **Suggestion 1, record checks that never let R-75 become ✅:** the exit rule says that
     updating the record checks counts as recording (`407b28c`). The checks of R-75, the review
     note, the blocker and the review row take their wording from the latest review: R-75 is ✅
     only if that review reports no critical, major or minor finding, the checks of the
     remediation before it say that this remediation ends at its head, and no remediation of its
     own is recorded (`306c35c`).
   - **Suggestions 2–10 are not addressed in this record.** None of them is a critical, major or
     minor finding, so they stay open as listed here:
     - **Suggestion 2,** a failed step's `do` value comes back unredacted in the HTTP reply. It is
       the client's own input, and the documents claim redaction for handler results only.
     - **Suggestion 3,** when an escape's hex digits are themselves encoded, `redactSecrets`
       leaves the text as it is, although detection flags it; the research README's "however it
       is encoded" says more than the code does.
     - **Suggestion 4,** a step nested deeply enough to overflow the stack while its redacted copy
       is built gets no timeline row. It does not run, but the research README says that every
       step is appended.
     - **Suggestion 5,** `selftest.sh` does not stop its driver if it aborts.
     - **Suggestion 6,** the DevTools isolation claim of `browser.sh` and the research README does
       not hold for a `--network host` container, which shares the host's loopback.
     - **Suggestion 7,** the screenshot room check is triggered by the URL only, so a view that
       shows a generated link would not be covered; this is not documented yet.
     - **Suggestion 8,** wording: the eighth-review checks say "stub handlers" where the test uses
       the real `selector` and `role` handlers, the regeneration note does not list the review of
       `8029c1e`, and the research README does not say that s5 ran an earlier version of scenario
       01 or mention its final `metrics` read.
     - **Suggestion 9,** hardening: the cost of `decodeAscii` on long `%25` chains, the token
       written before the driver listens, the default umask of raw output files, symlinks and
       files over 200 MB skipped by `secret-scan.mjs`, storage names copied unredacted by
       `rea-extract.mjs`, and short body excerpts in JSON parse errors.
     - **Suggestion 10,** Suggestions 2 and 3 of the review of `a78a210` stay open (see that
       entry).
   - A remediation of any of them would change the tooling, its tests or a documented research
     claim, so it would be behaviour-changing, and R-75 would need a fresh review under the rule.
10. **Review of `f1562ed`**: 0 critical, 0 major, 4 minor findings and 5 suggestions. It does not
    meet the R-75 exit rule, because it reports four minor findings. It reviewed the R-76 commits
    `935f2fc`..`f1562ed` read-only, in a separate Claude Code session
    (`c599db1b-0236-4cb5-b0d9-b74e60fdffaf`, Claude Opus 5.5 at xhigh effort), without reading
    earlier review outputs. It is an automated Claude Code review, not human approval. It ran
    `npm run validate` on `f1562ed` (36 test files and 507 tests, with the coverage recorded in
    the R-76 checks), the research tests on each of the 10 commits (431 to 455 tests), a byte for
    byte regeneration of every committed evidence file from the retained records, and
    secret-shape scans of the raw s8–s11 trees, the documents, the diff, the commit bodies, the
    PR description and the branch history (0 shapes, 0 token files). It found PR #2 a Draft
    with all 8 checks passed on `f1562ed`, 0 open code-scanning and secret-scanning alerts, and
    no leftover container, network, listener, token file or process. Of its 12 sabotage
    mutations, 5 failed a test and 7 did not (Suggestion 1). It did not run `test:e2e` or
    `audit:deps` locally, ran no live session and called no REA tool. Handled as follows; each
    fix has a check that failed under a sabotage in a temporary copy outside the repository:
    - **Minor 1, stale page-load count:** the methodology row said 17; it says 21, and the loads
      check reads it (`38b973e`).
    - **Minor 2, R-25 overstated the identical captures:** 3 of the 5 dark dialog captures are
      byte-identical, not 5 (`42c0664`). The PR description said the same; it is corrected
      outside the tree.
    - **Minor 3, the confidence rule applied two ways:** B-06's dark text box is medium, and the
      methodology says that results matching only once a setup difference is allowed for count
      as different (`19bfa5d`).
    - **Minor 4, Done over unreviewed changes:** the exit rule above applies to every
      behaviour-changing commit, a **Not covered by a review.** bullet keeps R-75 🟡, and this
      record sets R-75 and the review-session requirement back to open.
    - **Suggestion 1, unguarded claims:** checks for R-25 (`42c0664`), for B-06 (`19bfa5d`), and
      for the s11 service-worker split and fetch path, the Cascadia and beacon session lists, the
      s11 script list and the Clear canvas rating (`52523e0`).
    - **Suggestion 2, `rea-extract` ignored the `ok` flag:** a failed REA CLI envelope is refused
      with a message, and nothing is written (`8bfdfe3`).
    - **Suggestion 3, the s11 timing:** placed in its scenarios as an inference from the raw
      times, narrowing R-64 and R-66 (`f0eac4f`). The raw records refine the review's summary:
      the first request of 04:54:12.0–19.7 is the Cascadia font, and the 64 page-origin
      requests were written from 04:54:13.3.
    - **Suggestion 4, the scroll wording:** s10's box minus (90,45) equals s6's box (`19bfa5d`).
    - **Suggestion 5, the build change cited from REA alone:** cited from the netlog (`5eb8852`).
    - Suggestions 2–10 of the review of `a85eb82` stay open as listed there; this remediation
      addresses none of them.
    - **Covered by the review of `79fc538`.** The tenth-review remediation, `f1562ed`..`79fc538`,
      from `8bfdfe3` to `79fc538`, is behaviour-changing. The review of `79fc538` covers it and
      reports one minor finding, so it does not meet the exit rule; the remediation of that
      finding is recorded with that review.
11. **Review of `79fc538`**: 0 critical, 0 major, 1 minor finding and 6 suggestions. It does not
    meet the R-75 exit rule, because it reports one minor finding. It reviewed the tenth-review
    remediation `f1562ed`..`79fc538` read-only, in a separate Claude Code session
    (`804f5e47-57d1-4f43-9fd6-659a650da081`, Claude Opus 5.5 at xhigh effort), without reading
    earlier review outputs. It is an automated Claude Code review, not human approval. Its
    verification was limited by its permissions: it ran non-interactively without an allowlist, so
    every `node`, `npm` and `npx` run, every `gh` call, `git ls-remote` and every read of the raw
    evidence tree were refused. It therefore ran no validation, tests, secret-shape scan,
    regeneration, sabotage or live check, and did not see the live PR, its checks or the alerts; it
    checked the committed evidence with `git`, `jq` and `grep` only, and every count it checked
    there held. Handled as follows; each fix has a check that failed under a sabotage in a
    temporary copy outside the repository:
    - **Minor 1, one placement under two labels:** placing a netlog request in a scenario is
      labelled [I, raw netlog and timeline times] wherever it appears, as the methodology now
      defines it (`d61898e`).
    - **Suggestion 1, two notations for one range:** the checkpoint states Git's notation and uses
      it for every range (`bdaa4a4`).
    - **Suggestion 2, a room-shaped error code could be named:** only codes shaped like REA's own,
      and never one of a room id's or key's length, are named (`5574b04`).
    - **Suggestion 3, no end-to-end test of `rea-windows.mjs`:** an integration test, and the
      message names the file (`a64611a`). Stopping on an envelope that reports `ok: true` without an
      Evidence record is kept: every retained CLI output holds one, and such a file could be a
      lost window.
    - **Suggestion 4, `lib/windows.mjs` outside coverage:** included, with tests that bring it to
      100% (`c30387d`).
    - **Suggestion 5, a bullet kept by hand:** a maintainer note under the exit rule, not a check
      against the Git history, which the CI test job does not have (`28db3b4`).
    - **Suggestion 6, R-64's mobile column:** partial, because the service worker served requests
      in every mobile session; no mobile session ran a dedicated worker (`328c7fb`).
    - Suggestions 2–10 of the review of `a85eb82` stay open as listed there; this remediation
      addresses none of them.
    - **Commit message warning.** commitlint reported `footer-leading-blank` (a warning, 0
      problems) on `bdaa4a4`, whose body has a wrapped line that starts like a footer token; the
      commit is kept.
    - **Covered by the review of `4e9c663`.** The eleventh-review remediation, `79fc538`..`4e9c663`,
      from `d61898e` to `4e9c663`, is behaviour-changing. The review of `4e9c663` covers it and
      reports two minor findings, so it does not meet the exit rule; the remediation of those
      findings is recorded with that review.
12. **Review of `4e9c663`**: 0 critical, 0 major, 2 minor findings and 4 suggestions. It does not
    meet the R-75 exit rule, because it reports two minor findings. It reviewed the eleventh-review
    remediation `79fc538`..`4e9c663` read-only, in a separate Claude Code session
    (`fe7943b0-b556-4c72-83ea-957c83cda547`, Claude Opus 5.5 at xhigh effort), without reading
    earlier review outputs. It is an automated Claude Code review, not human approval. It used the
    pinned toolchain, the GitHub API and sabotage copies only through allowlisting wrappers. It ran
    `npm run validate` on `4e9c663` (42 test files and 548 tests), `npm run test:e2e` (1 of 1) and
    the research projects (34 files and 496 tests); regenerated all 17 committed evidence files,
    comparing 7 byte for byte and the 10 that a builder prints to stdout by a canonical `jq -c`
    digest, because writing them to a file was refused; read the raw REA files and timelines by
    shape only; counted every commit range with `git rev-list --count`; ran `secret-scan.mjs` on
    the range, the local history and the research trees (0 shapes); and ran 29 mutations, 2 probes
    and 1 control, each in its own copy. It found PR #2 a Draft with all 8 checks passed on
    `4e9c663` and 0 code-scanning and secret-scanning alerts. It did not run `audit:deps`,
    `isolation-check.sh` or `selftest.sh`, ran no live session and called no REA tool. Handled as
    follows; each fix but the rewrap of Suggestion 4 has a check that failed under a sabotage in a
    temporary copy outside the repository:
    - **Minor 1, a zero count for a missing timeline:** an `observe_web_session` record without a
      timeline list reported `timeline_events` as `{}` and `timeline_events_without_timestamp` as
      0, which the rule of `c30387d` forbids and its test pinned. Both are now null, an empty list
      still counts as zero, and `rea-windows.json` is unchanged (`2b5ff0e`).
    - **Minor 2, a malformed raw file printed whole:** `rea-windows.mjs` and `rea-extract.mjs`
      parsed a REA file outside the boundary that names it, so a file that is not valid JSON died
      with an uncaught parse error that named no file and printed the offending line. Both now
      name the file, say that it is not valid JSON and quote nothing, and `rea-windows.mjs` names a
      bad timeline line by its number (`495e95e`).
    - **Suggestion 1, the 64-character cap untested:** a 64-character identifier is named and
      65-character ones are not (`ffd18a8`).
    - **Suggestion 2, a narrow CI-history guard:** the note under the exit rule names the job that
      runs the record checks and the jobs that fetch the history, and the check derives both from
      the workflow, so an unshallow step or a full-depth checkout in the quality job fails it
      (`32c4647`).
    - **Suggestion 3, an inaccurate test title:** the test counts the driver's own
      `{ invalid: <type> }` rows, taken from the real runner, under null (`27e702b`).
    - **Suggestion 4, two prose lines past 100 columns:** rewrapped (`1d21d38`). No check was
      added: Prettier keeps prose line breaks as written, and other research documents still have
      prose lines over 100 columns.
    - Suggestions 2–10 of the review of `a85eb82` stay open as listed there; this remediation
      addresses none of them. The parse errors of its Suggestion 9 are those of the driver's
      request bodies, not those of the raw files of Minor 2.
    - **Covered by the review of `6d5d264`.** The twelfth-review remediation, `4e9c663`..`6d5d264`,
      from `2b5ff0e` to `6d5d264`, is behaviour-changing. The review of `6d5d264` covers it and
      reports no critical, major or minor finding, so it meets the exit rule; its four suggestions
      are listed with that review.
13. **Review of `6d5d264`**: 0 critical, 0 major, 0 minor findings and 4 suggestions. It meets the
    R-75 exit rule: it covers `6d5d264`, where the twelfth-review remediation ends, and the commits
    after it up to `c010f7e` only record this review. The netlog placement after `c010f7e` is
    behaviour-changing and not covered by it (see [Netlog placement](#netlog-placement-r-64-r-66)). It reviewed the twelfth-review remediation
    `4e9c663`..`6d5d264` read-only, in a separate Claude Code session
    (`d11b620a-52a1-46b1-a58a-d11543ca9b4a`, Claude Opus 5.5 at xhigh effort), without reading
    earlier review outputs or earlier PR descriptions. It is an automated Claude Code review, not
    human approval. It used the pinned toolchain, the GitHub API and sabotage copies only through
    allowlisting wrappers. It ran `npm run validate` on `6d5d264` (44 test files and 562 tests;
    coverage 98.32% statements, 96.03% branches, 97.25% functions and 98.88% lines, with
    `lib/windows.mjs` fully covered), `npm run test:e2e` (1 of 1), the research projects (36 files
    and 510 tests) and `audit:deps` (0 vulnerabilities; all 388 packages have verified
    signatures). It regenerated the 17 committed evidence files in its scratch directory. It
    compared 7 of them byte for byte after Prettier: `sessions.json`, `rea-windows.json` and the
    five initial-inspection summaries. It compared the other 10, the nine probe summaries and
    `static-api-surface.json`, which a builder prints to stdout, by a canonical `jq -c` digest,
    because a redirect to a file and Prettier on stdin were refused. For those 10 it argued from
    their layout that Prettier would give the same bytes (the committed files have no inline
    non-empty object and no blank line, and the builders that print them indent by one space); it
    ran no literal comparison of them. It read the raw evidence by shape only: all 33 REA files
    and all 1,815 timeline lines parse, and the 3 observation records hold timeline lists of 0, 12
    and 1 events, each event with a `timestamp` key. Of its 28 sabotage runs, made after an
    unchanged control passed, 26 failed a test and every new or rewritten check failed under at
    least one; the 2 that passed are deliberate probes of a gap (Suggestion 1). It found that
    commitlint reports 0 problems and 0 warnings on all 8 commits, which carry no trailer and no AI
    attribution, and that `secret-scan.mjs` finds 0 secret shapes in the range patches and
    messages, the local history and the 132 research and documentation files, and 0 driver token
    files. It found PR #2 a Draft with all 8 check runs succeeded on `6d5d264`, 0 code-scanning and
    0 secret-scanning alerts, and issue #1 open. It did not run `isolation-check.sh` or
    `selftest.sh`, because nothing they depend on changed in the range; ran no live session,
    `driver.mjs` or `run.mjs`; called no REA tool; and read the branch head through the GitHub API,
    because `git ls-remote` needed approval. It did not verify the twelfth review's session ID and
    model, which would have meant reading earlier transcripts. Handled as follows:
    - **Suggestions 1–4 are not addressed in this record.** None of them is a critical, major or
      minor finding, so they stay open as listed here:
      - **Suggestion 1, an incomplete CI-history guard:** the detectors in
        `documentation-twelfth-review.test.mjs` say that every form counts, yet adding
        `node --run test` to `conventions`, or `git remote update` to `quality`, passes every test
        while it would make the note under the exit rule false. The note is accurate at `6d5d264`.
        The review suggests failing closed on a fixed list of steps, or narrowing the wording to
        the forms that are checked.
      - **Suggestion 2, a missing driver timeline counted as zero steps:** `rea-windows.mjs` reads
        an absent `timeline.jsonl` as an empty list, so `driverOverlap` in `lib/windows.mjs`
        reports `steps: 0` rather than unknown, the mix-up of missing and zero that Minor 1 of the
        review of `4e9c663` fixed for observation timelines. It predates the range and changes no
        committed file, because all 11 sessions have a timeline.
      - **Suggestion 3, research README wording:** "a timeline line that is not by
        `rea-windows.mjs`" reads as if the line were not written by the script.
      - **Suggestion 4, integration fixtures that miss a copied parse message:** with the parse
        message copied into the error, only the unit test fails, because V8 quotes about 10
        characters around the fault and the synthetic room value of the integration fixtures sits
        further away.
    - Suggestions 2–10 of the review of `a85eb82` stay open as listed there.
    - A remediation of any of these suggestions would change the tooling, its tests or a
      documented research claim, so it would be behaviour-changing, and R-75 would need a fresh
      review under the rule.
    - **Covered by the review of `620eccf`.** The netlog placement, `c010f7e`..`620eccf`, from
      `6051fd5` to `620eccf`, is behaviour-changing. The review of `620eccf` covers it and reports
      one minor finding, so it does not meet the exit rule; the remediation of that finding is
      recorded with that review.
14. **Review of `620eccf`**: 0 critical, 0 major, 1 minor finding and 6 suggestions. It does not
    meet the R-75 exit rule, because it reports one minor finding. It reviewed the netlog placement
    `c010f7e`..`620eccf` read-only, in a separate Claude Code session
    (`2f956c5d-bae6-4453-8b08-92733f1f3472`, Claude Opus 5.5 at xhigh effort), under a brief not to
    read earlier review outputs, transcripts, the writer's scratch directories or earlier PR
    descriptions. It is an automated Claude Code review, not human approval. It used the pinned
    toolchain, the GitHub API and sabotage copies only through allowlisting wrappers. It ran
    `npm run validate` on `620eccf` (51 test files and 610 tests; coverage 98.46% statements, 96.45%
    branches, 97.59% functions and 98.97% lines, with `lib/placement.mjs` at 100%), the research
    projects (43 files and 558 tests), `npm run test:e2e` (1 of 1; a first attempt, started outside
    the repository, found no `package.json`) and `audit:deps` (0 vulnerabilities; 388 packages with
    verified signatures). It regenerated the 18 committed evidence files in its scratch directory
    and found all 18 identical byte for byte after Prettier, with no missing or extra file. It
    recomputed the placement claims from the raw s1–s11 records with `jq`, not with the repository's
    code: 1,815 timeline rows and 523 netlog entries, which confirms the error in the body of
    `545b97b`, the drawing steps of each session, no entry written during any drawing step, the gaps
    to the next entry, the R-64 offsets and the 15.0 s between the two export clicks, and the 13
    beacons with 24 query keys, 42–599 ms after the input each follows. Of its sabotage runs, made
    after an unchanged control passed, 42 failed a check, 9 passed (its Suggestions 1–4) and 1 was
    invalid, because restoring `vitest.config.ts` replaced the copy's own configuration.
    `secret-scan.mjs` found 0 matches in 158 files, commitlint reported no problem on
    `c010f7e`..`620eccf`, and the 8 commit bodies carry no trailer and no AI attribution. It found
    PR #2 a Draft with all 8 check runs succeeded on `620eccf`, 0 open code-scanning alerts (the 5
    on the merge ref of the PR were fixed on 2026-11-04), 0 secret-scanning alerts, no tag or
    release, and issue #1 open. It did not run `isolation-check.sh` or `selftest.sh`, because the
    driver, the browser scripts and the self-test are unchanged since `0b4fb19` and import neither
    `lib/placement.mjs` nor `lib/windows.mjs`; ran no live session, `driver.mjs` or `run.mjs`;
    called no REA tool; and ran `test:unit` and `test:integration` only inside the coverage run of
    `validate`. Its permissions refused 11 of its commands, `git ls-remote` among them. It could not
    verify the mutation tallies that the commit bodies give. Handled as follows; each fix has a
    check that failed under a sabotage in a temporary copy outside the repository:
    - **Minor 1, a start time left in the checkpoint:** the record of the tenth review gave the 64
      page-origin requests of s11 a start time read from the netlog; it now says that the netlog
      wrote them from 04:54:13.3, and the guard against start-time wording reads every research
      document and covers the word from as well (`134b173`).
    - **Suggestion 1, the drawing gap read as a finish time:** the network analysis says that the
      netlog wrote any request that a drawing step started no sooner than the next entry, or never
      wrote it, and that a write time, which comes after the request finished or failed and its
      response was awaited, is not when it finished or failed either; the check reads that passage
      with the derived gaps (`5c6a886`).
    - **Suggestion 2, three claims not derived from the summary:** the beacon split by session, the
      four desktop inputs of s1 and s6 and the absence of socket closes are derived from the
      committed placement, and the header of the checks names the inputs that stay raw-only
      (`329bc50`). The body of `e44ba19` says that its checks derive every count, gap and time,
      which these three show was not so (see [Netlog placement](#netlog-placement-r-64-r-66)).
    - **Suggestion 3, record checks:** the record of the netlog placement must disclose the error in
      the body of `3a1d1a3`, and the thirteenth review's own state and the Partial testing
      requirements are compared exactly, through `reviewState`, which reads any listed review
      (`bdc8140`).
    - **Suggestion 4, ties in the step order:** when steps started in the same millisecond, a step
      with a trigger comes before the rows its trigger ran, rebuilt from the recorded trigger, and
      the research README states the rule; a boundary test counts an entry written in the
      millisecond a drawing step started as written during it (`7bceb59`). The regenerated placement
      moves the s6 beacon after Ctrl+S from the download step to the key step, and no claim changes
      (`46f447a`).
    - **Suggestion 5, labels and wording:** N-H6 carries the full placement label, R-64 attaches [H]
      to the trigger hypothesis, and the limitations name the netlogs of the sessions that drew, all
      but s4 and s5 (`2f0cd20`).
    - **Suggestion 6, lenient time parsing:** only the canonical form that the driver writes is
      read, and a time that does not read back as the same string is refused and never quoted
      (`0b77988`); the research README names that form (`f6a9ffe`).
    - **Recording.** `93e4ae2` adds the words for a fourteenth review, and `50b2632` reads the
      netlog placement as the work this review covers; the review named both as needed before its
      record.
    - The 4 suggestions of the review of `6d5d264` and suggestions 2–10 of the review of `a85eb82`
      stay open as listed there; this remediation addresses none of them.
    - **Covered by the review of `a9a4619`.** The fourteenth-review remediation,
      `620eccf`..`a9a4619`, from `93e4ae2` to `a9a4619`, is behaviour-changing. The review of
      `a9a4619` covers it and reports no critical, major or minor finding, so it meets the exit
      rule; its three suggestions are listed with that review.
15. **Review of `a9a4619`**: 0 critical, 0 major, 0 minor findings and 3 suggestions. It meets the
    R-75 exit rule: it covers `a9a4619`, where the fourteenth-review remediation ends, and the
    commits after it only record this review. It reviewed the fourteenth-review remediation
    `620eccf`..`a9a4619` read-only, in a separate Claude Code session
    (`eb7ff974-8d46-4d36-b89d-ee74befdca5e`, Claude Opus 5.5 at xhigh effort), under a brief not to
    read earlier review outputs, transcripts, the writer's scratch directories or earlier PR
    descriptions. It is an automated Claude Code review, not human approval. It used the pinned
    toolchain, the GitHub API and sabotage copies only through allowlisting wrappers. It found each
    of the 7 findings of the review of `620eccf` fixed, none overstating its evidence or adding a
    regression, and all 12 commits of the range safe to keep on the Draft PR. It ran
    `npm run validate` on `a9a4619` (52 test files and 633 tests; coverage 98.5% statements, 96.51%
    branches, 97.67% functions and 99% lines, with `lib/placement.mjs` at 100%), the research
    projects (44 files and 581 tests), `npm run test:e2e` (1 of 1) and `audit:deps` (0
    vulnerabilities; 388 packages with verified signatures). It regenerated the 18 committed
    evidence files in its scratch directory and found all 18 identical byte for byte after Prettier,
    with no missing or extra file. It recomputed from the raw s1–s11 records with `jq`, not with the
    repository's code: 1,815 timeline rows and 523 netlog entries, all times in the canonical form;
    the s6 download step and the key step that its trigger ran, which started in the same
    millisecond, the only tie among the 4 trigger rows, all in s6; the 13 beacons with 24 query
    keys, 4 in s1, 1 in s3, 4 in s6, 2 in s7 and 2 in s11, each 42–599 ms after its input; no
    `websocket-close` event in any of the 11 netlogs; and the 15.0 s between the two export clicks
    in s1 and s6. Of its 36 sabotage mutations, made after an unchanged control passed, 35 failed a
    check; the one that passed is Suggestion 2, and two further probes confirmed Suggestions 1
    and 3. It reproduced three tallies of the remediation record (the trigger-order and time checks
    fail 5 with the previous library, the label checks fail 2 with the `46f447a` documents, and the
    record checks fail 11 with the `f6a9ffe` documents, 8 new and 3 rewritten), but could not verify
    the totals of 69 mutations, 12 control copies and 18 record mutations. `secret-scan.mjs` found 0
    matches in 209 files under `docs`, `research`, `scripts`, `apps`, `packages` and `.github` and
    in its 54 scratch files, commitlint reported no problem on `620eccf`..`a9a4619`, and the 12
    commit bodies carry no trailer and no AI attribution. It found PR #2 a Draft with head
    `a9a4619`, matching the remote branch, all 8 check runs succeeded on `a9a4619`, 0 open
    code-scanning alerts (the 5 on the merge ref of the PR fixed), 0 secret-scanning alerts, no tag
    or release, and issue #1 open. It found that PR #2 should not leave Draft yet; after this
    record, that is a maintainer decision, because the PR says that it is not ready to merge and the
    baseline is partial. It found that issue #1 cannot close: six acceptance criteria and two
    testing requirements are Partial. It did not run `isolation-check.sh` or `selftest.sh`, because
    the driver, the browser scripts and the self-test are unchanged since `0b4fb19` and only
    `netlog-steps.mjs` and tests import `lib/placement.mjs`; ran no live session, `driver.mjs` or
    `run.mjs`; called no REA tool; ran `test:unit`, `test:integration` and `build` only inside
    `validate`; and scanned the current files instead of the patch text, because pipes were refused,
    so lines deleted in the range were not scanned. Its permissions refused 4 of its commands, among
    them a sabotage that would have added a thirteenth-review remediation section, which did not
    run. Handled as follows:
    - **Suggestions 1–3 are not addressed in this record.** None of them is a critical, major or
      minor finding, so they stay open as listed here:
      - **Suggestion 1, a partial trigger match without a failed step:** `takeNested` in
        `lib/placement.mjs` takes fewer rows than the trigger has steps, as it should when a trigger
        step failed, but does not check that the last row it takes carries an `error`. In a test
        that the review ran in a copy, a successful `key a` row followed, in the same millisecond,
        by a download whose trigger never ran, the key row was read as nested and the order came out
        as [2, 1] instead of [1, 2]. The review found no effect on the retained records; it matters
        only for steps that start in the same millisecond.
      - **Suggestion 2, the start-time guard does not read the research README:** the check in
        `documentation-tenth-review.test.mjs` reads the documents under `docs/reverse-engineering`
        only, so a start time put into `research/excalidraw/README.md`, which states the netlog time
        rules, passed every check. The README's wording is right at `a9a4619`.
      - **Suggestion 3, `reviewState` fails on the first listed review:** for review 1, `covered` in
        `review-list.mjs` asks for the words for 0 reviews and throws, although the documentation of
        `reviewState` says that it reads a review wherever it is in the list; nothing calls it that
        way.
    - The 4 suggestions of the review of `6d5d264` and suggestions 2–10 of the review of `a85eb82`
      stay open as listed there.
    - A remediation of any of these suggestions would change the tooling, its tests or a documented
      research claim, so it would be behaviour-changing, and R-75 would need a fresh review under
      the rule.

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

- **REA MCP permission, resolved.** `mcp__rea__list_browser_targets` was denied twice in a
  non-interactive session, so s5–s11 used the REA CLI. In the observation batch the project-local
  REA MCP tools were allowed, and the CLI records of s5–s14 were validated and exported as Evidence
  bundles (R-73 ✅).
- **Scope decisions, made.** On 2026-11-05 the maintainer placed every guest-accessible feature in
  scope, so Export to Link (R-56) and the generation features (R-63) are no longer excluded.
- **Verification page for the headless desktop client.** From s13 (2026-11-05, 16:53 UTC) the
  reference answered the headless desktop load with HTTP 403 and a hosting-provider verification
  page. The research does not bypass it, so Export to Link (R-56), the desktop generation features
  (R-63), the isolated exports (R-64) and the desktop all-origin window (R-66) wait for a session
  that loads the page without it, for example in a headed browser that the maintainer runs. The
  mobile client loaded the page normally in s15 and s16 (17:56 and 17:59 UTC), in s17–s21, in
  the 15 sessions s22–s36 (21:25–21:58 UTC) and in the 13 sessions s37–s49 (22:51–23:25 UTC), and
  the desktop was not tried again. In s50 (23:26 UTC) the mobile load met the verification page
  too; the page navigated itself to the app after the challenge, but the load gate stopped the
  session before any REA call or input, so the one planned Export to Link upload never ran, and no
  later session ran that day. On 2026-11-06 one bounded load check in a fresh profile (s51) loaded
  the app normally, and so did s52–s57, so the one upload ran on mobile in s52 (R-56); the desktop
  was not tried. A load check (s58, 02:34 UTC) and s59–s64 (to 03:24 UTC) loaded normally too, but
  in s64 a locale script got HTTP 403, so the batch stopped all live contact after s64 (see
  [Keyboard, offline and layout batch](#keyboard-offline-and-layout-batch-s58s64)). Read again for
  403 responses on 2026-11-06, the retained records show earlier asset 403s that the gates of
  their sessions passed: in s16 (2026-11-05, 18:00 UTC) REA kept HTTP 403 for the two script chunks
  of Mermaid to Excalidraw, which the netlog wrote as aborted, as it did in s12 at 16:52 UTC with
  no window open, and at s49's load (23:22 UTC) the manifest got HTTP 403 twice, three minutes
  before s50's verification page. About two hours after s64, s65–s67 (05:21–05:33 UTC, three
  loads) loaded the app normally under a gate that stops on a 403 of any request type, and met no
  403 (see [Replay batch](#replay-batch-s65s67)); the desktop was not tried. s68–s70
  (06:21–06:33 UTC, three loads and six reloads from the service worker) loaded the app normally
  too and met no 403 under the same gate, 54's locale chunk included (see
  [Library undo, offline and language batch](#library-undo-offline-and-language-batch-s68s70)).
- **Not observable in this headless setup.** Native file pickers, save and export flows; R-18
  and R-46 plan them in a headed browser.
- **Not observed yet, but planned.** The effective stop-session flow and multi-client
  collaboration (R-55), and offline start and reconnection on desktop (R-57), observed on mobile
  in s60 and s63, and with the offline state kept across the reload in s68 and s69.
- **Independent review (R-75), open.** The fifteenth review (of `a9a4619`) meets the exit rule, but
  the observation batch after `db16323` is behaviour-changing and not covered by a review. That
  review covered the fourteenth-review remediation and reported 0 critical, 0 major and 0 minor
  findings and 3 suggestions, which stay open as listed with it. One fresh independent review runs once, at
  readiness, after every acceptance observation of issue #1; R-75 closes only under the exit rule
  in [Independent reviews](#independent-reviews).

## Remaining observation work

The issue cannot be completed from retained evidence. These rows of the
[residual matrix](residual-matrix.md) need work before the behaviour contract is met:

- **Without a live session:** none; R-73 is done.
- **New live observation, priority 1:** keyboard accessibility on desktop and with a screen
  reader (R-27; on mobile the focus, Tab, the menu and Help done in s59, s62 and s65);
  multi-point and modifier
  drawing on desktop (R-30, R-31; on mobile taps, a line's middle, the arrow types and Edit arrow
  done in s22–s36, s40 and s44, and a fourth and a deleted point in s55 and s57); hit-testing on desktop (R-34; mobile done in s17–s21); other handles, modifiers and nudging (R-36, R-37; all eight mobile handles, rotation and a two-element resize done in s24, s29, s38 and s42); named style controls on desktop
  (R-10, R-39; the mobile popovers done in s26, s31, s34, s36, s41 and s45–s47, and the text and
  freehand radios in s53, s55 and s57); text editing and its undo (R-40); arrow endpoint placement, binding rules and
  undo on desktop (R-42; mobile done in s23 and s28); file flows in a headed browser (R-16, R-18, R-46, R-47); Ctrl+wheel at an
  off-centre pointer and the desktop zoom limits (R-48; the mobile pinch ratios and limits done in s18 and s20); grouping, layers and alignment with
  their undo on desktop (R-49–R-51; mobile done in s25, s30, s33, s35, s39 and s43, a group's
  alignment in s54 and s56); zoom and selection across a desktop reload (R-54; done on mobile in
  s17, s19 and s21); REA inspection allowing every page origin
  while the driver draws on desktop, with request start times (R-66); Export to Link on desktop (R-56; the one planned upload ran on mobile in s52); the generation
  features on desktop (R-63; on mobile one generation ran in s49). Desktop sessions first need a way
  to load the page without the verification page (see the blockers); mobile sessions loaded it
  normally again on 2026-11-06 (s51–s57).
- **New live observation, priority 2:** the tool and selection after a drag, read after a wait
  (R-02, R-29); a reload while dark and with zen, grid and snap on, and
  Ctrl+Z after a toggle or theme change (R-19); a real device and what shows the
  shortcut letters (R-23; breakpoints, tablet sizes, landscape and live resizing emulated in s59
  and s62); the missing dark desktop surfaces (R-26); library export and import and desktop library
  use (R-15; an item added and placed on mobile in s64, with Undo and Redo in s68 and s69); the
  stop-session flow and a second client (R-55); offline start and reconnection on desktop (R-57;
  mobile in s60, s63, s68 and s69); undo
  for every entry listed in R-52; every other 🟡 or ❌ row of priority 2, including mobile
  versions of the desktop behaviours.
- **Second fresh-profile runs:** done in s8–s11 (R-76), for 55–59 in s65–s67, for 09b, which had
  never run (R-54), and the new 60 and 61 in s68 and s69, and for 54's French labels in s70, which
  loaded them as s61 had, after the 403 of s64.
- **New live observation, priority 3:** the remaining priority 3 rows, among them R-64's isolated
  desktop exports (scenarios 17 and 18; 19 ran on mobile in s15).
- **Maintainer decision:** how the desktop client can be observed again without bypassing the
  verification page, for example in a headed browser that the maintainer runs; the mobile client
  met it once, in s50, and loaded normally in s51–s64, but a script asset got HTTP 403 in s64 (and
  earlier ones in s16 and s49), and s65–s70 loaded normally again, so how often mobile sessions may
  run is also a maintainer decision.

## Interrupted and aborted runs

- s1: the client of scenario 03 was killed (exit 137) after the driver had executed every step.
  The results come from the timeline, and 03 replayed identically in s2 and s6.
- s5: aborted at scenario 01 by the metrics assertion (screen read 800×600).
- s6: four further metric aborts (01 twice, 12 once, and 00b once after a driver restart). Each
  scenario was rerun after 00b or 00c restored the metrics. The driver was restarted twice in s6.
- s8–s11: no run aborted and no step failed. The agent session that ran them was interrupted
  after the four sessions, before their record; when it resumed, the worktree held only the
  generated evidence, uncommitted, which regenerated byte for byte from the raw records, and no
  owned resource remained.
- s13 and s14: the metrics assertion stopped 12, 23 and 17 at their first step, because the
  desktop load had returned the verification page and no canvas; nothing reached the site after
  the load. The sessions planned for 18, 19, 20 and 21 were not run.
- s16: the REA window armed before 24 returned no Evidence (`target_unavailable`), because the
  reload changed the document. Every driver step ran; the only failed step of s15 and s16 is the
  expected download timeout of 19.
- s43: while it ran, its scratch helper script was edited in place by mistake; the exact earlier
  bytes were written back before the session read the script again, and its log shows every
  planned step, 16 and the cleanup in order. The next version was installed only after the batch.
- s48 and s49: the Close step after Insert in 42 (both) and 43 (s49) failed, as their descriptions
  allow, because Insert had already closed the dialog.
- s50: the load gate stopped it after 09, because the document came with HTTP 403 and the
  verification page (see the blockers); scenario 44 and its upload never ran, and no REA call was
  made.
- s62 and s64: one Close step failed in each, as their scenarios allow, because the sidebar had
  already closed (after 56's Space, and after 58 placed the library item).
- s64 and s65: in s64 the locale chunk that 54 asked for got HTTP 403; the gates, which checked
  documents and verification paths only, passed, and the session ran to its end. s65, planned to
  replay 55–59, was not run, and no live session followed.
- s65 and s66: one Close step failed in each, as their scenarios allow, as in s62 and s64. Before
  s65, the agent process preparing the batch was interrupted externally while the watcher check
  ran its first case on `about:blank`, which contacted no website, because that test's script
  waited for the watcher itself; the parent process removed the leftover container, network and
  token file, and the resumed writer fixed the wait and re-ran that case and the three others.
- Agent runs were interrupted by turn limits several times, including twice during the
  fourth-review remediation and twice during the fifth. Ownership was rechecked after each: no
  owned container, network, process, port, token file or profile remained.

## Resume instructions

1. Run the checks first, without contacting any site: `research/excalidraw/isolation-check.sh`,
   `research/excalidraw/selftest.sh` and `npx vitest run --project 'research:*'`.
2. Start each session with `00` (desktop) or `09` (mobile), which emulate before the first
   navigation; `00c` re-emulates after a driver restart, and `11` re-emulates on purpose to probe
   DPR; `52` and `57` re-emulate on purpose to resize the loaded page (R-23). To run 15 in a fresh session, run `07c` after `00`; `16` reads the storage inventory at
   any point before 08.
   Every main scenario asserts the metrics before its first input; the short follow-on
   scenarios (02b, 02c, 03b, 04b, 07b, 08b, 10b) rely on the one before them.
3. After any tool that may disturb emulation, run `00b`/`09b` (reload and assert). If the driver
   must restart mid-session, restart it on the same `--out` (its `runLast` lock and halt reason
   are kept in `driver-state.json`) and run `00c`. A driver that attaches to a room view with no
   `runLast` record halts at once.
4. Run `08`/`08b` last, at most once per session, and never during REA calls. The driver enforces
   the order and the single run; the REA rule stays manual.
5. Give every probe its own label, or `timeline-summary.mjs` warns that it merged reads. Gate
   every live session on a 403 or 429 of any request type, a verification path and an aborted
   request on the reference origin, in the netlog and in every REA window, and stop all live
   contact at the first one (see [Replay batch](#replay-batch-s65s67)).
6. Rebuild the index with `build-evidence.mjs`, the window summary with `rea-windows.mjs` and the
   netlog placement with `netlog-steps.mjs` for every session directory (see the
   [research README](../../research/excalidraw/README.md)), then update the documents until the
   documentation tests pass.
