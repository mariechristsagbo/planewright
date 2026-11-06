# Final independent review (R-75)

The single final independent review of PR #2 ran once, read-only, on head `cd1694c` on
2026-11-06, in a separate Claude Code session (`3a79e917-14d4-4c02-ac56-6a5dd616aff1`, Claude Opus
5.5), briefed to cover every behaviour-changing commit after `db16323` up to `cd1694c`. It is an
automated review, not human approval. It reported **0 critical, 2 major and 8 minor findings and 6
suggestions**, so it does not meet the R-75 exit rule in the
[checkpoint](checkpoint.md#independent-reviews).

On 2026-11-06, by a decision taken autonomously within the maintainer's scope, the two major
findings were remediated, the minor findings and suggestions are recorded here as open and
non-blocking, for the feature work that follows, and no further review runs for issue #1. R-75
therefore stays 🟡: the two remediation commits are behaviour-changing and no review covers them.

## What the review ran

- On the clean `cd1694c` tree, with Node 24.22.1: `format:check`, `lint`, `guardrails` and
  `secrets:scan` passed, and the research projects passed (104 files, 1293 tests, 0 failed).
- It regenerated all 133 committed evidence files from the raw records and found them identical
  byte for byte once Prettier was applied; builders that need an output path wrote to standard
  output, and for the 3 `rea-screenshot-*` files, whose builder would create PNG files, it derived
  the same fields in memory, which matched.
- `secret-scan.mjs` found nothing in the evidence, the local-check outputs and their history, the
  raw s83 and s84 trees or the PR diff.
- It found all 8 GitHub checks passing on `cd1694c`, the end-to-end tests included.
- It did not run `typecheck`, `test:coverage`, `build` or `test:e2e`, which write caches or output,
  nor `selftest.sh` and `isolation-check.sh`, which start Docker; it read their committed `67a7b03`
  outputs instead (11 of 11 and 19 of 19). It made no REA call, did not contact the reference and
  only read GitHub.

## Major findings, remediated

1. **The verification-page rule did not match what the sessions did.** The documents said a load was
   never retried after a verification page, while s14 loaded the desktop page 37 s after s13 had met
   it, and the methodology left out the pauses before s51 and s65. Remediated in `f69598a`: the
   [methodology](methodology.md#verification-pages-and-protection-responses) states the rule as
   applied and each stop and resumption, and the limitations, the checkpoint and the
   [readiness record](readiness.md) record the decision that no further desktop load check runs in
   this phase, so the desktop gaps stay an objective limitation, not done.
2. **Not every mobile context-menu item was picked.** The documents said every item of both mobile
   menus had been picked, but both Copy to clipboard items came only from the element menu (82) and
   Paste only from the canvas menu (82, 88). Remediated in `0d327d3`: R-08, R-09, R-53, the
   [feature inventory](feature-inventory.md), the backlog, the checkpoint and the readiness record
   name the two unpicked cases and classify them as refinements, not mandatory.

## Minor findings, open

Each stays open and non-blocking, for the feature work that follows; none is fixed for issue #1.

1. **REA window coverage is overstated.** 5 of the 28 windows of s79–s84 opened after their
   scenario's first step: those over 87 and 90 in s83 and over 91 and 92 in s84, by 1 ms to 828 ms,
   and the s80 window over 84, by 2.8 s, which holds 37 of the 42 steps and misses a `touchDrag`.
   The record says each window covered its whole scenario, and its checks measure the lead from
   `first_step_at`, the first step inside the window, so it can never be negative. The netlog shows
   no request in the uncovered intervals, so the request conclusions hold on netlog evidence.
2. **`clipboardWrite` refuses links by a denylist with gaps.** Texts such as
   `https:example.invalid/x`, `http:\\…`, `javascript:`, `data:` and `mailto:` pass it, a failed
   write is not fatal, and with 88's `continueOnError` a failed write would paste the link that 87
   left on the clipboard. Neither happened in s83 or s84, but the documents say a paste can never
   make a link.
3. **The scenario guards are weaker than the documented bounds.** The guard of 87 neither refuses
   Paste nor pins 87's role names and taps, no guard of 79–92 requires `exact: true` on role steps,
   nothing checks across all scenarios that `clipboardWrite` is used only in 88 and `clipboardUrl`
   only in 87, and the number of texts 91 types is unbounded. The committed scenarios comply.
4. **The readiness check reads strings only.** It would pass with the readiness table deleted; it
   does not compare the table's Partial items with the checkpoint's.
5. **Some readiness classifications are inaccurate.** R-67 and R-74 are listed as tool limits,
   although the pinned REA build has a bundle-analysis deadline setting and a connect mode for
   `capture_browser_scenario`; R-32, R-43, R-49 and R-61 are said to be open in the backlog but are
   not there, and R-32 was never attempted; the desktop row list leaves out R-27, R-32, R-34, R-40,
   R-43, R-49 and R-61.
6. **Some statements are stale.** The long-press menu is said to open above the press, but it spans
   y 273–825 and covers the press at y 490 (A-16 has it right); B-34 says the mobile links were not
   picked, though 86 and 87 picked them; B-50 says both runs had the grid on, though 89 ran with it
   off; the s80 against s79 ARIA count should be 10 of 11 shared snapshots, not 9 of 10; the
   backlog's open layer and flip effects should say on desktop; and the checkpoint still counts 117,
   then 128 evidence files, where 133 regenerate now.
7. **A raw-only label is dropped.** Copy link to object is labelled raw-only in B-42 but [O] or
   [O, high] in the checkpoint, the backlog and the inventory, and B-42 credits the netlogs and the
   windows for its link shape, which comes from a raw-only read.
8. **The stop gates live outside Git.** The 403 and 429 gate, the netlog watcher, the navigation
   gate and the link-host gate that the no-403 claims rely on are scratch helpers, and the
   reproduction steps in the research README name no gate.

## Suggestions, open

1. **Child frames.** The navigation watcher and the netlog's navigation row ignore child frames, so
   an embedded frame could navigate unwatched; no embed link was used.
2. **CSS-scale captures.** The clip is measured from the document origin and the masks from the
   viewport; the reference's document does not scroll.
3. **Live-region text** is cut to 80 characters in the page before redaction; only the raw
   timelines keep it.
4. **Driver hardening.** Delete the token on quit, create the output directory with mode 0700,
   refuse an output path inside the repository, cap loads and reloads per batch, stop the driver in
   the self-test's cleanup, and document that the unauthenticated loopback DevTools endpoint
   assumes a single-user host.
5. **Test quality.** Two assertions only do arithmetic on constants, `documentLayout` is never run
   by its test, the offline step's retry path is untested, and one sanitiser check could print a
   synthetic room value if the query stripping broke.
6. **Bookkeeping.** The checkpoint row of unreviewed batches stops at `97149aa`; A-18's order (the
   font shrinks, then the note grows) was not observed, as both changed between the same two reads;
   and the exact regeneration commands (probe flags, session lists, the standard-output route) are
   not recorded.

## What follows

No further review runs for issue #1, and no live session runs after s84. Every Partial criterion
and open residual row stays open as classified in the [readiness record](readiness.md); the
findings above go to the feature issues that touch them. PR #2 leaves Draft and is squash-merged
once every required check passes on its exact head, which closes issue #1.
