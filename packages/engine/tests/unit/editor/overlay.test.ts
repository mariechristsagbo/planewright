import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import { overlayPrimitives } from '../../../src/editor/overlay.ts';
import type { OverlayState } from '../../../src/editor/overlay.ts';
import type { OverlayPrimitive } from '../../../src/editor/render-frame.ts';
import type { Point } from '../../../src/model/elements.ts';
import { lineElement, sceneOf, shapeElement, testId } from '../../support/elements.ts';

// The overlay layer's primitives (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-overlay-layer),
// all in screen space: the selection outline, the handles at their drawn size, and the marquee.

const CAMERA: Camera = { x: 10, y: 20, zoom: 2 };
const NONE: OverlayState = { camera: CAMERA, selection: [], pointer: 'mouse', marquee: null };

// A 100 × 50 rectangle at (30, 40), shown from (40, 40) to (240, 140) on screen.
const box = shapeElement('rectangle', 100, 50, { id: 1, x: 30, y: 40 });

const handle = (id: string, center: Point, size = 8): OverlayPrimitive =>
  ({ type: 'handle', handle: id, center, size }) as OverlayPrimitive;

describe('the overlay primitives', () => {
  it('outline one selected element and give it its eight handles and the rotation handle', () => {
    const scene = sceneOf(box);
    expect(overlayPrimitives(scene, { ...NONE, selection: [box.id] })).toStrictEqual([
      {
        type: 'selection-outline',
        corners: [
          { x: 40, y: 40 },
          { x: 240, y: 40 },
          { x: 240, y: 140 },
          { x: 40, y: 140 },
        ],
      },
      handle('nw', { x: 40, y: 40 }),
      handle('ne', { x: 240, y: 40 }),
      handle('se', { x: 240, y: 140 }),
      handle('sw', { x: 40, y: 140 }),
      handle('rotate', { x: 140, y: 16 }),
      handle('n', { x: 140, y: 40 }),
      handle('e', { x: 240, y: 90 }),
      handle('s', { x: 140, y: 140 }),
      handle('w', { x: 40, y: 90 }),
    ]);
  });

  it('draw the handles at 12 px for touch and 8 px for a mouse or pen', () => {
    const scene = sceneOf(box);
    const sizes = (pointer: OverlayState['pointer']) =>
      overlayPrimitives(scene, { ...NONE, selection: [box.id], pointer }).flatMap((primitive) =>
        primitive.type === 'handle' ? [primitive.size] : [],
      );
    expect(sizes('touch')).toEqual(Array(9).fill(12));
    expect(sizes('pen')).toEqual(Array(9).fill(8));
  });

  it("outline a rotated element along its own box's turned corners", () => {
    const turned = shapeElement('rectangle', 100, 50, { id: 1, rotation: Math.PI / 2 });
    const scene = sceneOf(turned);
    const [outline] = overlayPrimitives(scene, {
      ...NONE,
      camera: { x: 0, y: 0, zoom: 1 },
      selection: [turned.id],
    });
    // Turned a quarter about its centre (50, 25), the top-left corner moves to (75, −25).
    const expected = [
      { x: 75, y: -25 },
      { x: 75, y: 75 },
      { x: 25, y: 75 },
      { x: 25, y: -25 },
    ];
    expect(outline?.type).toBe('selection-outline');
    const corners = outline?.type === 'selection-outline' ? outline.corners : [];
    corners.forEach((corner, index) => {
      expect(corner.x).toBeCloseTo(expected[index]?.x ?? NaN, 9);
      expect(corner.y).toBeCloseTo(expected[index]?.y ?? NaN, 9);
    });
  });

  it('give a lone two-point line its start and end handles and no outline', () => {
    const line = lineElement(
      [
        { x: 0, y: 0 },
        { x: 50, y: 25 },
      ],
      { id: 2, x: 30, y: 40 },
    );
    expect(overlayPrimitives(sceneOf(line), { ...NONE, selection: [line.id] })).toStrictEqual([
      handle('start', { x: 40, y: 40 }),
      handle('end', { x: 140, y: 90 }),
    ]);
  });

  it('outline several elements by the axis-aligned box of them all', () => {
    const other = shapeElement('ellipse', 20, 20, { id: 2, x: 150, y: 0 });
    const scene = sceneOf(box, other);
    const [outline] = overlayPrimitives(scene, { ...NONE, selection: [box.id, other.id] });
    expect(outline).toStrictEqual({
      type: 'selection-outline',
      corners: [
        { x: 40, y: -40 },
        { x: 320, y: -40 },
        { x: 320, y: 140 },
        { x: 40, y: 140 },
      ],
    });
  });

  it('show nothing for an empty selection or for elements that the scene does not hold', () => {
    const scene = sceneOf(box);
    expect(overlayPrimitives(scene, NONE)).toEqual([]);
    expect(overlayPrimitives(scene, { ...NONE, selection: [testId(9)] })).toEqual([]);
  });

  it('turn the marquee from scene units into a screen box, drawn above the selection', () => {
    const scene = sceneOf(box);
    const marquee = { x: 20, y: 30, width: 40, height: 10 };
    expect(overlayPrimitives(scene, { ...NONE, marquee })).toStrictEqual([
      { type: 'marquee', box: { x: 20, y: 20, width: 80, height: 20 } },
    ]);
    const both = overlayPrimitives(scene, { ...NONE, selection: [box.id], marquee });
    expect(both.map(({ type }) => type)).toEqual([
      'selection-outline',
      ...Array<string>(9).fill('handle'),
      'marquee',
    ]);
  });
});
