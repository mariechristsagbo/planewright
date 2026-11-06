# Behavioural investigation

Planewright features are specified from observed behaviour before they are designed or
implemented. This directory holds investigation write-ups and evidence summaries.

## Why investigate first

An infinite canvas has many interactions that users take for granted: selection, snapping,
keyboard shortcuts, zoom and pan, text editing, grouping and collaboration. Writing these down
as testable behaviour before coding produces clearer acceptance criteria and keeps Planewright's
implementation independent.

## Process

1. Open a **Behavioural investigation** issue with the questions to answer, the scope and
   reference, and the method.
2. Observe the reference application, for example the public Excalidraw application in guest
   mode, through black-box use and, where helpful, REA-assisted runtime observation.
3. Write findings in your own words as observable behaviour: inputs, states, outputs, edge cases
   and timing. Add them to the issue and, for durable reference, to a Markdown file in this
   directory named `<issue>-<kebab-topic>.md`.
4. Derive feature issues with acceptance criteria from the findings, noting any intentional
   differences.

## Rules

- Record behaviour, not implementation. Do not paste, transcribe or paraphrase third-party
  source code.
- Never commit captured bundles, source maps, fonts, icons, images or other third-party assets.
  Keep raw captures outside the repository.
- Screenshots of a reference application may be used privately during an investigation, but are
  not committed.
- Stay within the terms, licences and authorisation that apply to the reference.
- REA and Excalidraw are references only; Planewright is not affiliated with either. See
  [ADR 0003](../adr/0003-clean-room-reference-policy.md).

## Status

Issue #1 has produced a first guest-mode baseline in
[docs/reverse-engineering](../reverse-engineering/README.md); its pointer here is
[1-guest-mode-baseline.md](1-guest-mode-baseline.md). It is not exhaustive: open cases are
tracked in its residual matrix, and no feature issue has been derived from it yet. The proposed
[canvas-engine architecture](../architecture/engine/README.md) traces its requirements to it.
