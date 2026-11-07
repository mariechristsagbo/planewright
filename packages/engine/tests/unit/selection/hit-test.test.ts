import { describe, expect, it } from 'vitest';

import { screenFromScene } from '../../../src/camera/camera.ts';
import type { Camera } from '../../../src/camera/camera.ts';
import type { Point } from '../../../src/model/elements.ts';
import { hitTest } from '../../../src/selection/hit-test.ts';
import type { HitResult } from '../../../src/selection/hit-test.ts';
import type { PointerKind } from '../../../src/selection/pointer.ts';
import type { SceneReader } from '../../../src/scene/store.ts';
import {
  SOLID,
  lineElement,
  sceneOf,
  shapeElement,
  testId,
  textElement,
} from '../../support/elements.ts';
import { fixtureStore } from '../../support/stores.ts';

const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };
const ZOOM_2: Camera = { x: 0, y: 0, zoom: 2 };
const POINTERS: readonly PointerKind[] = ['mouse', 'pen', 'touch'];

const hit = (id: number): HitResult => ({ type: 'element', id: testId(id) });
const NONE: HitResult = { type: 'none' };

/** What a press hits `offset` screen pixels below a scene point, under a camera. */
function pressNear(scene: SceneReader, camera: Camera, point: Point) {
  const screen = screenFromScene(point, camera);
  return (offset: number, pointer: PointerKind): HitResult =>
    hitTest({ scene, selection: [], camera }, { x: screen.x, y: screen.y + offset }, pointer);
}

// A horizontal 2-unit line at y = 100 and an unfilled rectangle whose top edge lies there too.
const line = lineElement(
  [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ],
  { id: 1, x: 100, y: 100 },
);
const box = shapeElement('rectangle', 200, 100, { id: 2, x: 100, y: 100 });

describe('REQ-S03 the hit ladder at zoom 1, from the centre line', () => {
  for (const [name, element] of [
    ['line', line],
    ['unfilled rectangle edge', box],
  ] as const) {
    it(`hits 4 and 5 px from a ${name} and misses 8 and 9 px, on either side, for every pointer`, () => {
      const press = pressNear(sceneOf(element), ZOOM_1, { x: 200, y: 100 });
      for (const pointer of POINTERS) {
        const results = [4, 5, 8, 9, -4, -5, -8, -9].map((offset) => press(offset, pointer));
        const id = element === line ? 1 : 2;
        expect(results).toStrictEqual([hit(id), hit(id), NONE, NONE, hit(id), hit(id), NONE, NONE]);
      }
    });
  }

  it('puts the limit at 6 px for a mouse or pen and 7 px for touch', () => {
    const press = pressNear(sceneOf(line), ZOOM_1, { x: 200, y: 100 });
    expect([
      press(6, 'mouse'),
      press(6.5, 'mouse'),
      press(6, 'pen'),
      press(6.5, 'pen'),
    ]).toStrictEqual([hit(1), NONE, hit(1), NONE]);
    expect([press(7, 'touch'), press(7.5, 'touch')]).toStrictEqual([hit(1), NONE]);
  });
});

describe('REQ-S03 the same ladder at zoom 2, in screen pixels', () => {
  it('hits 3 and 4 px from the stroke edge and misses 7 and 8 px, for every pointer', () => {
    // A 2-unit stroke is 4 px wide at zoom 2, so its edge lies 2 px from the centre line.
    const press = pressNear(sceneOf(line), ZOOM_2, { x: 200, y: 100 });
    for (const pointer of POINTERS) {
      const results = [5, 6, 9, 10, -5, -6, -9, -10].map((offset) => press(offset, pointer));
      expect(results).toStrictEqual([hit(1), hit(1), NONE, NONE, hit(1), hit(1), NONE, NONE]);
    }
  });

  it('hits 4 and 5 px from the centre line and misses 9 px, while 8 px is the touch limit', () => {
    const press = pressNear(sceneOf(line), ZOOM_2, { x: 200, y: 100 });
    for (const pointer of POINTERS) {
      expect([press(4, pointer), press(5, pointer), press(9, pointer)]).toStrictEqual([
        hit(1),
        hit(1),
        NONE,
      ]);
    }
    expect([press(7, 'mouse'), press(7.5, 'mouse'), press(8, 'mouse')]).toStrictEqual([
      hit(1),
      NONE,
      NONE,
    ]);
    expect([press(8, 'touch'), press(8.5, 'touch')]).toStrictEqual([hit(1), NONE]);
  });
});

describe('REQ-S01 closed shapes, filled and unfilled', () => {
  for (const kind of ['rectangle', 'ellipse', 'diamond'] as const) {
    it(`does not hit an unfilled ${kind} at its centre and hits a filled one there`, () => {
      const unfilled = shapeElement(kind, 200, 100, { id: 3, x: 100, y: 100 });
      const filled = shapeElement(kind, 200, 100, {
        id: 4,
        x: 100,
        y: 100,
        style: { fill: SOLID },
      });
      const centre = { x: 200, y: 150 };
      expect(pressNear(sceneOf(unfilled), ZOOM_1, centre)(0, 'mouse')).toStrictEqual(NONE);
      expect(pressNear(sceneOf(filled), ZOOM_1, centre)(0, 'touch')).toStrictEqual(hit(4));
    });
  }

  it('hits a filled rectangle just outside its outline as it hits an unfilled one', () => {
    const filled = shapeElement('rectangle', 200, 100, {
      id: 4,
      x: 100,
      y: 100,
      style: { fill: SOLID },
    });
    const press = pressNear(sceneOf(filled), ZOOM_1, { x: 200, y: 100 });
    expect([press(-6, 'mouse'), press(-6.5, 'mouse'), press(30, 'mouse')]).toStrictEqual([
      hit(4),
      NONE,
      hit(4),
    ]);
  });
});

describe('REQ-S02 texts', () => {
  it('hits a text anywhere in its box and within the tolerance outside it, without its stroke', () => {
    const scene = sceneOf(textElement(42.5, 25, { id: 5, x: 300, y: 300 }));
    const press = (x: number, y: number) =>
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x, y }, 'mouse');
    expect([press(321.25, 312.5), press(301, 301), press(342, 324), press(300, 312)]).toStrictEqual(
      [hit(5), hit(5), hit(5), hit(5)],
    );
    expect([press(295, 312), press(294.5, 312), press(300, 330.5)]).toStrictEqual([
      hit(5),
      NONE,
      NONE,
    ]);
  });
});

describe('REQ-S04 overlapping elements', () => {
  it('lets the topmost in drawing order win', () => {
    const lower = shapeElement('rectangle', 100, 100, {
      id: 6,
      order: 'V',
      style: { fill: SOLID },
    });
    const upper = shapeElement('rectangle', 100, 100, {
      id: 7,
      order: 'W',
      x: 50,
      style: { fill: SOLID },
    });
    const press = (scene: SceneReader) =>
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x: 75, y: 50 }, 'mouse');
    expect(press(sceneOf(lower, upper))).toStrictEqual(hit(7));
    expect(
      press(sceneOf({ ...lower, order: upper.order }, { ...upper, order: lower.order })),
    ).toStrictEqual(hit(6));
  });

  it('passes through the inside of an unfilled upper shape to the element below', () => {
    const lower = shapeElement('rectangle', 100, 100, {
      id: 6,
      order: 'V',
      style: { fill: SOLID },
    });
    const upper = shapeElement('rectangle', 100, 100, { id: 7, order: 'W', x: 20, y: 20 });
    const scene = sceneOf(lower, upper);
    expect(
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x: 60, y: 60 }, 'mouse'),
    ).toStrictEqual(hit(6));
    expect(
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x: 60, y: 21 }, 'mouse'),
    ).toStrictEqual(hit(7));
  });
});

describe('rotated elements', () => {
  it('REQ-T02 hit-test in their local frame', () => {
    const turned = shapeElement('rectangle', 200, 20, {
      id: 8,
      x: 100,
      y: 100,
      rotation: Math.PI / 2,
      style: { fill: SOLID },
    });
    const scene = sceneOf(turned);
    const press = (x: number, y: number) =>
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x, y }, 'mouse');
    expect([press(200, 30), press(205, 200), press(120, 110), press(250, 110)]).toStrictEqual([
      hit(8),
      hit(8),
      NONE,
      NONE,
    ]);
  });
});

describe('kinds that P0 does not draw', () => {
  it('are never hit', () => {
    const scene = fixtureStore();
    expect(
      hitTest({ scene, selection: [], camera: ZOOM_1 }, { x: 625, y: -287.5 }, 'touch'),
    ).toStrictEqual(NONE);
  });
});
