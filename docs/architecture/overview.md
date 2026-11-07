# Architecture overview

This document describes the foundation as it exists today. It will grow as investigations
complete and ADRs are accepted.

## Components

```text
┌───────────────────────┐        WebSocket /ws         ┌───────────────────────────┐
│ apps/web              │  ─────────────────────────▶  │ apps/collab               │
│ React + Vite          │  (not connected yet)         │ Node.js http + ws         │
│ navigation-only page  │                              │ /healthz, hello handshake │
└──────────┬────────────┘                              └─────────────┬─────────────┘
           │ imports                                                 │ imports
           ▼                                                         ▼
                    ┌──────────────────────────────────┐
                    │ packages/protocol                │
                    │ protocol version 0, message types │
                    └──────────────────────────────────┘
```

### apps/web

A React 19 application built with Vite 8. It renders a navigation-only editor surface (ENG-08): a
canvas host whose scene and overlay canvases the canvas renderer draws, an input adapter that
sends DOM events to the engine's editor, a tool bar and Undo and Redo controls. The page labels the
build as pre-release, says that nothing can be drawn, selected or edited yet, and lists the
capabilities that are not implemented. It imports the protocol version to prove that workspace
linking works.

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
codec), the `geometry` layer (world and content bounds, per-kind outlines and distances, the text
measurer port and text layout), the `camera` layer (screen and scene transforms, pan, zoom, the
zoom ladder, zoom to fit, two-pointer maths, resizing and limits), the `scene` layer (the scene
store with its change sets, indexes, transient previews and transactions), the `history` module
(undo and redo entries, burst merging and conflict-safe undo), the `selection` module (the
selection state, hit testing, handle layout and box selection), the `input` layer (input events,
the gesture recogniser and the viewport routing), the `tools` layer (the Hand tool), the `commands`
layer (the command registry and its keymap) and the `editor` layer (render frames, the renderer
port, culling, the render loop with its dirty tracking and frame scheduling, and `createEditor`).
The web app imports it.

### packages/render-canvas

The Canvas 2D implementation of the engine's renderer port
([ADR 0006](../adr/0006-canvas-rendering.md)), which depends on the engine only. It draws a render
frame's scene part on a scene canvas and its overlay part on an overlay canvas, sizes their backing
stores to the device pixel ratio, and caches each element's path and text layout per revision. It
is tested against a recording fake of the 2D context; the web app's canvas host draws with it.

## Decisions and what stays open

The [canvas-engine architecture](engine/README.md) (issue #3) decides how the editor is built,
traced to the behavioural baseline of issue #1. Its ADRs are accepted. ENG-01 (issue #5) created
the engine package with its boundary checks, its math layer and its ports, ENG-02 (issue #7)
added the document model and its codec, ENG-03 (issue #9) the scene store, ENG-04 (issue #11)
the undo and redo history, ENG-05 (issue #13) the camera, ENG-06 (issue #15) the geometry, text
layout and hit testing, ENG-07 (issue #17) the render loop and the canvas renderer, and ENG-08
(issue #19) the navigation-only editor surface; the rest is not implemented yet:

- storage, beyond the element model and codec of ENG-02 and the scene store of ENG-03:
  [ADR 0005](../adr/0005-document-model.md) and [ADR 0009](../adr/0009-persistence-and-interchange.md);
- drawing elements on the page, beyond the render loop, culling and canvas renderer of ENG-07, the
  hit testing of ENG-06 and the canvas host of ENG-08:
  [ADR 0006](../adr/0006-canvas-rendering.md);
- the drawing and selection tools, beyond the change sets and transactions of ENG-03, the history
  of ENG-04 and the input, gestures, Hand tool and commands of ENG-08:
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
