# ADR 0004: Canvas-engine package boundaries

- Status: Accepted
- Date: 2026-11-06

## Context

The foundation has three workspaces: the web app, the collaboration service and the protocol
package ([ADR 0002](0002-workspace-foundation.md)). The canvas engine now needs a home. Its
behaviour must be testable without a browser: most requirements in the
[requirements trace](../architecture/engine/requirements.md) are geometry, state and history rules
whose tests should run in milliseconds in Node.js. Rendering, input, storage and the clipboard need
browser APIs. A later collaboration service will need the document model and its validation in
Node.js too, and image export may one day run in a worker.

## Decision

1. **`packages/engine` (`@planewright/engine`)** holds the document model, scene store, geometry,
   camera, hit testing, selection and transforms, history, gestures, tool state machines, the
   command registry, the autosave scheduler and the collaboration-ready types. It is source-only,
   like the protocol package, has **no runtime dependencies**, and uses **no DOM and no Node.js
   API**: its `tsconfig.json` leaves the `DOM` library out, and an ESLint block forbids browser and
   Node.js globals in it.
2. **`packages/render-canvas` (`@planewright/render-canvas`)** implements the engine's renderer port
   with the Canvas 2D API. It may use DOM canvas types and depends on the engine only.
3. **`apps/web`** owns everything that touches the page: React components, the canvas host and its
   input adapter, the text-editing overlay, IndexedDB and `localStorage` adapters, clipboard and
   file access, and the accessibility layer. It depends on both packages.
4. **Ports.** The engine reaches the platform only through interfaces passed when an editor is
   created: a clock, a frame scheduler, an identifier source, a text measurer, a document
   repository and an announcer. Tests pass deterministic fakes. Each port is defined in the lowest
   layer whose types it needs and arrives with the issue that first uses it: the clock, scheduler
   and identifier source in a `ports` module beside `math`, the text measurer in `geometry`
   (it measures a model font), the repository in `persistence` and the announcer in `editor`. The
   renderer port, which the web app calls with the editor's frames, is defined in `editor`.
5. **Layers inside the engine.** Modules import only from the layers below them, in this order:
   `math` and `ports`; `model`; `geometry` and `camera`; `scene`; `history`, `selection` and
   `transform`; `input` and `tools`; `commands`; `persistence` and `collab`; `editor`. The first
   engine issue adds a test that fails on an import against this order.
6. **Protocol direction.** The protocol package stays independent of the engine for now. When
   collaboration is designed it may import the engine's serialisable change types, never the
   reverse, and the collaboration service may import the engine's document validation.

## Alternatives considered

- **The engine inside `apps/web`.** Rejected: nothing would stop DOM types from leaking into
  geometry and history, and the model could not be reused by the collaboration service or a
  worker.
- **One package per concern** (geometry, history, tools and so on). Rejected for now: the package
  overhead buys nothing that the layer check does not already give. A layer can still become a
  package later without changing its imports' direction.
- **A general state library** (a store or statechart framework). Rejected: it adds a dependency
  and often a UI-framework coupling for problems that plain reducers and a typed store solve.

## Consequences

- The workspace list in the root `package.json` grows by two, and Vitest gains the projects
  `engine:unit`, `engine:integration` and `render-canvas:unit`. Coverage already includes
  `packages/*/src/**`.
- Engine tests run in the Node.js environment without jsdom; only the web app's tests use jsdom.
- The dependency direction is web → render-canvas → engine, web → engine, and later collab →
  protocol → engine. [ADR 0002](0002-workspace-foundation.md) is extended, not superseded.
- Requirements served: the split makes every requirement of the trace testable in isolation, and
  it is a precondition of REQ-F01 to REQ-F04, whose hot paths stay free of UI code.
