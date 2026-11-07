import { aabbExpand, aabbUnion } from '../math/aabb.ts';
import type { Aabb } from '../math/aabb.ts';
import { obbBounds } from '../math/obb.ts';
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
  const turned = element.rotation === 0 ? box : obbBounds({ ...box, rotation: element.rotation });
  return aabbExpand(turned, element.style.stroke.width / 2);
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
