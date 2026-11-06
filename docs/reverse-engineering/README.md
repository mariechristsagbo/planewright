# Reverse-engineering baseline (issue #1)

This is the first guest-mode behavioural baseline of the public reference application, captured
on 2026-11-04 and 2026-11-05 with REA plus an external Playwright driver. Sessions s1–s4 were the
first pass; s6 (desktop) and s7 (mobile, verified DPR 3) re-ran the desktop and mobile chains from
fresh profiles and added scenarios 12–15 (12, 13 and 15 in s6, 14 in s7). The R-76 sessions
s8–s11 ran each of those four once more, in new fresh profiles, on a later build of the
reference. 09b first ran in s68 and s69, and s5 records an aborted rerun. It is not exhaustive; see the residual matrix and the checkpoint.

| Document                                                 | Contents                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| [methodology.md](methodology.md)                         | Clean-room rules, evidence labels, environment, reproduction, sanitisation |
| [feature-inventory.md](feature-inventory.md)             | Desktop and mobile UI inventory, menus, dialogs, shortcuts                 |
| [behavior-analysis.md](behavior-analysis.md)             | Behaviours B-01…B-37, each with the eleven issue #1 fields                 |
| [network-analysis.md](network-analysis.md)               | Observed traffic, storage and workers, separated from backend hypotheses   |
| [architecture-hypotheses.md](architecture-hypotheses.md) | Labelled inferences and hypotheses A-01…A-18                               |
| [rea-findings.md](rea-findings.md)                       | What REA established, what needed the driver or inference                  |
| [limitations.md](limitations.md)                         | Inaccessible and unverified behaviour                                      |
| [residual-matrix.md](residual-matrix.md)                 | Tracked coverage gaps with priorities                                      |
| [backlog.md](backlog.md)                                 | Prioritised implementation backlog with acceptance criteria                |
| [checkpoint.md](checkpoint.md)                           | Precise state of the open acceptance criteria                              |
| [readiness.md](readiness.md)                             | What stays open after s84, each item classified, and the one next step     |
| [final-review.md](final-review.md)                       | The final independent review: its findings, handling and what stays open   |
| [readiness.md](readiness.md)                             | What stays open after the last session, classified, and the next step      |
| [evidence/](evidence/)                                   | Sanitized, generated evidence index and probe summaries                    |

The tooling is in [research/excalidraw](../../research/excalidraw/README.md). Raw screenshots,
ARIA snapshots, timelines and REA bundles are kept outside the repository by policy.
