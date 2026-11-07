import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import { selectionFrame } from '../../../src/selection/frame.ts';
import type { SelectionFrame } from '../../../src/selection/frame.ts';
import { handleAt, layoutHandles } from '../../../src/selection/handles.ts';
import type { Handle } from '../../../src/selection/handles.ts';
import { hitTest } from '../../../src/selection/hit-test.ts';
import { lineElement, sceneOf, shapeElement, testId, textElement } from '../../support/elements.ts';

const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };

/** Each handle's centre, rounded to 10⁻⁹, by name. */
const centres = (handles: readonly Handle[]) =>
  Object.fromEntries(
    handles.map(({ handle, center }) => [
      handle,
      [Math.round(center.x * 1e9) / 1e9 + 0, Math.round(center.y * 1e9) / 1e9 + 0],
    ]),
  );

const box = (
  x: number,
  y: number,
  [width, height]: readonly [number, number],
  rotation = 0,
): SelectionFrame => ({ type: 'box', box: { x, y, width, height, rotation } });

describe('the selection frame', () => {
  const rectangle = shapeElement('rectangle', 200, 100, { id: 1, x: 100, y: 100, rotation: 0.5 });
  const twoPoint = lineElement(
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ],
    { id: 2, x: 0, y: 0, rotation: Math.PI / 2 },
  );
  const threePoint = lineElement(
    [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 30 },
    ],
    { id: 3, x: 500, y: 500 },
  );
  const scene = sceneOf(rectangle, twoPoint, threePoint);

  it('is absent without a selected element that the scene holds', () => {
    expect(selectionFrame(scene, [])).toBeNull();
    expect(selectionFrame(scene, [testId(9)])).toBeNull();
  });

  it('is the rotated box of one element, and the ends of a lone two-point line', () => {
    expect(selectionFrame(scene, [testId(1), testId(9)])).toStrictEqual(
      box(100, 100, [200, 100], 0.5),
    );
    expect(selectionFrame(scene, [testId(3)])).toStrictEqual(box(500, 500, [40, 30]));
    const ends = selectionFrame(scene, [testId(2)]);
    expect(ends?.type).toBe('ends');
    if (ends?.type !== 'ends') return;
    expect(
      [ends.start.x, ends.start.y, ends.end.x, ends.end.y].map(
        (v) => Math.round(v * 1e9) / 1e9 + 0,
      ),
    ).toStrictEqual([20, -20, 20, 20]);
  });

  it('is the axis-aligned box of the rotated corners of several elements', () => {
    const frame = selectionFrame(scene, [testId(2), testId(3)]);
    expect(frame?.type).toBe('box');
    if (frame?.type !== 'box') return;
    expect(
      [frame.box.x, frame.box.y, frame.box.width, frame.box.height, frame.box.rotation].map(
        (v) => Math.round(v * 1e9) / 1e9 + 0,
      ),
    ).toStrictEqual([20, -20, 520, 550, 0]);
  });
});

describe('the handles of a selection box', () => {
  it('REQ-S12 puts eight resize handles on the box and the rotation handle 24 px above its top centre', () => {
    const handles = layoutHandles(box(100, 100, [200, 100]), ZOOM_1, 'mouse');
    expect(handles.map(({ handle }) => handle)).toStrictEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'rotate',
      'n',
      'e',
      's',
      'w',
    ]);
    expect(centres(handles)).toStrictEqual({
      nw: [100, 100],
      ne: [300, 100],
      se: [300, 200],
      sw: [100, 200],
      rotate: [200, 76],
      n: [200, 100],
      e: [300, 150],
      s: [200, 200],
      w: [100, 150],
    });
    expect(handles.every(({ size, hitSize }) => size === 8 && hitSize === 12)).toBe(true);
  });

  it('REQ-Y06 draws touch handles at 12 px and hits them through squares of at least 24 px', () => {
    const handles = layoutHandles(box(100, 100, [200, 100]), ZOOM_1, 'touch');
    expect(handles).toHaveLength(9);
    expect(handles.every(({ size, hitSize }) => size === 12 && hitSize >= 24)).toBe(true);
    expect(handles.every(({ hitSize }) => hitSize === 24)).toBe(true);
  });

  it('places the handles in screen space, so their size does not change with the zoom', () => {
    const camera = { x: 50, y: -10, zoom: 2 };
    const handles = layoutHandles(box(100, 100, [200, 100]), camera, 'mouse');
    expect(centres(handles)).toMatchObject({ nw: [100, 220], se: [500, 420], rotate: [300, 196] });
    expect(handles.every(({ size }) => size === 8)).toBe(true);
  });

  it('turns every handle and the rotation handle offset with a rotated box', () => {
    const handles = layoutHandles(box(100, 100, [200, 100], Math.PI / 2), ZOOM_1, 'mouse');
    expect(centres(handles)).toMatchObject({
      nw: [250, 50],
      n: [250, 150],
      se: [150, 250],
      rotate: [274, 150],
    });
  });

  it('REQ-S12 hides the side handles of a side shorter on screen than three hit squares', () => {
    const names = (frame: SelectionFrame, camera: Camera, pointer: 'mouse' | 'touch') =>
      layoutHandles(frame, camera, pointer).map(({ handle }) => handle);
    const flat = box(0, 0, [200, 60]);
    expect(names(flat, ZOOM_1, 'touch')).toStrictEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'rotate',
      'n',
      's',
    ]);
    expect(names(flat, ZOOM_1, 'mouse')).toHaveLength(9);
    expect(names(flat, { x: 0, y: 0, zoom: 0.5 }, 'mouse')).toStrictEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'rotate',
      'n',
      's',
    ]);
    expect(names(box(0, 0, [36, 36]), ZOOM_1, 'mouse')).toHaveLength(9);
    expect(names(box(0, 0, [35.9, 35.9]), ZOOM_1, 'mouse')).toStrictEqual([
      'nw',
      'ne',
      'se',
      'sw',
      'rotate',
    ]);
  });
});

describe('the handles of a lone text (ENG-06 m3)', () => {
  const text = textElement(400, 200, { id: 1 });
  const rectangle = shapeElement('rectangle', 400, 200, { id: 2, x: 500 });

  /** The handles' names for a selection of the scene's elements, at zoom 1 with a mouse. */
  const names = (ids: readonly number[]) => {
    const frame = selectionFrame(sceneOf(text, rectangle), ids.map(testId));
    return frame === null ? [] : layoutHandles(frame, ZOOM_1, 'mouse').map(({ handle }) => handle);
  };

  it('REQ-S12 are its four corners and the rotation handle, with no side handles however large', () => {
    expect(names([1])).toEqual(['nw', 'ne', 'se', 'sw', 'rotate']);
  });

  it('let a press on the middle of a side hit the text itself, not a handle', () => {
    const view = { scene: sceneOf(text), selection: [testId(1)], camera: ZOOM_1 };
    expect(hitTest(view, { x: 200, y: 0 }, 'mouse')).toEqual({ type: 'element', id: testId(1) });
    expect(hitTest(view, { x: 400, y: 100 }, 'touch')).toEqual({ type: 'element', id: testId(1) });
  });

  it('keep the side handles of a selection that holds a text and another element', () => {
    expect(names([1, 2])).toEqual(['nw', 'ne', 'se', 'sw', 'rotate', 'n', 'e', 's', 'w']);
  });
});

describe('the handles of a lone two-point line', () => {
  it('are its start and end, with no box', () => {
    const frame: SelectionFrame = { type: 'ends', start: { x: 10, y: 20 }, end: { x: 70, y: 20 } };
    const handles = layoutHandles(frame, { x: 0, y: 0, zoom: 2 }, 'touch');
    expect(centres(handles)).toStrictEqual({ start: [20, 40], end: [140, 40] });
    expect(handles.every(({ size, hitSize }) => size === 12 && hitSize === 24)).toBe(true);
  });
});

describe('the hit squares', () => {
  it('hold a press up to half a square from the centre on each axis, edges included', () => {
    const touch = layoutHandles(box(100, 100, [200, 100]), ZOOM_1, 'touch');
    expect([
      handleAt(touch, { x: 312, y: 212 }),
      handleAt(touch, { x: 288, y: 188 }),
    ]).toStrictEqual(['se', 'se']);
    expect([
      handleAt(touch, { x: 312.5, y: 200 }),
      handleAt(touch, { x: 200, y: 150 }),
    ]).toStrictEqual([undefined, undefined]);
    const mouse = layoutHandles(box(100, 100, [200, 100]), ZOOM_1, 'mouse');
    expect([
      handleAt(mouse, { x: 306, y: 200 }),
      handleAt(mouse, { x: 306.5, y: 200 }),
    ]).toStrictEqual(['se', undefined]);
  });

  it('go to the first handle in layout order where they overlap: corners, then rotation, then sides', () => {
    const tiny = layoutHandles(box(0, 0, [4, 4]), ZOOM_1, 'touch');
    expect(handleAt(tiny, { x: 2, y: 2 })).toBe('nw');
    expect(handleAt(tiny, { x: 2, y: -12 })).toBe('nw');
    expect(handleAt(tiny, { x: 2, y: -13 })).toBe('rotate');
  });
});
