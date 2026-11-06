import type { Aabb } from '../math/aabb.ts';
import type { Vec } from '../math/vector.ts';
import type { ElementId, FileId, GroupId } from './ids.ts';
import type { OrderKey } from './order-key.ts';
import type { Style, TextBlock } from './style.ts';

/** A point in scene units; the same shape as the math layer's vector. */
export type Point = Vec;

/** A box in scene units, or in an image's own pixels for a crop. */
export type Box = Aabb;

/** Every kind; P0 implements the first six, and the others are fixed now for P1 and P2. */
export const ELEMENT_KINDS = [
  'rectangle',
  'ellipse',
  'diamond',
  'line',
  'freehand',
  'text',
  'arrow',
  'note',
  'image',
  'frame',
] as const;

export const ARROW_HEADS = ['none', 'arrow', 'triangle', 'dot', 'bar'] as const;
export const ARROW_ROUTES = ['straight', 'curved', 'elbow'] as const;

/**
 * The fields of every element. The origin `x, y` is the top-left corner of the unrotated local
 * box, and `rotation`, in [0, 2π), turns that box about its centre
 * (docs/architecture/engine/domain-model.md#geometry-of-an-element).
 */
interface ElementCommon {
  readonly id: ElementId;
  readonly order: OrderKey;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly style: Style;
  /** P1 behaviour (REQ-M07); always false in P0. */
  readonly locked: boolean;
  /** The innermost group, P1 (REQ-M04). */
  readonly group?: GroupId;
  /** P1 (REQ-M08). */
  readonly link?: string;
  /** Raised by every change to this element. */
  readonly rev: number;
}

export interface ShapeElement extends ElementCommon {
  readonly kind: 'rectangle' | 'ellipse' | 'diamond';
  readonly width: number;
  readonly height: number;
  /** P1 (REQ-M02). */
  readonly label?: TextBlock;
}

/** Point kinds store points relative to the origin, normalised to a smallest x and y of 0. */
export interface LineElement extends ElementCommon {
  readonly kind: 'line';
  /** At least 2. */
  readonly points: readonly Point[];
}

export interface FreehandElement extends ElementCommon {
  readonly kind: 'freehand';
  /** At least 1; one point is a dot (REQ-C07). */
  readonly points: readonly Point[];
  /** One per point in [0, 1], kept when reported (REQ-C08). */
  readonly pressures?: readonly number[];
}

export interface TextElement extends ElementCommon {
  readonly kind: 'text';
  /** Measured, so that a document lays out and hit-tests without its fonts. */
  readonly width: number;
  readonly height: number;
  readonly content: TextBlock;
}

export interface Attachment {
  readonly target: ElementId;
  /** In [0, 1] × [0, 1] of the target's local box. */
  readonly anchor: Point;
}

export type ArrowHead = (typeof ARROW_HEADS)[number];

/** P1 (REQ-M01). */
export interface ArrowElement extends ElementCommon {
  readonly kind: 'arrow';
  /** At least 2. */
  readonly points: readonly Point[];
  readonly start?: Attachment;
  readonly end?: Attachment;
  readonly heads: { readonly start: ArrowHead; readonly end: ArrowHead };
  readonly route: (typeof ARROW_ROUTES)[number];
  readonly label?: TextBlock;
}

/** P1 (REQ-M03). */
export interface NoteElement extends ElementCommon {
  readonly kind: 'note';
  /** Equal to the height while the note keeps its default shape. */
  readonly width: number;
  readonly height: number;
  readonly label: TextBlock;
}

/** P2 (REQ-M10). */
export interface ImageElement extends ElementCommon {
  readonly kind: 'image';
  readonly width: number;
  readonly height: number;
  readonly file: FileId;
  readonly crop?: Box;
}

/** P2 (REQ-M09); membership is decided in its issue. */
export interface FrameElement extends ElementCommon {
  readonly kind: 'frame';
  readonly width: number;
  readonly height: number;
  readonly name: string;
}

export type Element =
  | ShapeElement
  | LineElement
  | FreehandElement
  | TextElement
  | ArrowElement
  | NoteElement
  | ImageElement
  | FrameElement;

export type ElementKind = Element['kind'];
