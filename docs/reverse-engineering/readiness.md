# Readiness of issue #1

Last updated: 2026-11-06, after the final mobile batch (s83–s84). The precise state of each
criterion, the batch records and the independent reviews are in the [checkpoint](checkpoint.md);
the open rows are in the [residual matrix](residual-matrix.md).

This document classifies, after s83 and s84, every acceptance criterion and testing requirement
of issue #1 that is not Done, and the open residual rows behind them. The agreed mobile list is
complete: the six items of the [final mobile batch](checkpoint.md#final-mobile-batch-s83s84) were
the last guest-mode mobile observations that the maintainer listed as feasible without an account,
a file chooser, an upload, a room, an embed link or a generation, and no live session runs after
s84. A gap is never counted as done: each is an objective limitation, which this baseline cannot
remove without breaking a rule of the investigation, a scope the maintainer excluded for this
phase, a tool limit, or a refinement of a behaviour already observed, which its feature issue must
observe or decide.

| Item                                                    | Status  | Classification                                                                                 | What stays open                                                                                                                                                            |
| ------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feature-inventory.md` covers all discovered features   | Partial | Objective limitation: verification page; objective limitation: headless native file chooser    | Every discovered feature has an ID and a matrix row. Not used: desktop Export to Link and generation (R-56, R-63), library export and import and Insert image (R-15, R-18) |
| `behavior-analysis.md`                                  | Partial | Objective limitation: verification page; excluded by the maintainer; refinement, not mandatory | Desktop undo, reload, modifier, nudge and hit-test dimensions; a second collaboration client (R-55); on mobile the refinements listed below                                |
| `limitations.md`                                        | Partial | Refinement, not mandatory                                                                      | The inaccessible and unverified behaviour is listed; the raw-only facts are listed per batch, s83–s84 included, but were never audited exhaustively                        |
| Desktop light/dark and mobile evidence sets             | Partial | Objective limitation: verification page                                                        | The missing desktop dark surfaces (R-26)                                                                                                                                   |
| Prioritised backlog with acceptance criteria            | Partial | Objective limitation: verification page; refinement, not mandatory                             | Criteria marked **open** for desktop behaviour and for the refinements below                                                                                               |
| Re-run each documented interaction from a fresh profile | Partial | Objective limitation: verification page; excluded by the maintainer                            | 15 on desktop after 01–07b; 43 and 44 ran once by design (one generation and one upload allowed); 77 ran once and 78 replaced it                                           |
| Separate Claude Code review session                     | Partial | Mandatory and feasible                                                                         | The single final independent review (R-75), the next step                                                                                                                  |

Every other criterion and requirement is Done.

- **Objective limitation: verification page.** Since s13 (2026-11-05, 16:53 UTC) the reference
  has answered the headless desktop client with HTTP 403 and a hosting-provider verification
  page. The investigation never bypasses one: a session stops at once, with no reload, no
  user-agent or client change and no waiting it out inside it, and only a fresh, bounded load check
  after a pause may follow ([methodology](methodology.md#verification-pages-and-protection-responses)).
  In practice s14 loaded the desktop page 37 s after s13 had met it, the one departure; s51 checked
  mobile 73 min after s50 met the page there, and s65 resumed 1 h 58 min after s64's asset 403. The
  desktop got no such check after s14, and on 2026-11-06 a decision taken autonomously within the
  maintainer's scope settled that no further desktop load check runs in this phase. So the desktop
  parts of these open rows stay open, not done: R-01–R-05, R-07–R-10, R-12, R-13, R-17,
  R-19–R-22, R-26, R-29–R-31, R-33, R-35–R-39, R-41, R-42, R-44, R-48, R-50–R-54, R-56, R-57 and
  R-63–R-66. A later phase can observe them through a bounded desktop load check after a pause or
  a headed browser that the maintainer runs.
- **Objective limitation: headless native file chooser.** Native file pickers show nothing in
  headless Chromium, and the final batch used no file chooser or upload, so Open, Save to…,
  Ctrl+S, the PNG and SVG exports, a library file, Insert image and a dropped scene file wait for
  a headed browser that the maintainer runs (R-15, R-16, R-18, R-45, R-46, R-47). A screen reader
  (R-27) and a real phone (R-23, R-48) also need a person's device.
- **Excluded by the maintainer for this phase.** Creating a room, and so a second collaboration
  client, the stop flow and frame sizes (R-14, R-55, R-60); a second upload or generation (R-56,
  R-63); sign-in and account surfaces stay out of scope (R-62).
- **Tool limits.** REA's accessibility text needs an approval (R-58), its bundle analysis a longer
  deadline (R-67), `capture_browser_scenario` a connect mode (R-74), and document- and
  window-level listeners a read that REA lacks (R-65).
- **Refinement, not mandatory.** Feasible on mobile but outside the agreed final list, each a
  further case of a behaviour already observed, and each marked open in the backlog for its
  feature issue: text re-edit by a double tap and the undo of typing (R-40), the hit ladder at
  zoom 2 and with a thicker stroke (R-34), other Autoshape inputs (R-43), a nested group (R-49),
  a longer reconnection window (R-57), the breakpoints to the pixel (R-23), the Tab shape toggle
  (R-32) and a committed storage inventory after interaction (R-61). The maintainer has confirmed
  this classification: they are not mandatory for issue #1, and no live session runs for them
  before the review.
- **Mandatory and feasible.** No feasible mandatory observation remains under these constraints;
  the one mandatory item left is the single final independent review (R-75), which runs once,
  read-only, on the latest head. Until it meets the exit rule, PR #2 stays a Draft and issue #1
  stays open.
