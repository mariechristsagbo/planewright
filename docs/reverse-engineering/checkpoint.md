# Checkpoint: issue #1 status

Last updated: 2026-11-05 (netlog placement for R-64 and R-66, with no new live session: the latest
sessions are still the R-76 runs s8–s11, on 2026-11-05 at 04:48–04:55 UTC; everything else comes
from retained evidence and local checks).
Branch: `docs/1-excalidraw-research`. Issue #1 stays
open: the Draft PR refers to it (`Refs #1`) and does not close it.
Commit ranges are written as Git reads them: `A`..`B` is the commits after `A` up to and
including `B`. A span that includes its first commit is written from `A` to `B`.

## Acceptance criteria

| Criterion                                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `methodology.md`                                                   | Done    | One confidence rule: two tools reading one session count as one session, and results that match only once a setup difference is allowed for count as different. The page-load count (21) and where the metrics are asserted now match the committed evidence                                                                                                                                                                                                                                                        |
| `feature-inventory.md` covers all discovered features              | Partial | Every entry has an ID (F-01–F-35) with a residual-matrix row. Still open: Find on canvas, language switch, library item flows, Export to Link (not clicked, because it publishes the scene). The exclusion of the generation features needs a maintainer decision. §2 is rated medium, on a raw comparison of the s1 and s6 ARIA snapshots, which are not identical; R-76 raised the dark text panel, the desktop dark Preferences and the mobile dark surfaces to high on raw comparisons (s6 and s10, s7 and s11) |
| `behavior-analysis.md`                                             | Partial | Every entry (B-01–B-37) has the eleven issue fields in order. Unobserved dimensions name their residual row, and "not applicable" is kept only with a stated reason. Claims that no session observed are withdrawn, among them the reload persistence claims and B-01's tool and selection after a drag. R-76 raised B-02, B-35 and B-31's first-load inventory to high; B-30's save timing stays medium because s6 and s9 differ. Many dimensions (undo, reload, mobile, edge cases) are open                      |
| `network-analysis.md`                                              | Done    | Observed metadata and hypotheses are separated. Both analytics beacon key sets are described with their s6 counts; the cache counts come from `evidence/rea-windows.json`, and the storage names and the storage quota are raw-only                                                                                                                                                                                                                                                                                 |
| `architecture-hypotheses.md`                                       | Done    | Every entry is labelled with a confidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `rea-findings.md`                                                  | Done    | Window bounds and retention come from `evidence/rea-windows.json`; the lifecycle offsets, the scenario 13 Delete time, the REA side of the byte-identical screenshot pairs and the result sizes are marked as raw-only                                                                                                                                                                                                                                                                                              |
| `limitations.md`                                                   | Partial | It documents the inaccessible and unverified behaviour and lists the raw-only facts found by the fourth, fifth and sixth reviews and their remediations; the list began with the fourth. Each of those reviews found facts that were not yet listed, and the list has not been audited exhaustively, so it is not claimed complete                                                                                                                                                                                  |
| Desktop light/dark and mobile evidence sets                        | Partial | Desktop light and dark in s6, including dark element surfaces. Mobile light and dark in s7, where DPR 3 held at all 5 assertions (at 5 points: after 09's load and at the start and end of 10 and 14), and again in s11 (R-76). Not captured: the dark desktop canvas context menu, command palette, library and sticky note (R-26), and many matrix rows have ❌ in the desktop-dark column, for example R-03, R-07, R-08, R-14, R-15 and R-17                                                                     |
| Canvas interactions through the external driver while REA observes | Partial | Seven REA CLI windows: scenarios 02, 10 and 13 in s6 and s7 (the MCP tools were denied) and 12, 13, 15 and 14 in s8–s11, these four armed before their scenario's first step. Two retain navigation metadata only, the s7 window armed after scenario 10's first tap, and the five `inspect_web_page` windows cover one origin; no window armed in time covers mobile drawing (R-72)                                                                                                                                |
| Evidence sanitized and stored under the agreed directories         | Done    | Raw evidence is in the workspace `artifacts/research/excalidraw/`; the sanitized index is in `evidence/`. Retained room values were removed or overwritten, and no copy is known to remain (see [privacy](#privacy-remediation))                                                                                                                                                                                                                                                                                    |
| No source maps, official repository, package or assets             | Done    | 0 `.map` requests in all eleven netlogs; no reference package installed                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Prioritised backlog with acceptance criteria                       | Partial | [backlog.md](backlog.md) has 22 items. Items 19–22 (libraries, alignment and distribution, offline start and reconnection, keyboard accessibility) have no observed behaviour, so all their behaviour criteria are **open** (R-15, R-51, R-57, R-27). Elsewhere, the criteria are not audited exhaustively against their entries: the sixth review found five labelled more strongly than their evidence (corrected), and many are open                                                                             |

## Testing requirements

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Re-run each documented interaction from a fresh profile | Partial | s6 re-ran the desktop chain and s7 the mobile chain, each in one fresh profile, and every s6 and s7 timeline row matches a committed scenario step. The R-76 sessions s8–s11 ran 12, 13 and 15 on desktop and 14 on mobile once more, each in a new fresh profile with a storage inventory and a REA initial-page inspection, and each of their timelines is exactly the steps of its scenarios (R-76 ✅). Not re-run: scenario 09b never ran, and 15 ran after 00 and 07c, not after 01–07b. Native picker, save and export flows cannot complete in headless Chromium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Screenshot dimensions validated                         | Done    | PNG headers checked. From s6 on, CSS viewport, DPR, screen, touch points and canvas backing store asserted before the first input of every main scenario (follow-on scenarios run straight after one that asserted); the committed index has no `assertMetrics` step for s1–s5. s7 and s11 captures are 1170×2532 device pixels at DPR 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Generated JSON and REA bundles validated                | Partial | All committed JSON parses. With the current tools, `sessions.json`, `rea-windows.json`, the nine probe summaries, the five initial-inspection summaries and `static-api-surface.json` regenerate byte for byte from the retained records. This was checked in the fifth-review remediation on 2026-11-04, by the sixth review on `46b2b01`, by the review of `a78a210` on that head and, for R-76, on `f0aa21b` on 2026-11-05: first the nine files committed before R-76, then the s1–s11 files built after it; all 17 again by the tenth review on `f1562ed`, on `5f955a6` in its remediation, on `776dc05` in the eleventh-review remediation, by the twelfth review on `4e9c663`, which compared 7 of them byte for byte and the 10 that a builder prints to stdout by a canonical digest, because writing them to a file was refused, and on `e59ecf8` in its remediation; the thirteenth review, on `6d5d264`, compared the same 7 byte for byte and the same 10 by a canonical digest, for the same reason, and argued from their layout, without a literal comparison, that Prettier would give those 10 the same bytes. `rea-extract.mjs` changed in `f0aa21b`, to read REA CLI envelopes, and `lib/windows.mjs`, which it shares with `rea-windows.mjs`, in `8bfdfe3`, to refuse failed ones, and again in `5574b04`, with `rea-windows.mjs` in `a64611a`, which changes only their failure messages, and in `2b5ff0e`, to count a missing timeline as unknown, and `495e95e`, with both scripts, to name a file that is not valid JSON, neither of which changes a committed file; the other builders and the libraries they import are unchanged since `46b2b01`. `bundle-01-desktop.json` passed `rea evidence-export` earlier on 2026-11-04. `netlog-steps.json`, added in `545b97b` and built by `netlog-steps.mjs`, regenerates byte for byte with the tools at `eff8534`, as do the other 17 ([Netlog placement](#netlog-placement-r-64-r-66)). The REA CLI records of s5–s11 cannot be exported as a bundle without the MCP `export_evidence_bundle` tool (R-73) |
| CDP and driver ports loopback-only                      | Done    | With the sixth-review tooling, `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 against real local containers on 2026-11-05 at 00:15–00:16 UTC, on `e38955a`, contacting no website; their output is committed in [local-checks/](local-checks/). Before the R-76 sessions they passed again, 11 of 11 and 19 of 19, on `0b4fb19` on 2026-11-05 at 04:45–04:46 UTC; that output is committed there too. The earlier runs on `dc6eef1` (2026-11-04, 22:18 and 22:19 UTC) kept no output. This holds from s5 on: s1–s4 ran on the default Docker bridge, where the DevTools forwarder was reachable from other containers (see the methodology). A probe that cannot run, and a failed docker listing during cleanup, count as FAIL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Owned processes and profiles cleaned up                 | Done    | After every session and every local check: no `pw-*` container or network, no driver process, no driver token files; profiles were container tmpfs. The removal checks of the `e38955a` and `0b4fb19` runs are in local-checks. After each of s8–s11 the container, its network, the driver, the listeners on 9222 and 9333, the token file and any REA CLI process were checked gone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Separate Claude Code review session                     | Partial | Thirteen independent reviews ran. The thirteenth (of `6d5d264`) meets the R-75 exit rule: 0 critical, 0 major and 0 minor findings, and its 4 suggestions are listed with their handling. It reviewed the twelfth-review remediation, `4e9c663`..`6d5d264`, which handled the 2 minor findings and 4 suggestions of the twelfth review. The netlog placement after `c010f7e` ([Netlog placement](#netlog-placement-r-64-r-66)) changes research tooling, its tests and documented claims, so it is behaviour-changing, and no review covers it yet: R-75 is 🟡 again. R-75 closes only under the exit rule in [Independent reviews](#independent-reviews), which applies to every behaviour-changing commit: the ninth review met it on `a85eb82`, but the R-76 commits after `935f2fc` were behaviour-changing and no review covered them until the tenth (see [R-76 runs](#r-76-runs-s8s11)). The tenth to the thirteenth are automated Claude Code reviews, not human approval. This closes R-75 only; the other Partial criteria and the maintainer decisions keep issue #1 open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

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
- **Sabotage.** Each commit's tests ran on its own tree before the commit, and each new or
  rewritten check failed under at least one mutation in a temporary copy outside the
  repository, after an unchanged copy passed. The `f1562ed` record checks still passed the
  `5eb8852` checkpoint and matrix, which kept R-75 ✅ over the unreviewed R-76 commits; the new
  ones failed them in 11 checks.
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
- **Tests first.** The new word checks failed with the `6d5d264` word lists (2 of 3), and the new
  and rewritten record checks failed with the `668d79b` documents (10 checks), before each change.
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
  and 1 was the rewritten entry check of the thirteenth review. The commits are kept, because no
  commit is rewritten.
- **The next record.** `exitRuleState` reads where reviewed work ends only from the checks of a
  review remediation, so the record of the review that covers this work needs the record checks
  to accept this section in their place.
- **Not covered by a review.** The commits after `c010f7e`, from `6051fd5` to `0b2ebda`, which
  adds this section, and the commit after it that corrects two counts here, are
  behaviour-changing, and no listed review covers them, so R-75 is 🟡 until a fresh review of the
  latest of them reports 0 critical, 0 major and 0 minor findings.

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
  bundle. s8–s11 used the CLI too, so that raw records stayed in the artifact tree. A maintainer can grant the project-local REA MCP tools and re-export (R-73).
- **Scope decisions.** The generation features (Text to diagram, Mermaid to Excalidraw,
  Wireframe to code) are excluded in [limitations](limitations.md) without maintainer approval
  (R-63), and Export to Link was not clicked because it publishes the scene (R-56).
- **Not observable in this headless setup.** Native file pickers, save and export flows; R-18
  and R-46 plan them in a headed browser.
- **Not observed yet, but planned.** The effective stop-session flow and multi-client
  collaboration (R-55), and offline start and reconnection (R-57).
- **Independent review (R-75), open.** The thirteenth review (of `6d5d264`) meets the exit rule,
  but the netlog placement commits after `c010f7e` change research tooling, its tests and
  documented claims, and no review covers them yet. The thirteenth reviewed the twelfth-review
  remediation and reported 0 critical, 0 major and 0 minor findings and 4 suggestions, which stay
  open as listed with it. R-75 closes only under the exit rule in
  [Independent reviews](#independent-reviews): a fresh review of the latest behaviour-changing
  commit must report 0 critical, 0 major and 0 minor findings.

## Remaining observation work

The issue cannot be completed from retained evidence. These rows of the
[residual matrix](residual-matrix.md) need work before the behaviour contract is met:

- **Without a live session** (retained raw evidence only): re-export the s5–s11 REA records once
  the MCP tools are granted (R-73).
- **New live observation, priority 1:** keyboard accessibility (R-27); multi-point and modifier
  drawing (R-30, R-31); hit-testing (R-34); other handles, modifiers and nudging (R-36, R-37); named style controls
  (R-10, R-39); text editing and its undo (R-40); arrow endpoint placement, binding rules and
  undo (R-42); file flows in a headed browser (R-16, R-18, R-46, R-47); Ctrl+wheel at an
  off-centre pointer, zoom limits and pinch ratios (R-48); grouping, layers and alignment with
  their undo (R-49–R-51); zoom and selection across a reload, and scenario 09b run on a drawn
  scene with a scene probe after the reload (R-54); REA inspection allowing every page origin
  while the driver draws, mobile included (R-66).
- **New live observation, priority 2:** the tool and selection after a drag, read after a wait
  (R-02, R-29); a reload while dark and with zen, grid and snap on, and
  Ctrl+Z after a toggle or theme change (R-19); responsive breakpoints, a tablet viewport and
  landscape orientation (R-23); the missing dark desktop surfaces (R-26); library use (R-15);
  the stop-session flow and a second client (R-55); offline start and reconnection (R-57); undo
  for every entry listed in R-52; every other 🟡 or ❌ row of priority 2, including mobile
  versions of the desktop behaviours.
- **Second fresh-profile runs:** done in s8–s11 (R-76); scenario 09b has still never run
  (R-54).
- **New live observation, priority 3:** the remaining priority 3 rows.
- **Maintainer decisions:** Export to Link (R-56); the generation features (R-63); whether to
  grant the REA MCP tools for a validated bundle (R-73).

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
- Agent runs were interrupted by turn limits several times, including twice during the
  fourth-review remediation and twice during the fifth. Ownership was rechecked after each: no
  owned container, network, process, port, token file or profile remained.

## Resume instructions

1. Run the checks first, without contacting any site: `research/excalidraw/isolation-check.sh`,
   `research/excalidraw/selftest.sh` and `npx vitest run --project 'research:*'`.
2. Start each session with `00` (desktop) or `09` (mobile), which emulate before the first
   navigation; `00c` re-emulates after a driver restart, and `11` re-emulates on purpose to probe
   DPR. To run 15 in a fresh session, run `07c` after `00`; `16` reads the storage inventory at
   any point before 08.
   Every main scenario asserts the metrics before its first input; the short follow-on
   scenarios (02b, 02c, 03b, 04b, 07b, 08b, 10b) rely on the one before them.
3. After any tool that may disturb emulation, run `00b`/`09b` (reload and assert). If the driver
   must restart mid-session, restart it on the same `--out` (its `runLast` lock and halt reason
   are kept in `driver-state.json`) and run `00c`. A driver that attaches to a room view with no
   `runLast` record halts at once.
4. Run `08`/`08b` last, at most once per session, and never during REA calls. The driver enforces
   the order and the single run; the REA rule stays manual.
5. Give every probe its own label, or `timeline-summary.mjs` warns that it merged reads.
6. Rebuild the index with `build-evidence.mjs`, the window summary with `rea-windows.mjs` and the
   netlog placement with `netlog-steps.mjs` for every session directory (see the
   [research README](../../research/excalidraw/README.md)), then update the documents until the
   documentation tests pass.
