import { describe, expect, it } from 'vitest';

import type { Element } from '../../../src/model/elements.ts';
import { rotateElements } from '../../../src/transform/rotate.ts';
import { shapeElement } from '../../support/elements.ts';

// Rotation by the pointer's direction about the outline's centre
// (docs/architecture/engine/interaction.md#transforms).

const centreOf = (element: Element) =>
  element.kind === 'rectangle'
    ? { x: element.x + element.width / 2, y: element.y + element.height / 2 }
    : { x: Number.NaN, y: Number.NaN };

describe('rotating one element', () => {
  it('REQ-T06 B-17: the rotation handle dragged round to the right of the centre turns a quarter', () => {
    const element = shapeElement('rectangle', 180, 150, { x: 340, y: 240 });
    const [after] = rotateElements(
      [element],
      { x: 430, y: 315 },
      [
        { x: 430, y: 220 },
        { x: 530, y: 315 },
      ],
      false,
    );
    expect(after).toEqual({ ...element, rotation: Math.PI / 2 });
  });

  it('REQ-T06 follows the pointer from the element’s own rotation, keeping its size and centre', () => {
    const element = shapeElement('rectangle', 100, 50, { rotation: Math.PI / 2 });
    const centre = { x: 50, y: 25 };
    const [after] = rotateElements(
      [element],
      centre,
      [
        { x: 150, y: 25 },
        { x: 50, y: 125 },
      ],
      false,
    );
    expect(after).toEqual({ ...element, rotation: Math.PI });
  });

  it('REQ-T06 snaps the total to 15° steps with Shift', () => {
    const element = shapeElement('rectangle', 100, 50, { rotation: Math.PI / 18 });
    const centre = { x: 50, y: 25 };
    // 10° to start with, then 50° more: 60° snaps to 60°, and 10° + 32° = 42° snaps to 45°.
    const at = (degrees: number) => ({
      x: 50 + 100 * Math.cos((degrees * Math.PI) / 180),
      y: 25 + 100 * Math.sin((degrees * Math.PI) / 180),
    });
    const [sixty] = rotateElements([element], centre, [at(0), at(50)], true);
    expect(sixty?.rotation).toBeCloseTo(Math.PI / 3, 12);
    const [fortyFive] = rotateElements([element], centre, [at(0), at(32)], true);
    expect(fortyFive?.rotation).toBeCloseTo(Math.PI / 4, 12);
    const [free] = rotateElements([element], centre, [at(0), at(32)], false);
    expect(free?.rotation).toBeCloseTo((42 * Math.PI) / 180, 12);
  });
});

describe('rotating several elements', () => {
  it('REQ-T06 turns their centres about the outline centre and adds the angle to each', () => {
    const elements = [
      shapeElement('rectangle', 100, 100, { id: 1 }),
      shapeElement('rectangle', 100, 100, { id: 2, x: 200, rotation: Math.PI / 6 }),
    ];
    const centre = { x: 150, y: 50 };
    const after = rotateElements(
      elements,
      centre,
      [
        { x: 150, y: -50 },
        { x: 250, y: 50 },
      ],
      false,
    );
    expect(
      after.map(centreOf).map(({ x, y }) => [Math.round(x * 1e9) / 1e9, Math.round(y * 1e9) / 1e9]),
    ).toEqual([
      [150, -50],
      [150, 150],
    ]);
    const [first, second] = after.map(({ rotation }) => rotation);
    expect(first).toBe(Math.PI / 2);
    expect(second).toBeCloseTo(Math.PI / 2 + Math.PI / 6, 12);
  });

  it('REQ-T06 snaps the turn of several to 15° steps with Shift', () => {
    const elements = [
      shapeElement('rectangle', 100, 100, { id: 1 }),
      shapeElement('rectangle', 100, 100, { id: 2, x: 200 }),
    ];
    const centre = { x: 150, y: 50 };
    const to = { x: 150 + 100 * Math.cos(0.9), y: 50 + 100 * Math.sin(0.9) };
    const after = rotateElements(elements, centre, [{ x: 250, y: 50 }, to], true);
    expect(after.map(({ rotation }) => rotation)).toEqual([Math.PI / 4, Math.PI / 4]);
  });
});
