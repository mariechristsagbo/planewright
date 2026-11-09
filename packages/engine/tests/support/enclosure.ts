import { geometryOf } from '../../src/geometry/kinds.ts';
import { localBox, worldBounds } from '../../src/geometry/world-bounds.ts';
import { aabbContainsPoint, aabbIntersects } from '../../src/math/aabb.ts';
import type { Aabb } from '../../src/math/aabb.ts';
import { TAU } from '../../src/math/angle.ts';
import { obbToScene } from '../../src/math/obb.ts';
import { randomBetween } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Element, Point } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { anySceneElement, bruteOrder, chance, pick } from './scenes.ts';

// Box selection by its definition (REQ-S06, rendering-and-hit-testing.md#hit-testing), element by
// element with no index and no cache: what the marquee query must agree with.

/**
 * The scene points of an element's outline that a marquee must enclose, as ENG-06 defined them:
 * every point of a point kind and the four corners of a box kind, moved by the origin when the
 * element is not turned, and turned about its local box's centre when it is.
 */
export function outlinePoints(element: Element): readonly Point[] {
  const box = localBox(element);
  const locals =
    'points' in element
      ? element.points
      : [
          { x: 0, y: 0 },
          { x: box.width, y: 0 },
          { x: box.width, y: box.height },
          { x: 0, y: box.height },
        ];
  if (element.rotation === 0) {
    return locals.map(({ x, y }) => ({ x: element.x + x, y: element.y + y }));
  }
  const turned = { ...box, rotation: element.rotation };
  return locals.map((local) => obbToScene(turned, local));
}

/**
 * The elements that a marquee encloses: those with a geometry whose world bounds meet it, as the
 * spatial index's candidates do, and whose every outline point lies in it, edges included, in
 * drawing order.
 */
export const bruteEnclosed = (elements: Iterable<Element>, marquee: Aabb): ElementId[] =>
  bruteOrder(
    [...elements].filter(
      (element) =>
        geometryOf(element) !== undefined &&
        aabbIntersects(worldBounds(element), marquee) &&
        outlinePoints(element).every((point) => aabbContainsPoint(marquee, point)),
    ),
  );

/**
 * What a marquee is compared with for one element, from its world bounds and its outline points:
 * the bounds' left, top, right and bottom edges, then the outline's smallest and largest x and y.
 */
export function boundsAndOutline(element: Element): readonly number[] {
  const bounds = worldBounds(element);
  const points = outlinePoints(element);
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  return [
    bounds.x,
    bounds.y,
    bounds.x + bounds.width,
    bounds.y + bounds.height,
    Math.min(...xs),
    Math.min(...ys),
    Math.max(...xs),
    Math.max(...ys),
  ];
}

const TURNS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, TAU - 1e-12, 1e-12] as const;

/**
 * A valid element of any kind that `anySceneElement` makes, sometimes made awkward for exact
 * arithmetic: placed up to 10⁹ units away, turned by a quarter, a hair or almost a whole turn,
 * stroked as thinly as the model allows or as thickly, or with points normalised only within the
 * model's tolerance, so that their smallest x and y are a little above or below 0.
 */
export function anyEnclosureElement(random: Random, id: ElementId): Element {
  const element = anySceneElement(random, id, { elements: [], groups: [] });
  const far = chance(random, 0.2) ? 2.5e5 : 1;
  const width = chance(random, 0.2)
    ? pick(random, [Number.MIN_VALUE, 1e-300, 100])
    : element.style.stroke.width;
  const placed = {
    x: element.x * far,
    y: element.y * far,
    rotation: chance(random, 0.3) ? pick(random, TURNS) : element.rotation,
    style: { ...element.style, stroke: { ...element.style.stroke, width } },
  };
  if (!('points' in element)) return { ...element, ...placed };
  const shift = chance(random, 0.3) ? randomBetween(random, -1e-9, 1e-9) : 0;
  const points = element.points.map(({ x, y }) => ({ x: x + shift, y: y + shift }));
  return { ...element, ...placed, points };
}

/** The next double above `value`, so that a box can be moved off an edge by the least amount. */
export function nextUp(value: number): number {
  if (value === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  const bits = view.getBigInt64(0);
  view.setBigInt64(0, value > 0 ? bits + 1n : bits - 1n);
  return view.getFloat64(0);
}

/** The next double below `value`. */
export const nextDown = (value: number): number => -nextUp(-value);
