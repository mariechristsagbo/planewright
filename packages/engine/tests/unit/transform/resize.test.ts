import { describe, expect, it } from 'vitest';

import { localBox } from '../../../src/geometry/world-bounds.ts';
import { obbCorners } from '../../../src/math/obb.ts';
import type { Element, Point } from '../../../src/model/elements.ts';
import { resizeElement } from '../../../src/transform/resize.ts';
import type { ResizeHandle } from '../../../src/transform/resize-ratios.ts';
import { freehandElement, lineElement, shapeElement, textElement } from '../../support/elements.ts';

// Resizing one element (docs/architecture/engine/interaction.md#transforms), with B-16's boxes.

const FREE = { keepAspect: false, fromCenter: false };
const SHIFT = { keepAspect: true, fromCenter: false };
const ALT = { keepAspect: false, fromCenter: true };

const boxOf = (element: Element): number[] => {
  const { x, y, width, height } = localBox(element);
  return [x, y, width, height];
};

const rectangle = ([x, y, width, height]: readonly number[]) =>
  shapeElement('rectangle', width ?? 0, height ?? 0, { x: x ?? 0, y: y ?? 0 });

const resized = (box: readonly number[], handle: ResizeHandle, x: number, y: number) =>
  boxOf(resizeElement(rectangle(box), { handle, drag: { x, y }, options: FREE }));

describe('resizing one element by a handle, as B-16 observed', () => {
  // On mobile each case started from a 120 × 80 rectangle; its box is the result minus the drag
  // along the dragged edges, since the opposite corner or side stayed fixed.
  it.each([
    ['se', [30, 100, 120, 80], [30, 30], [30, 100, 150, 110]],
    ['nw', [240, 110, 120, 80], [-20, -20], [220, 90, 140, 100]],
    ['e', [30, 280, 120, 80], [40, 0], [30, 280, 160, 80]],
    ['n', [240, 290, 120, 80], [0, -30], [240, 260, 120, 110]],
    ['sw', [40, 100, 120, 80], [-20, 30], [20, 100, 140, 110]],
    ['ne', [220, 110, 120, 80], [20, -20], [220, 90, 140, 100]],
    ['w', [40, 280, 120, 80], [-20, 0], [20, 280, 140, 80]],
    ['s', [220, 290, 120, 80], [0, 30], [220, 290, 120, 110]],
  ] as const)(
    'REQ-T02 the %s handle moves its corner or side by the drag',
    (handle, box, [x, y], after) => {
      expect(resized(box, handle, x, y)).toEqual(after);
    },
  );

  it('REQ-T02 the desktop south-east drag by (60, 50) gives [340, 240, 180, 150]', () => {
    expect(resized([340, 240, 120, 100], 'se', 60, 50)).toEqual([340, 240, 180, 150]);
  });

  it('changes only the element’s fields', () => {
    const before = rectangle([0, 0, 120, 80]);
    const after = resizeElement(before, { handle: 'se', drag: { x: 10, y: 0 }, options: FREE });
    expect(after).toEqual({ ...before, width: 130 });
  });

  it('REQ-T02 a turned element resizes in its own frame and keeps the opposite corner in place', () => {
    const turned = shapeElement('rectangle', 100, 50, { rotation: Math.PI / 2 });
    const [fixed] = obbCorners({ ...localBox(turned), rotation: Math.PI / 2 });
    // Turned a quarter, the element's own x axis points down the scene.
    const after = resizeElement(turned, { handle: 'se', drag: { x: 0, y: 30 }, options: FREE });
    const box = { ...localBox(after), rotation: after.rotation };
    expect([box.width, box.height, after.rotation]).toEqual([130, 50, Math.PI / 2]);
    expect(obbCorners(box)[0].x).toBeCloseTo(fixed.x, 9);
    expect(obbCorners(box)[0].y).toBeCloseTo(fixed.y, 9);
  });
});

describe('resizing one element with Shift and Alt', () => {
  it('REQ-T04 Shift keeps the aspect ratio by the larger ratio, about the opposite corner', () => {
    const after = resizeElement(rectangle([0, 0, 120, 80]), {
      handle: 'se',
      drag: { x: 60, y: 0 },
      options: SHIFT,
    });
    expect(boxOf(after)).toEqual([0, 0, 180, 120]);
  });

  it('REQ-T04 Shift on a side handle scales the other side about its middle', () => {
    const after = resizeElement(rectangle([0, 0, 120, 80]), {
      handle: 'e',
      drag: { x: 60, y: 0 },
      options: SHIFT,
    });
    expect(boxOf(after)).toEqual([0, -20, 180, 120]);
  });

  it('REQ-T04 Alt keeps the centre fixed and doubles the change', () => {
    const after = resizeElement(rectangle([0, 0, 120, 80]), {
      handle: 'se',
      drag: { x: 10, y: 20 },
      options: ALT,
    });
    expect(boxOf(after)).toEqual([-10, -20, 140, 120]);
  });

  it('REQ-T04 Shift and Alt together scale about the centre by the larger ratio', () => {
    const both = { keepAspect: true, fromCenter: true };
    const after = resizeElement(rectangle([0, 0, 120, 80]), {
      handle: 'se',
      drag: { x: 30, y: 0 },
      options: both,
    });
    expect(boxOf(after)).toEqual([-30, -20, 180, 120]);
  });
});

describe('the smallest size and zero sizes', () => {
  it('REQ-T05 a size stops at 1 unit and never flips', () => {
    expect(resized([0, 0, 120, 80], 'se', -500, -500)).toEqual([0, 0, 1, 1]);
    expect(resized([0, 0, 120, 80], 'nw', 500, 500)).toEqual([119, 79, 1, 1]);
    const shifted = resizeElement(rectangle([0, 0, 120, 80]), {
      handle: 'se',
      drag: { x: -500, y: -500 },
      options: SHIFT,
    });
    expect(boxOf(shifted)).toEqual([0, 0, 1.5, 1]);
  });

  it('REQ-T05 a horizontal line keeps its height 0 and scales its points along x', () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ];
    const line = lineElement(points, { x: 10, y: 20 });
    for (const options of [FREE, SHIFT]) {
      const after = resizeElement(line, { handle: 'se', drag: { x: 50, y: 30 }, options: options });
      expect(after).toMatchObject({
        x: 10,
        y: 20,
        points: [points[0], { x: 75, y: 0 }, { x: 150, y: 0 }],
      });
    }
  });

  it('REQ-T05 a dot and a flat freehand stroke resize without dividing by zero', () => {
    const dot = freehandElement([{ x: 0, y: 0 }], { x: 5, y: 5 });
    for (const handle of ['nw', 'se', 'e', 'n'] as const) {
      expect(resizeElement(dot, { handle: handle, drag: { x: 40, y: 40 }, options: FREE })).toEqual(
        dot,
      );
    }
    const flat = freehandElement([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 40, y: 0 },
    ]);
    expect(resizeElement(flat, { handle: 'n', drag: { x: 0, y: -30 }, options: FREE })).toEqual(
      flat,
    );
    // Alt doubles the change: 40 + 2 × 40 = 120 across, about the middle.
    expect(resizeElement(flat, { handle: 'e', drag: { x: 40, y: 0 }, options: ALT })).toMatchObject(
      {
        x: -40,
        y: 0,
        points: [
          { x: 0, y: 0 },
          { x: 60, y: 0 },
          { x: 120, y: 0 },
        ],
      },
    );
  });
});

describe('resizing a text by a corner', () => {
  it('scales its font size by the height ratio, keeping its aspect ratio', () => {
    const text = textElement(120, 30);
    const after = resizeElement(text, { handle: 'se', drag: { x: 0, y: 30 }, options: FREE });
    expect(after).toMatchObject({ width: 240, height: 60, content: { font: { size: 40 } } });
  });

  it('REQ-T05 stops where its font size reaches 1', () => {
    const after = resizeElement(textElement(120, 30), {
      handle: 'se',
      drag: { x: -1_000, y: -1_000 },
      options: FREE,
    });
    expect(after).toMatchObject({ width: 6, height: 1.5, content: { font: { size: 1 } } });
  });
});
