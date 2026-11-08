/**
 * The public entry of `@planewright/engine` (docs/architecture/engine/modules.md#public-surface).
 * The engine exports its types, the editor, the editor's render loop and the pure geometry
 * functions that a renderer draws with: each kind's outline, an element's local box and text
 * layout. Everything else stays internal to the package.
 */
export { createEditor } from './editor/editor.ts';
export { createRenderLoop } from './editor/render-loop.ts';
export { geometryOf } from './geometry/kinds.ts';
export { layoutText } from './geometry/text-layout.ts';
export { localBox } from './geometry/world-bounds.ts';
export type { Cancel, Clock, IdSource, Scheduler } from './ports/ports.ts';
export type { CodecError, CodecProblem, Decoded } from './model/codec.ts';
export type { Color } from './model/color.ts';
export type { CanvasState, DocumentState, GroupRecord } from './model/document.ts';
export type {
  ArrowElement,
  ArrowHead,
  Attachment,
  Box,
  Element,
  ElementKind,
  FrameElement,
  FreehandElement,
  ImageElement,
  LineElement,
  NoteElement,
  Point,
  ShapeElement,
  TextElement,
} from './model/elements.ts';
export type { ClientId, ElementId, FileId, GroupId } from './model/ids.ts';
export type { OrderKey } from './model/order-key.ts';
export type { ElementPatch } from './model/patch.ts';
export type { Fill, FontFamily, FontSpec, Stroke, Style, TextBlock } from './model/style.ts';
export type {
  CanvasChange,
  ChangeOrigin,
  ChangeSet,
  ChangeStamp,
  ElementChange,
  GroupChange,
} from './scene/change-set.ts';
export type { ChangeError, ChangeProblem } from './scene/check.ts';
export type { ApplyOptions, SceneReader, SceneStore, SceneUpdate } from './scene/store.ts';
export type { SceneTransaction } from './scene/transaction.ts';
export type { Camera } from './camera/camera.ts';
export type { ViewportSize } from './camera/viewport.ts';
export type { KindGeometry, PathCommand } from './geometry/path.ts';
export type { TextLayout, TextLine } from './geometry/text-layout.ts';
export type { TextMeasurer, TextMetrics } from './geometry/text-measurer.ts';
export type { HistoryEntry, HistoryLabel, HistorySelection } from './history/entry.ts';
export type { History, HistoryLimits } from './history/history.ts';
export type { CommitOptions, Transaction } from './history/transaction.ts';
export type { SelectionFrame } from './selection/frame.ts';
export type { Handle, HandleId } from './selection/handles.ts';
export type { HitResult, HitView } from './selection/hit-test.ts';
export type { PointerKind } from './selection/pointer.ts';
export type { Selection } from './selection/selection.ts';
export type { RenderState } from './editor/frame.ts';
export type { OverlayPrimitive, RenderFrame, Renderer, Theme } from './editor/render-frame.ts';
export type { RenderLoop } from './editor/render-loop.ts';
export type {
  Editor,
  EditorCommand,
  EditorPorts,
  EditorView,
  TextEdit,
  TextEditView,
} from './editor/editor.ts';
export type {
  FocusLost,
  InputEvent,
  KeyInput,
  Modifiers,
  PointerButton,
  PointerInput,
  WheelInput,
} from './input/events.ts';
export type { KeyChord } from './commands/chords.ts';
export type { CommandId, CommandOutcome } from './commands/registry.ts';
export type { CursorKind, ToolId } from './tools/tool.ts';
