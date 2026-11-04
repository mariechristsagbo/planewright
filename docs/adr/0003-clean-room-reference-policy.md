# ADR 0003: Clean-room reference policy

- Status: Accepted
- Date: 2026-11-04

## Context

Planewright is an infinite canvas for drawing and diagrams, a product category in which
Excalidraw is a well-known open-source application. Users may expect familiar interactions, and
studying an established application's observable behaviour helps define good acceptance
criteria. Planewright must nevertheless remain an independent work with its own code, assets
and identity.

## Decision

1. **No Excalidraw code or assets.** Planewright does not depend on `@excalidraw/*` packages or
   any Excalidraw-derived package, and does not copy, transcribe or adapt Excalidraw source code,
   assets, fonts, icons, styles or documentation text.
2. **Behavioural reference only.** The public Excalidraw application may be observed to learn
   how features behave from a user's point of view. Findings are written in contributors' own
   words as behavioural descriptions, never as code.
3. **REA as methodology.** REA (Reverse Engineer Anything), an MIT-licensed analysis toolkit, may
   be used to structure and record behavioural investigations. Captured third-party bundles,
   sources or assets are never committed to this repository.
4. **No affiliation.** Planewright is not affiliated with, endorsed by or derived from Excalidraw
   or REA. Their names are used only to identify the references.
5. **Enforcement.** `npm run check:deps-policy` fails if any package whose name contains
   `excalidraw` appears in `package-lock.json`. The pull request template requires an explicit
   independent-implementation attestation.

## Consequences

- Every feature starts from an investigation and an independently written specification.
- Planewright may intentionally differ from the reference; differences are recorded in the
  feature issue or pull request.
- Contributors who have studied reference source code should describe behaviour, not structure,
  and must not reproduce it.
