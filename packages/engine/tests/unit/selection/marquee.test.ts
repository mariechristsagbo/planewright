import { describe, expect, it } from 'vitest';

import { geometryOf } from '../../../src/geometry/kinds.ts';
import { localBox } from '../../../src/geometry/world-bounds.ts';
import { aabbContainsPoint, aabbExpand } from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { obbCorners, obbToScene } from '../../../src/math/obb.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneReader } from '../../../src/scene/store.ts';
import { enclosedBy } from '../../../src/selection/marquee.ts';
import { anySceneLoad } from '../../support/edits.ts';
import { lineElement, sceneOf, shapeElement, testId, textElement } from '../../support/elements.ts';
import { fixtureStore } from '../../support/stores.ts';
import { checkProperty } from '../../support/property.ts';
import { color } from '../../support/scene-state.ts';
import { anyQueryBox, bruteOrder } from '../../support/scenes.ts';

const box = (x: number, y: number, right: number, bottom: number): Aabb => ({
  x,
  y,
  width: right - x,
  height: bottom - y,
});

describe('marquee enclosure', () => {
  it('REQ-S06 keeps the elements that the box wholly encloses, edges included, in drawing order', () => {
    const upper = shapeElement('rectangle', 120, 100, { id: 1, order: 'W', x: 300.1, y: 180.3 });
    const lower = textElement(40, 20, { id: 2, order: 'V', x: 310, y: 200 });
    const across = shapeElement('ellipse', 100, 100, { id: 3, x: 380, y: 250 });
    const scene = sceneOf(upper, lower, across);
    expect(enclosedBy(scene, { x: 300.1, y: 180.3, width: 120, height: 100 })).toStrictEqual([
      testId(2),
      testId(1),
    ]);
    expect(enclosedBy(scene, box(300, 180, 420, 280))).toStrictEqual([testId(2)]);
    expect(enclosedBy(scene, box(0, 0, 10, 10))).toStrictEqual([]);
  });

  it('keeps an unrotated corner on the edge it lies on, with no rounding through the centre', () => {
    // Placed through its centre, this box's left corners would land at 10.299999999999997.
    const edge = shapeElement('rectangle', 120, 100, { id: 6, x: 10.3, y: 180.3 });
    expect(enclosedBy(sceneOf(edge), { x: 10.3, y: 180.3, width: 120, height: 100 })).toStrictEqual(
      [testId(6)],
    );
  });

  it('needs the four rotated corners of a box kind inside', () => {
    const turned = shapeElement('rectangle', 100, 20, {
      id: 4,
      x: 50,
      y: 90,
      rotation: Math.PI / 4,
    });
    const scene = sceneOf(turned);
    // Turned by 45° about (100, 100), its corners reach about 42.4 units from the centre.
    expect(enclosedBy(scene, box(50, 90, 150, 110))).toStrictEqual([]);
    expect(enclosedBy(scene, box(57, 57, 143, 143))).toStrictEqual([testId(4)]);
  });

  it('needs every point of a point kind inside, not the corners of its box', () => {
    const corner = lineElement(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      { id: 5, x: 0, y: 0, rotation: Math.PI / 4 },
    );
    const scene = sceneOf(corner);
    expect(enclosedBy(scene, box(40, -30, 130, 130))).toStrictEqual([testId(5)]);
    expect(enclosedBy(scene, box(40, -30, 130, 120))).toStrictEqual([]);
  });

  it('never encloses the kinds that P0 does not draw', () => {
    const everything = { x: -1e8, y: -1e8, width: 2e8, height: 2e8 };
    const ids = enclosedBy(fixtureStore(), everything);
    expect(ids).toStrictEqual(['0', '1', '2', '3', '4', '5'].map((n) => `E${n.padStart(21, '0')}`));
  });
});

/** The scene points of an element's outline: every point of a point kind, else its box corners. */
function outlineOf(element: Element) {
  const turned = { ...localBox(element), rotation: element.rotation };
  return 'points' in element
    ? element.points.map((p) => obbToScene(turned, p))
    : obbCorners(turned);
}

/** A scan of every element with a geometry for those whose outline lies inside `box`. */
const scan = (scene: SceneReader, box: Aabb) =>
  bruteOrder(
    scene
      .ordered()
      .filter((e) => geometryOf(e) !== undefined)
      .filter((e) => outlineOf(e).every((p) => aabbContainsPoint(box, p))),
  );

describe('marquee enclosure over the spatial index', () => {
  it('finds what a scan of every element finds, on random scenes and boxes', () => {
    const anyCase = (random: Random) => ({
      changes: anySceneLoad(random, 30),
      marquee: anyQueryBox(random),
    });
    checkProperty({ seed: 6104, runs: 300 }, anyCase, ({ changes, marquee }) => {
      const scene = createSceneStore({ background: color('#ffffff') });
      scene.apply(changes, 'load');
      const found = enclosedBy(scene, marquee);
      // Corners that lie on an edge may round to either side of it in the scan's own arithmetic.
      const loose = scan(scene, aabbExpand(marquee, 1e-6));
      expect(found.filter((id) => !loose.includes(id))).toStrictEqual([]);
      expect(scan(scene, marquee).filter((id) => !found.includes(id))).toStrictEqual([]);
    });
  });
});
