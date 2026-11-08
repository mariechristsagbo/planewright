import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import type { Element, Point } from '../../../src/model/elements.ts';
import { hitTest } from '../../../src/selection/hit-test.ts';
import type { HitResult } from '../../../src/selection/hit-test.ts';
import type { PointerKind } from '../../../src/selection/pointer.ts';
import {
  SOLID,
  freehandElement,
  lineElement,
  sceneOf,
  shapeElement,
  testId,
} from '../../support/elements.ts';

// Small selections (the ENG-10 review's m2): a selection shorter on screen than two handle hit
// squares along both sides is small, and a press on its elements or inside its box goes to them
// before the handles, so that a drag moves it; its handles still take the presses that miss it.

const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };

const element = (id: number): HitResult => ({ type: 'element', id: testId(id) });
const handle = (name: string): HitResult => ({ type: 'handle', handle: name }) as HitResult;
const BOX: HitResult = { type: 'selection-box' };

/** What a press at a screen point hits with the first element of the scene selected. */
function pressOn(elements: readonly Element[], camera: Camera = ZOOM_1) {
  const scene = sceneOf(...elements);
  const selection = [testId(1)];
  return (at: Point, pointer: PointerKind): HitResult =>
    hitTest({ scene, selection, camera }, at, pointer);
}

const filled = (width: number, height: number, x = 200, y = 200) =>
  shapeElement('rectangle', width, height, { id: 1, x, y, style: { fill: SOLID } });

describe('C1 a press on a small selection reaches it before the handles', () => {
  it('REQ-T01 a selected freehand dot is hit at its point, not by its four coinciding corners', () => {
    const press = pressOn([freehandElement([{ x: 0, y: 0 }], { id: 1, x: 200, y: 200 })]);
    expect(press({ x: 200, y: 200 }, 'mouse')).toStrictEqual(element(1));
    expect(press({ x: 202, y: 199 }, 'touch')).toStrictEqual(element(1));
  });

  it('REQ-T01 a 6 x 6 rectangle with a mouse is hit at its centre', () => {
    const press = pressOn([shapeElement('rectangle', 6, 6, { id: 1, x: 200, y: 200 })]);
    expect(press({ x: 203, y: 203 }, 'mouse')).toStrictEqual(element(1));
  });

  it('REQ-T01 the centre of an unfilled 20 x 20 rectangle with touch is its selection box', () => {
    const press = pressOn([shapeElement('rectangle', 20, 20, { id: 1, x: 200, y: 200 })]);
    expect(press({ x: 210, y: 210 }, 'touch')).toStrictEqual(BOX);
  });

  it('a short selected two-point line is hit between its ends', () => {
    const line = lineElement(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { id: 1, x: 200, y: 200 },
    );
    const press = pressOn([line]);
    expect(press({ x: 205, y: 200 }, 'mouse')).toStrictEqual(element(1));
    expect(press({ x: 194, y: 194 }, 'mouse')).toStrictEqual(handle('start'));
  });
});

describe('C1 the handles of a small selection still take presses that miss it', () => {
  it('a corner handle is hit outside the element and its box', () => {
    const press = pressOn([shapeElement('rectangle', 6, 6, { id: 1, x: 200, y: 200 })]);
    expect(press({ x: 195, y: 195 }, 'mouse')).toStrictEqual(handle('nw'));
    expect(press({ x: 211, y: 211 }, 'mouse')).toStrictEqual(handle('se'));
  });

  it('the rotation handle is hit 24 px above the top centre', () => {
    const press = pressOn([freehandElement([{ x: 0, y: 0 }], { id: 1, x: 200, y: 200 })]);
    expect(press({ x: 200, y: 176 }, 'mouse')).toStrictEqual(handle('rotate'));
  });

  it('an unselected element under a handle does not take the press from it', () => {
    const small = shapeElement('rectangle', 6, 6, { id: 1, order: 'b', x: 200, y: 200 });
    const below = shapeElement('rectangle', 300, 300, {
      id: 2,
      order: 'a',
      x: 100,
      y: 100,
      style: { fill: SOLID },
    });
    expect(pressOn([small, below])({ x: 195, y: 195 }, 'mouse')).toStrictEqual(handle('nw'));
  });
});

describe('C1 what makes a selection small', () => {
  it('both sides shorter than two hit squares on screen: 24 px for a mouse, 48 for touch', () => {
    expect(pressOn([filled(23, 23)])({ x: 200, y: 200 }, 'mouse')).toStrictEqual(element(1));
    expect(pressOn([filled(24, 23)])({ x: 200, y: 200 }, 'mouse')).toStrictEqual(handle('nw'));
    expect(pressOn([filled(23, 24)])({ x: 200, y: 200 }, 'mouse')).toStrictEqual(handle('nw'));
    expect(pressOn([filled(47, 47)])({ x: 200, y: 200 }, 'touch')).toStrictEqual(element(1));
    expect(pressOn([filled(48, 47)])({ x: 200, y: 200 }, 'touch')).toStrictEqual(handle('nw'));
  });

  it('a large selection keeps its handles first, over its own filled element', () => {
    expect(pressOn([filled(200, 100, 100, 100)])({ x: 100, y: 100 }, 'mouse')).toStrictEqual(
      handle('nw'),
    );
  });

  it('measures on screen, so the zoom decides', () => {
    const at2 = pressOn([filled(10, 10)], { x: 0, y: 0, zoom: 2 });
    expect(at2({ x: 400, y: 400 }, 'mouse')).toStrictEqual(element(1));
    const at3 = pressOn([filled(10, 10)], { x: 0, y: 0, zoom: 3 });
    expect(at3({ x: 600, y: 600 }, 'mouse')).toStrictEqual(handle('nw'));
  });

  it('a two-point line is small when its ends are closer than two hit squares on both axes', () => {
    const line = (dx: number, dy: number) =>
      lineElement(
        [
          { x: 0, y: 0 },
          { x: dx, y: dy },
        ],
        { id: 1, x: 200, y: 200 },
      );
    expect(pressOn([line(23, 0)])({ x: 201, y: 200 }, 'mouse')).toStrictEqual(element(1));
    expect(pressOn([line(24, 0)])({ x: 201, y: 200 }, 'mouse')).toStrictEqual(handle('start'));
    expect(pressOn([line(0, 24)])({ x: 200, y: 201 }, 'mouse')).toStrictEqual(handle('start'));
  });
});
