import { geometryOf } from '../geometry/kinds.ts';
import { aabbExpand } from '../math/aabb.ts';
import type { Aabb } from '../math/aabb.ts';
import type { Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';

// What box selection compares a marquee with, element by element
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-35-decided). The numbers are
// computed operation for operation as `worldBounds` and the outline points of REQ-S06 compute
// them, without building the points, so that a row holds exactly their values.

/** The numbers that decide whether a marquee encloses an element. */
export interface EnclosureRow {
  readonly id: ElementId;
  /** Whether the element's kind has a geometry; a kind without one is never enclosed. */
  readonly enclosable: boolean;
  /** The edges of the world bounds, which the spatial index compares a query box with. */
  readonly boundsLeft: number;
  readonly boundsTop: number;
  readonly boundsRight: number;
  readonly boundsBottom: number;
  /** The smallest and largest x and y of the outline points that must lie in the marquee. */
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The smallest and largest x and y seen so far. */
interface Extent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const noExtent = (): Extent => ({
  left: Infinity,
  top: Infinity,
  right: -Infinity,
  bottom: -Infinity,
});

function widen(extent: Extent, x: number, y: number): void {
  extent.left = Math.min(extent.left, x);
  extent.top = Math.min(extent.top, y);
  extent.right = Math.max(extent.right, x);
  extent.bottom = Math.max(extent.bottom, y);
}

/** The extent of a point kind's local points, whose size `localBox` takes. */
function pointsExtent(points: readonly Point[]): Extent {
  const extent = noExtent();
  for (const { x, y } of points) widen(extent, x, y);
  return extent;
}

/** An element's turn about the centre of its local box, as `obbToScene` turns a local point. */
interface Turn {
  readonly x: number;
  readonly y: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly cos: number;
  readonly sin: number;
}

const turnOf = (element: Element, width: number, height: number): Turn => ({
  x: element.x,
  y: element.y,
  centerX: element.x + width / 2,
  centerY: element.y + height / 2,
  cos: Math.cos(element.rotation),
  sin: Math.sin(element.rotation),
});

/** Widens the extent by the scene position of a local point, turned as `obbToScene` turns it. */
function widenTurned(extent: Extent, turn: Turn, x: number, y: number): void {
  const dx = turn.x + x - turn.centerX;
  const dy = turn.y + y - turn.centerY;
  widen(
    extent,
    turn.centerX + (dx * turn.cos - dy * turn.sin),
    turn.centerY + (dx * turn.sin + dy * turn.cos),
  );
}

/** The extent of the local box's four turned corners, as `obbBounds` takes it. */
function cornersExtent(turn: Turn, width: number, height: number): Extent {
  const extent = noExtent();
  widenTurned(extent, turn, 0, 0);
  widenTurned(extent, turn, width, 0);
  widenTurned(extent, turn, width, height);
  widenTurned(extent, turn, 0, height);
  return extent;
}

/** An extent as the box that `aabbFromPoints` makes of the same points. */
const boxOf = ({ left, top, right, bottom }: Extent): Aabb => ({
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
});

/** A row from the box that the stroke grows into the world bounds, and the outline's extent. */
function rowOf(element: Element, unexpanded: Aabb, outline: Extent): EnclosureRow {
  const bounds = aabbExpand(unexpanded, element.style.stroke.width / 2);
  return {
    id: element.id,
    enclosable: geometryOf(element) !== undefined,
    boundsLeft: bounds.x,
    boundsTop: bounds.y,
    boundsRight: bounds.x + bounds.width,
    boundsBottom: bounds.y + bounds.height,
    left: outline.left,
    top: outline.top,
    right: outline.right,
    bottom: outline.bottom,
  };
}

/**
 * A point kind's row. Unturned, each point is only moved by the origin, and rounding keeps the
 * order of sums that share an addend, so the extent of the moved points is the extent moved.
 */
function pointRow(element: Element, points: readonly Point[]): EnclosureRow {
  const local = pointsExtent(points);
  const width = local.right - local.left;
  const height = local.bottom - local.top;
  if (element.rotation === 0) {
    const { x, y } = element;
    const moved = {
      left: x + local.left,
      top: y + local.top,
      right: x + local.right,
      bottom: y + local.bottom,
    };
    return rowOf(element, { x, y, width, height }, moved);
  }
  const turn = turnOf(element, width, height);
  const outline = noExtent();
  for (const point of points) widenTurned(outline, turn, point.x, point.y);
  return rowOf(element, boxOf(cornersExtent(turn, width, height)), outline);
}

/**
 * A box kind's row: its outline is its local box's four corners. Unturned, the origin is the
 * top-left corner itself, which the origin plus 0 equals in every comparison.
 */
function boxRow(element: Element, width: number, height: number): EnclosureRow {
  if (element.rotation === 0) {
    const { x, y } = element;
    const corners = { left: x, top: y, right: x + width, bottom: y + height };
    return rowOf(element, { x, y, width, height }, corners);
  }
  const corners = cornersExtent(turnOf(element, width, height), width, height);
  return rowOf(element, boxOf(corners), corners);
}

/**
 * An element's row: the edges of its world bounds, the axis-aligned bounds of its turned local box
 * grown by half its stroke, and the extent of its outline points, every point of a point kind and
 * the four corners of a box kind, moved by the origin alone when it is not turned.
 */
export const enclosureRow = (element: Element): EnclosureRow =>
  'points' in element
    ? pointRow(element, element.points)
    : boxRow(element, element.width, element.height);

/** A marquee's edges, as `aabbIntersects` and `aabbContainsPoint` compute its far ones. */
export interface MarqueeEdges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const marqueeEdges = (marquee: Aabb): MarqueeEdges => ({
  left: marquee.x,
  top: marquee.y,
  right: marquee.x + marquee.width,
  bottom: marquee.y + marquee.height,
});

/** Whether the world bounds meet the marquee, edges included, as for a spatial index candidate. */
const meets = (row: EnclosureRow, marquee: MarqueeEdges): boolean =>
  row.boundsLeft <= marquee.right &&
  marquee.left <= row.boundsRight &&
  row.boundsTop <= marquee.bottom &&
  marquee.top <= row.boundsBottom;

/** Whether every outline point lies in the marquee, edges included: the extent's edges do. */
const inside = (row: EnclosureRow, marquee: MarqueeEdges): boolean =>
  row.left >= marquee.left &&
  row.right <= marquee.right &&
  row.top >= marquee.top &&
  row.bottom <= marquee.bottom;

/** Whether the marquee encloses the row's element (REQ-S06). */
export const encloses = (row: EnclosureRow, marquee: MarqueeEdges): boolean =>
  row.enclosable && meets(row, marquee) && inside(row, marquee);
