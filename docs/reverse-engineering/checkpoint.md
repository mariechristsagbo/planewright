# Checkpoint: issue #1 status

Last updated: 2026-11-05 (R-76 record: the second fresh-profile sessions s8–s11 ran on
2026-11-05 at 04:48–04:55 UTC; everything else comes from retained evidence and local checks).
Branch: `docs/1-excalidraw-research`. Issue #1 stays
open: the Draft PR refers to it (`Refs #1`) and does not close it.

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

| Requirement                                             | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Re-run each documented interaction from a fresh profile | Partial | s6 re-ran the desktop chain and s7 the mobile chain, each in one fresh profile, and every s6 and s7 timeline row matches a committed scenario step. The R-76 sessions s8–s11 ran 12, 13 and 15 on desktop and 14 on mobile once more, each in a new fresh profile with a storage inventory and a REA initial-page inspection, and each of their timelines is exactly the steps of its scenarios (R-76 ✅). Not re-run: scenario 09b never ran, and 15 ran after 00 and 07c, not after 01–07b. Native picker, save and export flows cannot complete in headless Chromium                                                                                                                                                                                                                                                                                            |
| Screenshot dimensions validated                         | Done    | PNG headers checked. From s6 on, CSS viewport, DPR, screen, touch points and canvas backing store asserted before the first input of every main scenario (follow-on scenarios run straight after one that asserted); the committed index has no `assertMetrics` step for s1–s5. s7 and s11 captures are 1170×2532 device pixels at DPR 3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Generated JSON and REA bundles validated                | Partial | All committed JSON parses. With the current tools, `sessions.json`, `rea-windows.json`, the nine probe summaries, the five initial-inspection summaries and `static-api-surface.json` regenerate byte for byte from the retained records. This was checked in the fifth-review remediation on 2026-11-04, by the sixth review on `46b2b01`, by the review of `a78a210` on that head and, for R-76, on `f0aa21b` on 2026-11-05: first the nine files committed before R-76, then the s1–s11 files built after it. `rea-extract.mjs` changed in `f0aa21b`, to read REA CLI envelopes; the other builders and the libraries they import are unchanged since `46b2b01`. `bundle-01-desktop.json` passed `rea evidence-export` earlier on 2026-11-04. The REA CLI records of s5–s11 cannot be exported as a bundle without the MCP `export_evidence_bundle` tool (R-73) |
| CDP and driver ports loopback-only                      | Done    | With the sixth-review tooling, `isolation-check.sh` passed 11 of 11 and `selftest.sh` 19 of 19 against real local containers on 2026-11-05 at 00:15–00:16 UTC, on `e38955a`, contacting no website; their output is committed in [local-checks/](local-checks/). Before the R-76 sessions they passed again, 11 of 11 and 19 of 19, on `0b4fb19` on 2026-11-05 at 04:45–04:46 UTC; that output is committed there too. The earlier runs on `dc6eef1` (2026-11-04, 22:18 and 22:19 UTC) kept no output. This holds from s5 on: s1–s4 ran on the default Docker bridge, where the DevTools forwarder was reachable from other containers (see the methodology). A probe that cannot run, and a failed docker listing during cleanup, count as FAIL                                                                                                                   |
| Owned processes and profiles cleaned up                 | Done    | After every session and every local check: no `pw-*` container or network, no driver process, no driver token files; profiles were container tmpfs. The removal checks of the `e38955a` and `0b4fb19` runs are in local-checks. After each of s8–s11 the container, its network, the driver, the listeners on 9222 and 9333, the token file and any REA CLI process were checked gone                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Separate Claude Code review session                     | Done    | Nine independent reviews ran. The ninth (of `a85eb82`) meets the R-75 exit rule: 0 critical, 0 major and 0 minor findings, and its 10 suggestions are listed with their handling. R-75 closes only under the exit rule in [Independent reviews](#independent-reviews), so it is ✅ until a behaviour-changing remediation follows `a85eb82`. This closes R-75 only; the other Partial criteria and the maintainer decisions keep issue #1 open. No review covers the R-76 commits after `935f2fc` (see [R-76 runs](#r-76-runs-s8s11))                                                                                                                                                                                                                                                                                                                              |

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
- **Not covered by a review.** These commits change research tooling, tests and claims. The R-75
  exit rule speaks of review remediations and none of them is one, so R-75 is left as the ninth
  review set it, but no independent review covers them yet.
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

## Independent reviews

**R-75 exit rule.** R-75 may become ✅ only after a fresh independent review of the latest
behaviour-changing remediation reports 0 critical, 0 major and 0 minor findings. Suggestions
that do not block may stay open if they are listed here with their handling. A remediation is
behaviour-changing when it changes the research tooling, its tests or a documented research
claim. Commits that only record a review, its checks or the PR description are not, so a review
that meets the rule does not call for another one. Updating the record checks (the
documentation checks that read the review list, R-75 and the review records) so that they accept
a new record also counts as recording. Until then R-75 stays 🟡. Meeting the rule
closes R-75 only: issue #1 also needs the remaining observation work and the maintainer
decisions.

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
9. **Review of `a85eb82`**: 0 critical, 0 major, 0 minor findings and 10 suggestions. It meets the
   R-75 exit rule: it covers `a85eb82`, where the eighth-review remediation ends, and the commits
   after it only record this review, update the record checks and say in the rule that doing so
   counts as recording. R-75 is ✅; issue #1 stays open. Handled as follows:
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
- **Independent review (R-75), done.** The ninth review (of `a85eb82`) meets the exit rule, so
  no further review is due for R-75. R-75 closes only under the exit rule in
  [Independent reviews](#independent-reviews): a behaviour-changing remediation after `a85eb82`,
  such as one for the open suggestions, would need a fresh review under it.

## Remaining observation work

The issue cannot be completed from retained evidence. These rows of the
[residual matrix](residual-matrix.md) need work before the behaviour contract is met:

- **Without a live session** (retained raw evidence only): set the s1–s7 driver netlog
  timestamps against the drawing steps for drawing-time traffic (R-66) and the worker trigger
  (R-64); re-export the s5–s11 REA records once the MCP tools are granted (R-73).
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
6. Rebuild the index with `build-evidence.mjs` and the window summary with `rea-windows.mjs` for
   every session directory (see the [research README](../../research/excalidraw/README.md)), then
   update the documents until the documentation tests pass.
