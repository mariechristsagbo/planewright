# Packages, modules and ports

This document fixes where engine code lives and which way dependencies point. The decision and its
alternatives are in [ADR 0004](../../adr/0004-canvas-engine-package-boundaries.md). Nothing here
exists yet; the first engine issue creates the packages.

## Packages

| Package                       | May use                                  | Depends on                                          | Holds                                                                                                             |
| ----------------------------- | ---------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `@planewright/engine`         | ECMAScript only: no DOM, no Node.js APIs | nothing at run time                                 | model, geometry, camera, scene store, history, selection, transforms, gestures, tools, commands, autosave, editor |
| `@planewright/render-canvas`  | Canvas 2D and its DOM types              | `@planewright/engine`                               | the renderer port's Canvas 2D implementation, path cache, colour resolution per theme                             |
| `@planewright/web` (existing) | the whole browser platform, React        | `@planewright/engine`, `@planewright/render-canvas` | canvas host, input adapter, text overlay, storage adapters, clipboard and files, accessibility layer, the shell   |
| `@planewright/protocol`       | ECMAScript only (unchanged)              | nothing                                             | wire messages; it may later import the engine's change types, never the reverse                                   |
| `@planewright/collab`         | Node.js (unchanged)                      | `@planewright/protocol`                             | unchanged until collaboration is designed                                                                         |

Both new packages follow the protocol package's pattern: private, source-only, `"type": "module"`,
`exports` pointing at `src/index.ts`, and erasable TypeScript with explicit `.ts` import extensions.
The engine's `tsconfig.json` sets `lib` to the ECMAScript library only, so a reference to `window`,
`document` or a DOM type fails type checking; an ESLint block for `packages/engine/**` also forbids
browser and Node.js globals.

## Engine layers

Each layer may import from the layers above it in this table and from its own layer, never from a
layer below. The first engine issue adds a test that reads every engine import and fails on a
violation.

| Layer | Modules                             | Responsibility                                                                                                  |
| ----- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1     | `math`, `ports`                     | vectors, affine matrices, boxes, angles, tolerances, a seeded random source; the ports that need no model types |
| 2     | `model`                             | identifiers, element kinds, styles, documents, order keys, defaults, the codec and its limits                   |
| 3     | `geometry`, `camera`                | per-kind outlines, bounds, distance functions and text layout; screen and scene transforms, zoom rules          |
| 4     | `scene`                             | the scene store, change sets, transient previews and the order, spatial, attachment and group indexes           |
| 5     | `history`, `selection`, `transform` | transactions, undo stack; selection state, hit testing, handle layout; move, resize, rotate and duplicate maths |
| 6     | `input`, `tools`                    | engine input events and the gesture recogniser; one reducer per tool                                            |
| 7     | `commands`                          | the command registry, the keymap and the default commands                                                       |
| 8     | `persistence`, `collab`             | the autosave scheduler over the repository port; the collaboration-ready types                                  |
| 9     | `editor`                            | the façade that wires ports, store, history, camera, tools and commands, and builds render frames               |

Modules stay small: the repository's limits (300 lines per module, 60 per function, complexity 10)
apply, so a layer is a directory of focused files, each with its unit test.

## Ports

The engine touches the platform only through these interfaces, passed to `createEditor`. Each has a
deterministic fake for tests. A port is defined in the lowest layer whose types it needs, so the
layer check holds for it too, and it is added by the issue that first uses it
([roadmap](roadmap.md#order-and-dependencies)).

| Port                 | Purpose                                                     | Defined in (layer) | Added by | Web implementation                                                    | Test fake                           |
| -------------------- | ----------------------------------------------------------- | ------------------ | -------- | --------------------------------------------------------------------- | ----------------------------------- |
| `Clock`              | current time in milliseconds                                | `ports` (1)        | ENG-01   | `performance.now()`                                                   | a manually advanced clock           |
| `Scheduler`          | run a task after a delay, or on the next frame; cancellable | `ports` (1)        | ENG-01   | `setTimeout`, `requestAnimationFrame`                                 | a queue flushed by the test         |
| `IdSource`           | new 128-bit identifiers as 22 base64url characters          | `ports` (1)        | ENG-01   | `crypto.getRandomValues`                                              | a counter-based sequence            |
| `TextMeasurer`       | width and line metrics of a string in a font                | `geometry` (3)     | ENG-06   | an offscreen 2D context's `measureText`                               | fixed advance per character         |
| `DocumentRepository` | load a document; save changes against a stored revision     | `persistence` (8)  | ENG-13   | IndexedDB ([ADR 0009](../../adr/0009-persistence-and-interchange.md)) | an in-memory map with the same rule |
| `Announcer`          | send a message to assistive technology                      | `editor` (9)       | ENG-14   | a polite live region                                                  | a recording array                   |

```ts
export interface Clock {
  now(): number;
}

export type Cancel = () => void;

export interface Scheduler {
  after(delayMs: number, task: () => void): Cancel;
  nextFrame(task: (time: number) => void): Cancel;
}

export interface IdSource {
  next(): string;
}

export interface TextMetrics {
  readonly width: number;
  readonly ascent: number;
  readonly descent: number;
}

export interface TextMeasurer {
  measure(text: string, font: FontSpec): TextMetrics;
}

export interface Announcer {
  announce(message: AnnouncementKey, values: Readonly<Record<string, string | number>>): void;
}
```

`TextMeasurer` sits in `geometry` because it measures a model `FontSpec`
([domain model](domain-model.md#text)) for `layoutText`. `DocumentRepository` is specified in
[persistence](persistence.md#repository-port). `AnnouncementKey`, the message an announcement
sends, is defined with the editor, which makes every announcement.

The renderer port (`Renderer`, with the `RenderFrame` it draws) is not passed to the editor: the web
app hands it the editor's frames
([rendering](rendering-and-hit-testing.md#render-frame-and-renderer-port)). It is defined in
`editor`, which builds the frames, and added by ENG-07.

## Public surface

The engine exports its types and one constructor. Everything else is internal to the package.

```ts
export interface EditorPorts {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly ids: IdSource;
  readonly text: TextMeasurer;
  readonly repository?: DocumentRepository;
  readonly announcer?: Announcer;
}

export interface Editor {
  /** Read-only views: document, selection, camera, tool, history, text session, save status. */
  readonly view: EditorView;
  /** Feed one engine input event (pointer, wheel, key, pinch) from the input adapter. */
  input(event: InputEvent): void;
  /** Run a registered command, for example from a menu, the palette or a test. */
  run(command: CommandId): CommandOutcome;
  /** Replace the selection, for example from the element list; never an undo step. */
  select(ids: readonly ElementId[]): void;
  /** Report the text area's whole value, or the end of the session, while a text is edited. */
  editText(edit: TextEdit): void;
  /** Start a save at once if anything is unsaved, for example when the page is hidden. */
  saveNow(): void;
  /** Carry out the user's choice after a save was refused as stale. */
  resolveStale(choice: 'load-newer' | 'keep-this'): void;
  /** Report the canvas size in CSS pixels and the device pixel ratio. */
  resize(size: ViewportSize): void;
  /** The next frame to draw, or null when no layer is dirty. */
  frame(): RenderFrame | null;
  subscribe(listener: (update: EditorUpdate) => void): Cancel;
  dispose(): void;
}

export function createEditor(ports: EditorPorts, stored?: StoredDocument): Editor;
```

`EditorPorts` gains each port with the issue that adds it. `repository` and `announcer` stay
optional, so that tests and the issues before ENG-13 and ENG-14 can create an editor without them.

React reads `editor.view` through `useSyncExternalStore` with `editor.subscribe`; it never reaches
into the scene store directly.

## Web app structure

The web app keeps its status page until the editor surface issue replaces it, and labels the build
as pre-release while P0 is incomplete (AGENTS.md: the UI stays factual).

| Directory (`apps/web/src`) | Holds                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `editor/`                  | `CanvasHost` (two canvases, resize observer, pointer capture), the input adapter, the editor provider |
| `editor/text/`             | the text-editing overlay positioned by the camera                                                     |
| `ui/`                      | toolbar, history buttons, zoom controls, notices; each control reads the command registry             |
| `a11y/`                    | the element list, the live region and focus management                                                |
| `platform/`                | IndexedDB repository, preferences, clipboard, files, text measurer, identifier source                 |

## Requirements served

The split serves the testability of every requirement and the performance rows REQ-F01 to
REQ-F04; the ports serve REQ-P01, REQ-P05, REQ-P06, REQ-K02 and REQ-Y04.
