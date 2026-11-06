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
export type { Fill, FontFamily, FontSpec, Stroke, Style, TextBlock } from './model/style.ts';
