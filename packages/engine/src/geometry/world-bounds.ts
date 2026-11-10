import { aabbExpand, aabbUnion } from '../math/aabb.ts';
import type { Aabb } from '../math/aabb.ts';
import type { Element } from '../model/elements.ts';
import { pointExtent } from '../model/points.ts';

/**
 * An element's unrotated local box: its origin with a box kind's own size, or with the extent of
 * a point kind's points (docs/architecture/engine/domain-model.md#geometry-of-an-element).
 */
export function localBox(element: Element): Aabb {
  const { width, height } = 'points' in element ? pointExtent(element.points) : element;
  return { x: element.x, y: element.y, width, height };
}

/**
 * An element's world bounds, which the scene's spatial index keeps
 * (docs/architecture/engine/scene-and-viewport.md#the-scene-graph): the axis-aligned bounds of
 * its rotated local box, grown by half its stroke width. An unrotated box is used as it is, so no
 * rounding moves it. A label that overflows its element needs text layout to be measured, so its
 * box joins the bounds once the geometry layer lays labels out.
 */
export function worldBounds(element: Element): Aabb {
  const box = localBox(element);
  const turned = element.rotation === 0 ? box : turnedBounds(box, element.rotation);
  return aabbExpand(turned, element.style.stroke.width / 2);
}

/** A box turned about its centre: what `obbToScene` turns a local point with. */
interface Turn {
  readonly box: Aabb;
  readonly centerX: number;
  readonly centerY: number;
  readonly cos: number;
  readonly sin: number;
}

/** The smallest and largest x and y of the turned corners so far. */
interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Widens the extent by a local point turned as `obbToScene` turns it, operation for operation. */
function widenTurned(extent: Extent, turn: Turn, localX: number, localY: number): void {
  const dx = turn.box.x + localX - turn.centerX;
  const dy = turn.box.y + localY - turn.centerY;
  const x = turn.centerX + (dx * turn.cos - dy * turn.sin);
  const y = turn.centerY + (dx * turn.sin + dy * turn.cos);
  extent.minX = Math.min(extent.minX, x);
  extent.minY = Math.min(extent.minY, y);
  extent.maxX = Math.max(extent.maxX, x);
  extent.maxY = Math.max(extent.maxY, y);
}

/**
 * The bounds of a box turned about its centre, as `obbBounds` computes them from `obbCorners`:
 * the four corners turned in their order, then the smallest and largest x and y. The cosine and
 * sine are taken once, which gives the numbers that each corner's own take gives, and no corner
 * is built as a point.
 */
function turnedBounds(box: Aabb, rotation: number): Aabb {
  const turn: Turn = {
    box,
    centerX: box.x + box.width / 2,
    centerY: box.y + box.height / 2,
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
  };
  const extent: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  widenTurned(extent, turn, 0, 0);
  widenTurned(extent, turn, box.width, 0);
  widenTurned(extent, turn, box.width, box.height);
  widenTurned(extent, turn, 0, box.height);
  const { minX, minY, maxX, maxY } = extent;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The bounds of a document's content, which zoom to fit shows: the union of every element's world
 * bounds, or null when there is no element.
 */
export function contentBounds(elements: Iterable<Element>): Aabb | null {
  let bounds: Aabb | null = null;
  for (const element of elements) {
    const box = worldBounds(element);
    bounds = bounds === null ? box : aabbUnion(bounds, box);
  }
  return bounds;
}
