import type { Element, Point } from '../model/elements.ts';

// Outlines and the geometry of each kind, in an element's local frame
// (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

/** One step of an outline in local coordinates, which the renderer and the SVG export draw. */
export type PathCommand =
  | { readonly op: 'move'; readonly to: Point }
  | { readonly op: 'line'; readonly to: Point }
  | { readonly op: 'cubic'; readonly c1: Point; readonly c2: Point; readonly to: Point }
  | { readonly op: 'close' };

/** The three pure functions that every kind with a geometry has, all in its local frame. */
export interface KindGeometry<E extends Element> {
  outline(element: E): readonly PathCommand[];
  /** Signed distance to the outline's centre line: negative inside closed kinds. */
  distance(element: E, local: Point): number;
  isClosed(element: E): boolean;
}

export const moveTo = (to: Point): PathCommand => ({ op: 'move', to });

export const lineTo = (to: Point): PathCommand => ({ op: 'line', to });

export const cubicTo = (c1: Point, c2: Point, to: Point): PathCommand => ({
  op: 'cubic',
  c1,
  c2,
  to,
});

export const CLOSE: PathCommand = { op: 'close' };

/** How far along its tangents a cubic's control points lie for a quarter circle of radius 1. */
export const ARC_KAPPA = (4 * (Math.SQRT2 - 1)) / 3;

/** The corner radius of round rectangles and diamonds: min(16, a quarter of the shorter side). */
export const cornerRadius = (width: number, height: number): number =>
  Math.min(16, Math.min(width, height) / 4);
