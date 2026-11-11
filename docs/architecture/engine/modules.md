# Packages, modules and ports

This document fixes where engine code lives and which way dependencies point. The decision and its
alternatives are in [ADR 0004](../../adr/0004-canvas-engine-package-boundaries.md). ENG-01 created
`@planewright/engine` with its `math` and `ports` modules, its ESLint block and its layer check,
ENG-02 added the `model` layer, ENG-03 the `scene` layer with the world bounds that start
`geometry`, ENG-04 the `history` module, ENG-05 the `camera` layer with the content bounds in
`geometry`, ENG-06 the rest of `geometry` (outlines, distances, the text measurer port and text
layout) and the `selection` module, ENG-07 the `editor` layer's render frames, renderer port and
render loop and the `@planewright/render-canvas` package, ENG-08 the `input`, `tools` and
`commands` layers and `createEditor`, and ENG-13 the `persistence` layer with the repository port
and autosave; the other layers arrive with the issues that need them.

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
browser and Node.js globals, and the triple-slash directives and ambient declarations that would get
around either check.

## Engine layers

Each layer may import from the layers above it in this table and from its own layer, never from a
layer below. `scripts/tests/engine-layers.test.ts` reads every engine import and fails on a
violation, on a file in a directory that no layer names, and on any difference between this table
and the copy of it in `scripts/lib/engine-layers.ts`.

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
| `Announcer`          | send a message to assistive technology                      | `editor` (9)       | ENG-14   | a polite live region, assertive for saves                             | a recording array                   |

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
`editor`, which builds the frames, and was added by ENG-07: the web app registers a listener with
the render loop's `onFrame` and calls `render` with each frame it is handed
([what ENG-07 decided](rendering-and-hit-testing.md#what-eng-07-decided)).

## Public surface

The engine exports its types, one constructor and, for renderers, the render loop and the pure
geometry functions they draw with (`createRenderLoop`, `geometryOf`, `localBox` and `layoutText`,
since ENG-07), and, for storage adapters, `createRecordRepository`, which keeps the revision rule
and the codec in the engine (since ENG-13, [what ENG-13 decided](persistence.md#what-eng-13-decided)). Everything else is internal to the package. The one constructor, `createEditor`,
came with the editor surface (ENG-08) and composes the render loop; the selection issue (ENG-09)
added the selection to it. Its surface so far
([what ENG-08 decided](interaction.md#what-eng-08-decided),
[what ENG-09 decided](interaction.md#what-eng-09-decided); the transforms issue, ENG-10, added no
method: its gestures reach the Selection tool through `input`, and Duplicate, Delete and the nudges
are commands that `run` and the keymap reach; nor did the creation tools issue, ENG-11, whose tools
and tool lock are commands too, while the view gained `toolLock`,
[what ENG-11 decided](interaction.md#what-eng-11-decided); the text issue, ENG-12, added the `text`
port, `editText` and the view's `text`, [what ENG-12 decided](interaction.md#what-eng-12-decided);
the persistence issue, ENG-13, added the `repository` port, the stored document, `measureTexts`,
`saveNow`, `resolveStale` and the view's `save`,
[what ENG-13 decided](persistence.md#what-eng-13-decided)):

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
  /**
   * Read-only view: tool, tool lock, cursor, camera, selection, Undo and Redo, the edited text, the
   * save status and the listed elements.
   */
  readonly view: EditorView;
  /** The registry's commands with their labels, shortcuts and tools, tools in tool bar order. */
  readonly commands: readonly EditorCommand[];
  /** Feed one input event; true for a wheel event or a key press that is a command's chord. */
  input(event: InputEvent): boolean;
  /** Run a registered command, for example from the tool bar or a test. */
  run(command: CommandId): CommandOutcome;
  /** Replace the selection, for example from the element list; never an undo step. */
  select(ids: readonly ElementId[]): void;
  /** The text area's value, measured again, or the end of the session on Escape or Mod+Enter. */
  editText(edit: TextEdit): void;
  /** Report the canvas size in CSS pixels and the device pixel ratio. */
  resize(size: ViewportSize): void;
  /** Measure every text again, as when a font finishes loading; no undo step. */
  measureTexts(): void;
  /** Start a waiting save at once, as when the page is hidden or unloaded. */
  saveNow(): void;
  /** Answer a stale save: load the newer stored version, or keep this one. */
  resolveStale(choice: 'load' | 'keep'): Promise<void>;
  /** Hand the listener every frame built on an animation frame, starting with a full one. */
  onFrame(listener: (frame: RenderFrame) => void): Cancel;
  subscribe(listener: (view: EditorView) => void): Cancel;
  dispose(): void;
}

export function createEditor(ports: EditorPorts, stored?: StoredDocument): Editor;
```

The accessibility issue, ENG-14, added the `announcer` port, the view's `elements` and the Enter
command, which complete the designed surface
([what ENG-14 decided](quality.md#what-eng-14-decided)). `repository` and `announcer` stay optional, so that tests can create an editor
without them, and an editor without a repository saves nothing and reports a `null` save status.
The engine's tests open fixture documents with `openEditor(ports, document)`, which the entry does
not export.

React reads `editor.view` through `useSyncExternalStore` with `editor.subscribe`; it never reaches
into the scene store directly.

## Web app structure

The editor surface issue (ENG-08) replaced the web app's status page with a navigation-only editor
surface, and slice S2 of v0.2 (issue #55, [ADR 0012](../../adr/0012-v02-editor-chrome.md)) put it
in the editor's full-bleed shell. The page labels the build as pre-release with a persistent tag
that opens About this build, which says what does not work (AGENTS.md: the UI stays factual).

| Directory (`apps/web/src`) | Holds                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell/`                   | `EditorShell`, which places the islands around the canvas, its state, the identity island with the mark and the Pre-release tag, the Elements toggle with its count and the drawer, with its focus moves and the phone's sheet, the empty-canvas note, the Keyboard shortcuts button, the 35 original glyphs with the `Icon` component that draws them, and the kinds' glyphs |
| `shell/menu/`              | the identity island's menu: its button, the menu and its items                                                                                                                                                                                                                                                                                                                |
| `shell/tooltip/`           | the one tooltip and its listeners, delegated to the shell's root and its document                                                                                                                                                                                                                                                                                             |
| `shell/dialogs/`           | the modal dialog's behaviour, About this build and Keyboard shortcuts                                                                                                                                                                                                                                                                                                         |
| `shell/selection/`         | the selection panel, the phone's selection bar and Details sheet, what they read of the view, and the selection's pure geometry                                                                                                                                                                                                                                               |
| `editor/`                  | `CanvasHost` (two canvases, resize observer, pointer capture), the input adapter, the editor provider                                                                                                                                                                                                                                                                         |
| `editor/text/`             | the text-editing overlay positioned by the camera                                                                                                                                                                                                                                                                                                                             |
| `ui/`                      | the tool bar shown as the palette, history buttons, zoom controls, view readout, the problem chip and the storage notices with their pure rules; controls read the command registry                                                                                                                                                                                           |
| `a11y/`                    | the element list, the figures' rounding that its names and the selection share, the live region, the sentence after a failed save succeeds again (`save-recovery.ts`) and focus management                                                                                                                                                                                    |
| `platform/`                | IndexedDB backend, storage start-up, page events, preferences, clipboard, files, text measurer, ports                                                                                                                                                                                                                                                                         |
| `styles/`                  | the tokens, fonts and base, the controls', canvas's, list's and saving's rules, the shell's layout, islands and dialogs, the glyph buttons', the Elements toggle's and drawer's, the selection panel's, bar's and sheet's, the menu's and the tooltip's rules, and its media queries                                                                                          |

## Requirements served

The split serves the testability of every requirement and the performance rows REQ-F01 to
REQ-F04; the ports serve REQ-P01, REQ-P05, REQ-P06, REQ-K02 and REQ-Y04.
