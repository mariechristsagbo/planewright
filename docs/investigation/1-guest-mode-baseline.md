# Issue #1: guest-mode behavioural baseline

This is the durable pointer for investigation issue #1. The full write-up lives in
[docs/reverse-engineering](../reverse-engineering/README.md), because the issue asked for that
location and set of documents.

- **What was observed:** the public reference whiteboard, used as an unauthenticated guest, on
  desktop (1280×720, light and dark) and on emulated mobile (390×844, DPR 3, touch). See the
  [feature inventory](../reverse-engineering/feature-inventory.md) and the
  [behaviour analysis](../reverse-engineering/behavior-analysis.md).
- **How:** REA as the passive evidence system and an external Playwright driver for canvas input,
  on one disposable, isolated browser. The tooling is in
  [research/excalidraw](../../research/excalidraw/README.md) and the rules are in the
  [methodology](../reverse-engineering/methodology.md).
- **Evidence:** a sanitized, generated index in `docs/reverse-engineering/evidence/`. Raw captures
  stay outside the repository.
- **Status:** the issue stays open. The remaining gaps, blockers and the next steps are tracked in
  the [checkpoint](../reverse-engineering/checkpoint.md) and the
  [residual matrix](../reverse-engineering/residual-matrix.md). No feature issue has been derived
  yet.
