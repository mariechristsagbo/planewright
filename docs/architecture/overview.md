# Architecture overview

This document describes the foundation as it exists today. It will grow as investigations
complete and ADRs are accepted.

## Components

```text
┌───────────────────────┐        WebSocket /ws         ┌───────────────────────────┐
│ apps/web              │  ─────────────────────────▶  │ apps/collab               │
│ React + Vite          │  (not connected yet)         │ Node.js http + ws         │
│ status page only      │                              │ /healthz, hello handshake │
└──────────┬────────────┘                              └─────────────┬─────────────┘
           │ imports                                                 │ imports
           ▼                                                         ▼
                    ┌──────────────────────────────────┐
                    │ packages/protocol                │
                    │ protocol version 0, message types │
                    └──────────────────────────────────┘
```

### apps/web

A React 19 application built with Vite 8. It renders a factual status page that labels the
build as a foundation and lists capabilities that are not implemented yet. It imports the
protocol version to prove that workspace linking works.

### apps/collab

A Node.js service with no framework:

- `src/config.ts` reads `PLANEWRIGHT_COLLAB_*` variables and rejects invalid values at startup.
- `src/server.ts` serves `GET /healthz` and accepts WebSocket upgrades only on `/ws` and only
  from allowlisted `Origin` values. Every accepted client receives `server.hello`; any client
  message is answered with `server.error` / `not_implemented`. Message size is limited by
  `maxPayload`.
- `src/main.ts` wires configuration, logging and graceful shutdown on `SIGINT` and `SIGTERM`.

Logs are JSON lines on stdout.

### packages/protocol

Runtime-agnostic TypeScript definitions with no DOM or Node.js dependencies. Protocol version 0
contains only the server hello and error messages and has no compatibility guarantees.

### packages/engine

The canvas engine's package ([ADR 0004](../adr/0004-canvas-engine-package-boundaries.md)):
ECMAScript-only TypeScript that reaches the platform through ports. It holds the `math` layer
(vectors, affine matrices, axis-aligned and oriented boxes, angles, tolerances and a seeded random
source), the clock, scheduler and identifier ports, the `model` layer (the document's types,
order keys, point normalisation, the initial default style, element patches and the validating
codec), the world and content bounds in `geometry`, the `camera` layer (screen and scene
transforms, pan, zoom, the zoom ladder, zoom to fit, two-pointer maths, resizing and limits), the
`scene` layer (the scene store with its change sets, indexes, transient previews and transactions)
and the `history` module: undo and redo entries, burst merging and conflict-safe undo. No
application imports it yet.

## Decisions and what stays open

The [canvas-engine architecture](engine/README.md) (issue #3) decides how the editor is built,
traced to the behavioural baseline of issue #1. Its ADRs are accepted. ENG-01 (issue #5) created
the engine package with its boundary checks, its math layer and its ports, ENG-02 (issue #7)
added the document model and its codec, ENG-03 (issue #9) the scene store, ENG-04 (issue #11)
the undo and redo history and ENG-05 (issue #13) the camera; the rest is not implemented yet:

- storage, beyond the element model and codec of ENG-02 and the scene store of ENG-03:
  [ADR 0005](../adr/0005-document-model.md) and [ADR 0009](../adr/0009-persistence-and-interchange.md);
- rendering approach, hit testing and viewport culling: [ADR 0006](../adr/0006-canvas-rendering.md);
- input handling, tool architecture and undo/redo model, beyond the change sets and transactions
  of ENG-03 and the history of ENG-04:
  [ADR 0007](../adr/0007-history-model.md) and [ADR 0008](../adr/0008-input-tools-and-commands.md);
- package boundaries for the engine, in place since ENG-01, and for its renderer:
  [ADR 0004](../adr/0004-canvas-engine-package-boundaries.md);
- file formats: Planewright's own document and clipboard formats
  ([ADR 0009](../adr/0009-persistence-and-interchange.md)); no other application's format.

Still open, each for its own issue and ADR:

- the collaboration model (merge policy, transport, presence, room lifecycle, authentication and
  server persistence); [ADR 0010](../adr/0010-collaboration-ready-change-model.md) only fixes the
  interfaces that the engine keeps ready for it;
- the fonts behind the text families, the sketch styles and the dark-theme colour mapping, decided
  in the feature issues that need them.
