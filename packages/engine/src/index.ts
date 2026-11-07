/**
 * The public entry of `@planewright/engine`. The engine exports its types and, once the editor
 * exists, one constructor (docs/architecture/engine/modules.md#public-surface); every layer stays
 * internal to the package.
 */
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
export type { HistoryEntry, HistoryLabel, HistorySelection } from './history/entry.ts';
export type { History, HistoryLimits } from './history/history.ts';
export type { CommitOptions, Transaction } from './history/transaction.ts';
