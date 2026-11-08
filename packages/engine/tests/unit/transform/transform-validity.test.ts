import { describe, expect, it } from 'vitest';

import { localBox } from '../../../src/geometry/world-bounds.ts';
import { aabbUnion } from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { obbBounds } from '../../../src/math/obb.ts';
import { randomBetween, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { checkElement } from '../../../src/model/element-checks.ts';
import type { Element, Point } from '../../../src/model/elements.ts';
import { INVALID } from '../../../src/model/json-check.ts';
import type { Issues } from '../../../src/model/json-check.ts';
import { pointsAreNormalized } from '../../../src/model/points.ts';
import { moveLineEnd } from '../../../src/transform/line-end.ts';
import { resizeElements } from '../../../src/transform/resize-many.ts';
import { resizeElement } from '../../../src/transform/resize.ts';
import { rotateElements } from '../../../src/transform/rotate.ts';
import { freehandElement, lineElement, shapeElement } from '../../support/elements.ts';
import { checkProperty } from '../../support/property.ts';
import { textWithFont } from '../../support/text-fonts.ts';

// Every transform's result is an element that the document model accepts (the ENG-10 review's
// M1): its numbers finite and within the limits, a text's font size within 1 to 1000, and a point
// kind's points normalised. Drags stay within 2,000 units, or 10⁶ for selections with a text,
// whose font limit bounds the growth; sizes and coordinates past the model's own limits are not
// clamped yet (the review's s5).

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
const OPTIONS = { runs: 300 } as const;

const pick = <T>(random: Random, items: readonly T[]): T =>
  items[randomInt(random, 0, items.length - 1)] as T;

function anyPoints(random: Random, count: number, flat: boolean): Point[] {
  const raw = Array.from({ length: count }, () => ({
    x: randomBetween(random, 0, 500),
    y: flat ? 0 : randomBetween(random, 0, 500),
  }));
  const minX = Math.min(...raw.map(({ x }) => x));
  const minY = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
}

/** A font size anywhere in the limits, a whole number half of the time. */
const anyFont = (random: Random): number =>
  random.next() < 0.5 ? randomInt(random, 1, 1_000) : randomBetween(random, 1, 1_000);

function anyElement(random: Random, index: number, text: boolean): Element {
  const rotation = pick(random, [0, Math.PI / 2, Math.PI, randomBetween(random, 0, 2 * Math.PI)]);
  const placement = {
    id: index + 1,
    order: String.fromCharCode(97 + index),
    x: randomBetween(random, -1_000, 1_000),
    y: randomBetween(random, -1_000, 1_000),
    rotation,
  };
  const kind = text ? 3 : randomInt(random, 0, 3);
  const size = () => randomBetween(random, 1, 500);
  if (kind === 0)
    return shapeElement(
      pick(random, ['rectangle', 'ellipse', 'diamond']),
      size(),
      size(),
      placement,
    );
  if (kind === 1)
    return lineElement(anyPoints(random, randomInt(random, 2, 4), random.next() < 0.3), placement);
  if (kind === 2)
    return freehandElement(
      anyPoints(random, randomInt(random, 1, 5), random.next() < 0.3),
      placement,
    );
  const font = textWithFont(anyFont(random), placement);
  return { ...font, width: size(), height: size() };
}

const anyDrag = (random: Random, reach: number): Point => ({
  x: randomBetween(random, -reach, reach),
  y: randomBetween(random, -reach, reach),
});

const anyResize = (random: Random, reach: number) => ({
  handle: pick(random, HANDLES),
  drag: anyDrag(random, reach),
  options: { keepAspect: random.next() < 0.5, fromCenter: random.next() < 0.5 },
});

const outlineOf = (elements: readonly Element[]): Aabb =>
  elements
    .map((element) => obbBounds({ ...localBox(element), rotation: element.rotation }))
    .reduce((union, box) => aabbUnion(union, box));

function expectValid(elements: readonly Element[]): void {
  for (const element of elements) {
    const issues: Issues = [];
    const checked = checkElement(JSON.parse(JSON.stringify(element)) as unknown, 'element', issues);
    expect(issues).toEqual([]);
    expect(checked === INVALID).toBe(false);
    if ('points' in element) expect(pointsAreNormalized(element.points)).toBe(true);
  }
}

describe('every transform gives an element that the document model accepts', () => {
  it('REQ-T05 resizing one element', { timeout: 30_000 }, () => {
    checkProperty(
      { seed: 1010, ...OPTIONS },
      (random) => {
        const text = random.next() < 0.4;
        return {
          element: anyElement(random, 0, text),
          resize: anyResize(random, text ? 1e6 : 2_000),
        };
      },
      ({ element, resize }) => {
        expectValid([resizeElement(element, resize)]);
      },
    );
  });

  it('REQ-T05 resizing several elements', { timeout: 30_000 }, () => {
    checkProperty(
      { seed: 1020, ...OPTIONS },
      (random) => {
        const text = random.next() < 0.4;
        const count = randomInt(random, 2, 4);
        const elements = Array.from({ length: count }, (_, index) =>
          anyElement(random, index, text && index === 0),
        );
        return { elements, resize: anyResize(random, text ? 1e6 : 2_000) };
      },
      ({ elements, resize }) => {
        expectValid(resizeElements(elements, outlineOf(elements), resize));
      },
    );
  });

  it('rotating, and moving a line’s end', { timeout: 30_000 }, () => {
    checkProperty(
      { seed: 1030, ...OPTIONS },
      (random) => {
        const elements = Array.from({ length: randomInt(random, 1, 3) }, (_, index) =>
          anyElement(random, index, false),
        );
        const line = lineElement(anyPoints(random, 2, random.next() < 0.3), {
          rotation: randomBetween(random, 0, 6),
        });
        return {
          elements,
          line,
          from: anyDrag(random, 2_000),
          to: anyDrag(random, 2_000),
          snap: random.next() < 0.5,
        };
      },
      ({ elements, line, from, to, snap }) => {
        expectValid(rotateElements(elements, { x: 0, y: 0 }, [from, to], snap));
        expectValid([moveLineEnd(line, snap ? 'start' : 'end', to)]);
      },
    );
  });
});
