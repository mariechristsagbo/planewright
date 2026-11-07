import { describe, expect, it } from 'vitest';

import { obbToScene } from '../../../src/math/obb.ts';
import { localBox } from '../../../src/geometry/world-bounds.ts';
import { updatesTo } from '../../../src/transform/changes.ts';
import { moveLineEnd } from '../../../src/transform/line-end.ts';
import { moveBy } from '../../../src/transform/move.ts';
import { lineElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';

// Moving, moving a line's end, and the updates that take the scene to a transform's result
// (docs/architecture/engine/interaction.md#transforms).

describe('moving', () => {
  it('REQ-T01 B-15: the rectangle and the ellipse move by exactly +40, +40', () => {
    const elements = [
      shapeElement('rectangle', 120, 100, { id: 1, x: 300, y: 200 }),
      shapeElement('ellipse', 120, 100, { id: 2, x: 600, y: 200 }),
    ];
    expect(moveBy(elements, { x: 40, y: 40 })).toEqual([
      { ...elements[0], x: 340, y: 240 },
      { ...elements[1], x: 640, y: 240 },
    ]);
  });
});

describe('moving a two-point line’s end', () => {
  const line = lineElement(
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    { x: 100, y: 400 },
  );

  it('moves the end point only', () => {
    expect(moveLineEnd(line, 'end', { x: 0, y: 50 })).toEqual({
      ...line,
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 50 },
      ],
    });
  });

  it('moves the start point only, normalising the points again', () => {
    expect(moveLineEnd(line, 'start', { x: -20, y: -30 })).toEqual({
      ...line,
      x: 80,
      y: 370,
      points: [
        { x: 0, y: 0 },
        { x: 220, y: 30 },
      ],
    });
  });

  it('keeps the other end of a turned line where it was', () => {
    const turned = { ...line, rotation: Math.PI / 3 };
    const end = obbToScene({ ...localBox(turned), rotation: turned.rotation }, { x: 200, y: 0 });
    const after = moveLineEnd(turned, 'start', { x: 30, y: 40 });
    const [, last] = after.points;
    const moved = obbToScene(
      { ...localBox(after), rotation: after.rotation },
      last ?? { x: 0, y: 0 },
    );
    expect(moved.x).toBeCloseTo(end.x, 9);
    expect(moved.y).toBeCloseTo(end.y, 9);
  });
});

describe('the updates to a transform’s result', () => {
  it('holds the changed fields only, and skips what is unchanged or gone', () => {
    const scene = sceneOf(
      shapeElement('rectangle', 10, 10, { id: 1 }),
      shapeElement('ellipse', 10, 10, { id: 2 }),
    );
    const [first, second] = scene.ordered();
    const gone = shapeElement('diamond', 10, 10, { id: 3 });
    if (first === undefined || second === undefined)
      throw new Error('The fixture holds two elements.');
    expect(updatesTo(scene, [{ ...first, x: 5 }, second, gone])).toEqual([
      { type: 'update', id: testId(1), before: { x: 0 }, after: { x: 5 } },
    ]);
  });

  it('writes null for a field that the result drops', () => {
    const scene = sceneOf(shapeElement('rectangle', 10, 10, { id: 1 }));
    const [element] = scene.ordered();
    if (element === undefined) throw new Error('The fixture holds one element.');
    const linked = { ...element, link: 'https://example.com/' };
    expect(updatesTo(sceneOf(linked), [element])).toEqual([
      {
        type: 'update',
        id: testId(1),
        before: { link: 'https://example.com/' },
        after: { link: null },
      },
    ]);
  });
});
