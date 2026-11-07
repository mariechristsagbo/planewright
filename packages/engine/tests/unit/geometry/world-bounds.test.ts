import { describe, expect, it } from 'vitest';

import { contentBounds, localBox, worldBounds } from '../../../src/geometry/world-bounds.ts';
import {
  aabbContainsBox,
  aabbContainsPoint,
  aabbExpand,
  aabbFromPoints,
} from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { obbCorners, obbToScene } from '../../../src/math/obb.ts';
import type { Element } from '../../../src/model/elements.ts';
import { anyDocument } from '../../support/documents.ts';
import { elementId, fixtureDocument } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';

const fixtureElement = (index: number): Element => {
  const element = fixtureDocument().elements.get(elementId(index) as Element['id']);
  if (element === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return element;
};

/** The fixture element at `index` with some fields replaced. */
const variant = (index: number, fields: Record<string, unknown>): Element => ({
  ...fixtureElement(index),
  ...fields,
});

const worldBoundsOf = (elements: Iterable<Element>): Aabb[] => [...elements].map(worldBounds);

const withStroke = (element: Element, width: number): Element => ({
  ...element,
  style: { ...element.style, stroke: { ...element.style.stroke, width } },
});

function expectBoxClose(actual: Aabb, expected: Aabb): void {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
  expect(actual.width).toBeCloseTo(expected.width, 9);
  expect(actual.height).toBeCloseTo(expected.height, 9);
}

describe('localBox', () => {
  it('is the origin and size of a box kind', () => {
    expect(localBox(variant(0, { x: 10, y: 20 }))).toStrictEqual({
      x: 10,
      y: 20,
      width: 120,
      height: 100,
    });
  });

  it("is the origin and the points' extent of a point kind", () => {
    expect(localBox(variant(3, { x: 5, y: 6 }))).toStrictEqual({
      x: 5,
      y: 6,
      width: 30,
      height: 10,
    });
    expect(localBox(variant(4, { x: 0, y: 0 }))).toStrictEqual({ x: 0, y: 0, width: 8, height: 2 });
  });
});

describe('worldBounds', () => {
  it('grows an unrotated box by half its stroke width, exactly', () => {
    expect(worldBounds(variant(0, { x: 10, y: 20 }))).toStrictEqual({
      x: 9,
      y: 19,
      width: 122,
      height: 102,
    });
    const far = variant(2, { x: 999_999_999.9, y: -999_999_999.9, width: 0.1, height: 0 });
    expect(worldBounds(withStroke(far, 0.2))).toStrictEqual(aabbExpand(localBox(far), 0.1));
  });

  it('is the bounds of the rotated box, about its centre', () => {
    const quarter = variant(0, { x: 10, y: 20, rotation: Math.PI / 2 });
    expectBoxClose(worldBounds(quarter), { x: 19, y: 9, width: 102, height: 122 });
    const eighth = variant(0, { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 });
    const half = 50 * Math.SQRT2 + 1;
    expectBoxClose(worldBounds(eighth), {
      x: 50 - half,
      y: 50 - half,
      width: 2 * half,
      height: 2 * half,
    });
  });

  it("covers a point kind's points, and a one-point stroke as a dot of the stroke's width", () => {
    expect(worldBounds(variant(3, { x: 5, y: 5 }))).toStrictEqual({
      x: 4,
      y: 4,
      width: 32,
      height: 12,
    });
    const dot = withStroke(variant(4, { x: 7, y: 9, points: [{ x: 0, y: 0 }] }), 6);
    expect(worldBounds(dot)).toStrictEqual({ x: 4, y: 6, width: 6, height: 6 });
  });

  it('is the box around the rotated corners, grown by half the stroke, and holds every point', () => {
    checkProperty({ seed: 3101 }, anyDocument, (document) => {
      for (const element of document.elements.values()) {
        const turned = { ...localBox(element), rotation: element.rotation };
        const corners = obbCorners(turned);
        const bounds = worldBounds(element);
        // Rounding grows with the coordinates, which reach 10⁹.
        const scale = Math.max(1, ...corners.map(({ x, y }) => Math.max(Math.abs(x), Math.abs(y))));
        const expected = aabbExpand(aabbFromPoints(corners), element.style.stroke.width / 2);
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(bounds[key] - expected[key])).toBeLessThanOrEqual(scale * 1e-13);
        }
        const points = 'points' in element ? element.points.map((p) => obbToScene(turned, p)) : [];
        for (const point of points) {
          expect(aabbContainsPoint(aabbExpand(bounds, scale * 1e-13), point)).toBe(true);
        }
      }
    });
  });
});

describe('contentBounds', () => {
  it('is null without elements, so zoom to fit can leave an empty document alone', () => {
    expect(contentBounds([])).toBeNull();
    expect(contentBounds(new Map<string, Element>().values())).toBeNull();
  });

  it("is a single element's world bounds", () => {
    const element = variant(0, { x: 10, y: 20, rotation: Math.PI / 6 });
    expect(contentBounds([element])).toStrictEqual(worldBounds(element));
  });

  it('REQ-V09 is the union of the world bounds of every element, strokes included', () => {
    const elements = [variant(0, { x: 10, y: 20 }), variant(3, { x: 500, y: -50 })];
    expect(contentBounds(elements)).toStrictEqual({ x: 9, y: -51, width: 522, height: 172 });
  });

  it('property: holds every world bound and touches each side with one of them', () => {
    checkProperty({ seed: 5105, runs: 60 }, anyDocument, (document) => {
      const bounds = worldBoundsOf(document.elements.values());
      const content = contentBounds(document.elements.values());
      if (bounds.length === 0) {
        expect(content).toBeNull();
        return;
      }
      if (content === null) throw new Error('A document with elements has content bounds.');
      const left = Math.min(...bounds.map((box) => box.x));
      const top = Math.min(...bounds.map((box) => box.y));
      const right = Math.max(...bounds.map((box) => box.x + box.width));
      const bottom = Math.max(...bounds.map((box) => box.y + box.height));
      // The union stores a width and a height, so its far sides round with the coordinates.
      const scale = Math.max(1, ...[left, top, right, bottom].map(Math.abs)) * 1e-13;
      for (const box of bounds) expect(aabbContainsBox(aabbExpand(content, scale), box)).toBe(true);
      expect([content.x, content.y]).toStrictEqual([left, top]);
      expect(Math.abs(content.x + content.width - right)).toBeLessThanOrEqual(scale);
      expect(Math.abs(content.y + content.height - bottom)).toBeLessThanOrEqual(scale);
    });
  });
});
