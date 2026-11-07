import { describe, expect, it } from 'vitest';

import { RECTANGLE, TEXT_BOX } from '../../../src/geometry/box.ts';
import { DIAMOND } from '../../../src/geometry/diamond.ts';
import { ELLIPSE } from '../../../src/geometry/ellipse.ts';
import { geometryOf, toLocal } from '../../../src/geometry/kinds.ts';
import { FREEHAND, LINE } from '../../../src/geometry/polyline.ts';
import { localBox } from '../../../src/geometry/world-bounds.ts';
import { obbToScene } from '../../../src/math/obb.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import { lineElement, shapeElement } from '../../support/elements.ts';
import { fixtureDocument } from '../../support/fixtures.ts';
import { checkProperty } from '../../support/property.ts';
import { anySceneElement, sceneElementId } from '../../support/scenes.ts';

const fixture = (index: number): Element => {
  const element = [...fixtureDocument().elements.values()][index];
  if (element === undefined) throw new Error(`No fixture element ${String(index)}.`);
  return element;
};

describe('the geometry of each kind', () => {
  it('is the box, ellipse, diamond, polyline or text box geometry for the P0 kinds', () => {
    expect([0, 1, 2, 3, 4, 5].map((index) => geometryOf(fixture(index)))).toStrictEqual([
      RECTANGLE,
      ELLIPSE,
      DIAMOND,
      LINE,
      FREEHAND,
      TEXT_BOX,
    ]);
  });

  it('is absent for the arrow, note, image and frame, which P0 does not draw yet', () => {
    expect([6, 7, 8, 9].map((index) => geometryOf(fixture(index)))).toStrictEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe('the local frame', () => {
  it('subtracts the origin of an unrotated element, with no rounding through its centre', () => {
    const rectangle = shapeElement('rectangle', 100, 50, { x: 10.1, y: -20.3 });
    for (const scene of [
      { x: 15.1, y: -0.3 },
      { x: 10.3, y: -20.1 },
      { x: 0.7, y: 3.3 },
    ]) {
      expect(toLocal(rectangle, scene)).toStrictEqual({ x: scene.x - 10.1, y: scene.y + 20.3 });
    }
  });

  it('REQ-T02 turns a scene point back by the rotation about the box centre', () => {
    const turned = shapeElement('rectangle', 100, 50, { x: 10, y: 20, rotation: Math.PI / 2 });
    const corner = toLocal(turned, { x: 85, y: -5 });
    expect(corner.x).toBeCloseTo(0, 9);
    expect(corner.y).toBeCloseTo(0, 9);
    const line = lineElement(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
      { x: 0, y: 0, rotation: Math.PI / 2 },
    );
    const end = toLocal(line, { x: 20, y: 20 });
    expect(end.x).toBeCloseTo(40, 9);
    expect(end.y).toBeCloseTo(0, 9);
  });

  it('gives back every local point placed in the scene by the element box, on random elements', () => {
    const anyCase = (random: Parameters<typeof anySceneElement>[0]) => ({
      element: anySceneElement(random, sceneElementId(1), { elements: [], groups: [] }),
      local: { x: randomBetween(random, -500, 500), y: randomBetween(random, -500, 500) },
    });
    checkProperty({ seed: 6102, runs: 200 }, anyCase, ({ element, local }) => {
      const scene = obbToScene({ ...localBox(element), rotation: element.rotation }, local);
      const back = toLocal(element, scene);
      expect(Math.abs(back.x - local.x)).toBeLessThan(1e-6);
      expect(Math.abs(back.y - local.y)).toBeLessThan(1e-6);
    });
  });
});
