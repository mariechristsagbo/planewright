import { describe, expect, it } from 'vitest';

import { RECTANGLE, TEXT_BOX } from '../../../src/geometry/box.ts';
import { shapeElement, textElement } from '../../support/elements.ts';

/** The control-point factor of a quarter circle drawn as one cubic. */
const K = (4 * (Math.SQRT2 - 1)) / 3;

const boxPath = (width: number, height: number) => [
  { op: 'move', to: { x: 0, y: 0 } },
  { op: 'line', to: { x: width, y: 0 } },
  { op: 'line', to: { x: width, y: height } },
  { op: 'line', to: { x: 0, y: height } },
  { op: 'close' },
];

const round = (width: number, height: number) =>
  shapeElement('rectangle', width, height, { style: { corners: 'round' } });

describe('the rectangle geometry', () => {
  it('outlines a sharp rectangle by its four corners in its local frame', () => {
    const rectangle = shapeElement('rectangle', 120, 100, { x: 300, y: 180, rotation: 1 });
    expect(RECTANGLE.outline(rectangle)).toStrictEqual(boxPath(120, 100));
    expect(RECTANGLE.isClosed(rectangle)).toBe(true);
  });

  it('rounds its corners with a radius of min(16, a quarter of the shorter side)', () => {
    expect(RECTANGLE.outline(round(120, 100))[0]).toStrictEqual({
      op: 'move',
      to: { x: 16, y: 0 },
    });
    const path = RECTANGLE.outline(round(40, 20));
    const o = 5 - 5 * K;
    expect(path).toStrictEqual([
      { op: 'move', to: { x: 5, y: 0 } },
      { op: 'line', to: { x: 35, y: 0 } },
      { op: 'cubic', c1: { x: 40 - o, y: 0 }, c2: { x: 40, y: o }, to: { x: 40, y: 5 } },
      { op: 'line', to: { x: 40, y: 15 } },
      { op: 'cubic', c1: { x: 40, y: 20 - o }, c2: { x: 40 - o, y: 20 }, to: { x: 35, y: 20 } },
      { op: 'line', to: { x: 5, y: 20 } },
      { op: 'cubic', c1: { x: o, y: 20 }, c2: { x: 0, y: 20 - o }, to: { x: 0, y: 15 } },
      { op: 'line', to: { x: 0, y: 5 } },
      { op: 'cubic', c1: { x: 0, y: o }, c2: { x: o, y: 0 }, to: { x: 5, y: 0 } },
      { op: 'close' },
    ]);
  });

  it('keeps the corners sharp when a round rectangle has no width or height to round', () => {
    expect(RECTANGLE.outline(round(0, 40))).toStrictEqual(boxPath(0, 40));
  });

  it('measures the signed distance to a sharp box: negative inside, 0 on the edge', () => {
    const rectangle = shapeElement('rectangle', 120, 100);
    expect(RECTANGLE.distance(rectangle, { x: 60, y: 50 })).toBe(-50);
    expect(RECTANGLE.distance(rectangle, { x: 10, y: 50 })).toBe(-10);
    expect(RECTANGLE.distance(rectangle, { x: 120, y: 30 })).toBe(0);
    expect(RECTANGLE.distance(rectangle, { x: 130, y: 50 })).toBe(10);
    expect(RECTANGLE.distance(rectangle, { x: 123, y: 104 })).toBe(5);
  });

  it('measures round corners as quarter circles', () => {
    const rectangle = round(120, 100);
    expect(RECTANGLE.distance(rectangle, { x: -3, y: -3 })).toBeCloseTo(
      Math.hypot(19, 19) - 16,
      12,
    );
    expect(RECTANGLE.distance(rectangle, { x: 2, y: 2 })).toBeCloseTo(Math.hypot(14, 14) - 16, 12);
    expect(RECTANGLE.distance(rectangle, { x: 0, y: 50 })).toBe(0);
    expect(RECTANGLE.distance(rectangle, { x: 60, y: 50 })).toBe(-50);
  });
});

describe('the text box geometry', () => {
  it('REQ-S02 counts the whole box as inside, with sharp corners whatever the style says', () => {
    const text = textElement(42.5, 25, { style: { corners: 'round' } });
    expect(TEXT_BOX.outline(text)).toStrictEqual(boxPath(42.5, 25));
    expect(TEXT_BOX.isClosed(text)).toBe(true);
    expect(TEXT_BOX.distance(text, { x: 21.25, y: 12.5 })).toBe(-12.5);
    expect(TEXT_BOX.distance(text, { x: 1, y: 1 })).toBe(-1);
    expect(TEXT_BOX.distance(text, { x: 0, y: 0 })).toBe(0);
    expect(TEXT_BOX.distance(text, { x: 45.5, y: 29 })).toBe(5);
  });
});
