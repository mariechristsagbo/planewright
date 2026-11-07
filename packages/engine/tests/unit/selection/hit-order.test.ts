import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import type { ElementId } from '../../../src/model/ids.ts';
import { hitTest } from '../../../src/selection/hit-test.ts';
import type { HitResult } from '../../../src/selection/hit-test.ts';
import type { PointerKind } from '../../../src/selection/pointer.ts';
import type { SceneReader } from '../../../src/scene/store.ts';
import { SOLID, lineElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';

const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };
const NONE: HitResult = { type: 'none' };
const BOX: HitResult = { type: 'selection-box' };
const element = (id: number): HitResult => ({ type: 'element', id: testId(id) });
const handle = (name: string): HitResult => ({ type: 'handle', handle: name }) as HitResult;

const press =
  (scene: SceneReader, selection: readonly ElementId[]) =>
  (x: number, y: number, pointer: PointerKind = 'mouse'): HitResult =>
    hitTest({ scene, selection, camera: ZOOM_1 }, { x, y }, pointer);

// An unfilled 200 by 100 rectangle at (100, 100), a filled one over its bottom-right corner, and a
// small filled one inside it.
const outlined = shapeElement('rectangle', 200, 100, { id: 1, order: 'V', x: 100, y: 100 });
const over = shapeElement('rectangle', 60, 60, {
  id: 2,
  order: 'W',
  x: 280,
  y: 180,
  style: { fill: SOLID },
});
const inner = shapeElement('rectangle', 20, 20, {
  id: 3,
  order: 'X',
  x: 150,
  y: 120,
  style: { fill: SOLID },
});
const scene = sceneOf(outlined, over, inner);

describe('the order of hit testing', () => {
  it('tries the handles of the selection before any element, the topmost included', () => {
    expect(press(scene, [testId(1)])(300, 200)).toStrictEqual(handle('se'));
    expect(press(scene, [])(300, 200)).toStrictEqual(element(2));
  });

  it('hits a touch handle through its 24 px square and a mouse handle through its 12 px one', () => {
    const at = press(sceneOf(outlined), [testId(1)]);
    expect([at(88, 112, 'touch'), at(88, 112, 'mouse'), at(94, 106, 'mouse')]).toStrictEqual([
      handle('nw'),
      NONE,
      handle('nw'),
    ]);
  });

  it('then the elements, even inside the selection box', () => {
    expect(press(scene, [testId(1)])(160, 130)).toStrictEqual(element(3));
    expect(press(scene, [testId(1)])(150, 101)).toStrictEqual(element(1));
  });

  it('then the selection box, for a press inside it that hits no element', () => {
    expect(press(scene, [testId(1)])(200, 150)).toStrictEqual(BOX);
    expect(press(scene, [])(200, 150)).toStrictEqual(NONE);
    expect(press(scene, [testId(1)])(200, 250)).toStrictEqual(NONE);
  });

  it('reads the box of a rotated selection in its own orientation', () => {
    const turned = shapeElement('rectangle', 200, 40, {
      id: 4,
      x: 100,
      y: 100,
      rotation: Math.PI / 2,
    });
    const at = press(sceneOf(turned), [testId(4)]);
    expect([at(200, 60), at(130, 120)]).toStrictEqual([BOX, NONE]);
  });

  it('gives a lone two-point line its end handles and no selection box', () => {
    const line = lineElement(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
      ],
      { id: 5, x: 0, y: 0 },
    );
    const at = press(sceneOf(line), [testId(5)]);
    expect([at(100, 100), at(0, 0), at(50, 50), at(90, 20)]).toStrictEqual([
      handle('end'),
      handle('start'),
      element(5),
      NONE,
    ]);
  });
});
