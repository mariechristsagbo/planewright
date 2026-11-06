# Architecture decision records

ADRs record significant decisions, their context and their consequences. They use the format
introduced in [ADR 0001](0001-record-architecture-decisions.md).

| ADR                                              | Title                                                        | Status   |
| ------------------------------------------------ | ------------------------------------------------------------ | -------- |
| [0001](0001-record-architecture-decisions.md)    | Record architecture decisions                                | Accepted |
| [0002](0002-workspace-foundation.md)             | Workspace foundation                                         | Accepted |
| [0003](0003-clean-room-reference-policy.md)      | Clean-room reference policy                                  | Accepted |
| [0004](0004-canvas-engine-package-boundaries.md) | Canvas-engine package boundaries                             | Proposed |
| [0005](0005-document-model.md)                   | Document model                                               | Proposed |
| [0006](0006-canvas-rendering.md)                 | Canvas rendering behind a renderer port                      | Proposed |
| [0007](0007-history-model.md)                    | History as transactional change sets                         | Proposed |
| [0008](0008-input-tools-and-commands.md)         | Input pipeline, tool state machines and one command registry | Proposed |
| [0009](0009-persistence-and-interchange.md)      | Local persistence and the interchange format                 | Proposed |
| [0010](0010-collaboration-ready-change-model.md) | A collaboration-ready change model, without collaboration    | Proposed |

To propose a decision, copy the structure of an existing ADR into the next number and submit it
in the pull request that needs it. A proposed ADR becomes accepted when that pull request merges.
Superseded ADRs stay in place with their status updated.
