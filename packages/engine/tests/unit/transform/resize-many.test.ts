import { describe, expect, it } from 'vitest';

import { localBox } from '../../../src/geometry/world-bounds.ts';
import type { Element } from '../../../src/model/elements.ts';
import { resizeElements } from '../../../src/transform/resize-many.ts';
import { lineElement, shapeElement, textElement } from '../../support/elements.ts';

// Resizing several elements about the selection outline
// (docs/architecture/engine/interaction.md#transforms), with B-16's two-element case.

const FREE = { keepAspect: false, fromCenter: false };
const ALT = { keepAspect: false, fromCenter: true };

const boxOf = (element: Element): number[] => {
  const { x, y, width, height } = localBox(element);
  return [x, y, width, height];
};

describe('resizing several elements', () => {
  it('REQ-T03 B-16: the pair scales by 1.5 across and 1.2 down about its north-west corner', () => {
    const pair = [
      shapeElement('rectangle', 80, 60, { id: 1, x: 40, y: 460 }),
      shapeElement('rectangle', 80, 60, { id: 2, x: 160, y: 500 }),
    ];
    const outline = { x: 40, y: 460, width: 200, height: 100 };
    const after = resizeElements(pair, outline, {
      handle: 'se',
      drag: { x: 100, y: 20 },
      options: FREE,
    });
    expect(after.map(boxOf)).toEqual([
      [40, 460, 120, 72],
      [220, 508, 120, 72],
    ]);
  });

  it('REQ-T03 REQ-T04 keeps the aspect ratio when an element is turned by other than a quarter', () => {
    const elements = [
      shapeElement('rectangle', 100, 100, { id: 1 }),
      shapeElement('rectangle', 100, 100, { id: 2, x: 200, rotation: Math.PI / 4 }),
    ];
    const outline = {
      x: 0,
      y: -20.710678118654755,
      width: 320.71067811865476,
      height: 141.4213562373095,
    };
    const [first] = resizeElements(elements, outline, {
      handle: 'se',
      drag: { x: 100, y: 0 },
      options: FREE,
    });
    expect(first?.kind === 'rectangle' && first.width).toBeCloseTo(
      first?.kind === 'rectangle' ? first.height : 0,
      9,
    );
  });

  it('REQ-T04 Alt scales about the outline centre', () => {
    const elements = [
      shapeElement('rectangle', 100, 100, { id: 1 }),
      shapeElement('rectangle', 100, 100, { id: 2, x: 300 }),
    ];
    const outline = { x: 0, y: 0, width: 400, height: 100 };
    const after = resizeElements(elements, outline, {
      handle: 'e',
      drag: { x: 100, y: 0 },
      options: ALT,
    });
    expect(after.map(boxOf)).toEqual([
      [-100, 0, 150, 100],
      [350, 0, 150, 100],
    ]);
  });

  it('REQ-T05 a row of horizontal lines keeps its height 0, and the ratio stops at each element', () => {
    const flat = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const row = [lineElement(flat, { id: 1 }), lineElement(flat, { id: 2, x: 200 })];
    const outline = { x: 0, y: 0, width: 300, height: 0 };
    const grown = resizeElements(row, outline, {
      handle: 'se',
      drag: { x: 300, y: 50 },
      options: FREE,
    });
    expect(grown.map(boxOf)).toEqual([
      [0, 0, 200, 0],
      [400, 0, 200, 0],
    ]);
    const shrunk = resizeElements(row, outline, {
      handle: 'se',
      drag: { x: -1_000, y: 0 },
      options: FREE,
    });
    expect(shrunk.map((element) => localBox(element).width)).toEqual([1, 1]);
  });

  it('scales a text in a selection by its height ratio, keeping its own aspect ratio', () => {
    const elements = [
      textElement(100, 20, { id: 1 }),
      shapeElement('rectangle', 100, 80, { id: 2, x: 200 }),
    ];
    const outline = { x: 0, y: 0, width: 300, height: 80 };
    const drag = { handle: 'se', drag: { x: 300, y: 0 }, options: FREE } as const;
    const [text, shape] = resizeElements(elements, outline, drag);
    expect(text).toMatchObject({
      x: 50,
      y: 0,
      width: 100,
      height: 20,
      content: { font: { size: 20 } },
    });
    expect(shape && boxOf(shape)).toEqual([400, 0, 200, 80]);
  });

  it('REQ-T03 scales a quarter-turned element along the scene axes its own sides lie on', () => {
    const elements = [
      shapeElement('rectangle', 100, 50, { id: 1, rotation: Math.PI / 2 }),
      shapeElement('rectangle', 50, 100, { id: 2, x: 100, y: -25 }),
    ];
    // Turned a quarter, the first one's own height lies across the scene, from x 25 to 75.
    const outline = { x: 25, y: -25, width: 125, height: 100 };
    const [turned, upright] = resizeElements(elements, outline, {
      handle: 'e',
      drag: { x: 125, y: 0 },
      options: FREE,
    });
    expect(turned).toMatchObject({ x: 25, y: -25, width: 100, height: 100, rotation: Math.PI / 2 });
    expect(upright && boxOf(upright)).toEqual([175, -25, 100, 100]);
  });
});
