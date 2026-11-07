import { describe, expect, it } from 'vitest';

import { screenFromScene } from '../../src/camera/camera.ts';
import type { Point } from '../../src/model/elements.ts';
import { editorHarness } from '../support/editors.ts';
import type { EditorHarness } from '../support/editors.ts';
import { wheelEvent } from '../support/inputs.ts';
import { POINTERS, drag, marqueesOf, tapper } from '../support/selection-input.ts';
import { ELLIPSE, LINE, RECTANGLE, selectionDocument } from '../support/selection-scene.ts';

// Selection through the editor at a zoomed and panned camera, where a screen point is not the
// scene point (the ENG-09 review's m2): presses hit, and marquees enclose, in scene units.

/** Zooms in four ladder steps to 2, then pans; returns where the camera shows a scene point. */
function zoomedAndPanned({ editor }: EditorHarness): (point: Point) => Point {
  for (let step = 0; step < 4; step += 1) editor.run('view.zoom-in');
  editor.input(wheelEvent({ x: 0, y: 0 }, { x: -400, y: -200 }));
  const { camera } = editor.view;
  expect(camera.zoom).toBe(2);
  return (point) => screenFromScene(point, camera);
}

const shifted = ({ x, y }: Point, dy: number): readonly [number, number] => [x, y + dy];

describe.each(POINTERS)('selection at a zoomed and panned camera, with %s input', (pointer) => {
  it('REQ-S05 REQ-S10 a press hits the element shown under it, not the one at its screen point', () => {
    const harness = editorHarness(selectionDocument());
    const screen = zoomedAndPanned(harness);
    const tap = tapper(pointer);
    const ellipse = screen({ x: 450, y: 150 });
    harness.feed(...tap(ellipse.x, ellipse.y));
    expect(harness.editor.view.selection).toEqual([ELLIPSE]);
    // The ellipse's scene point, as a screen point, shows empty canvas between the two shapes.
    harness.feed(...tap(450, 150));
    expect(harness.editor.view.selection).toEqual([]);
  });

  it('REQ-S06 a marquee runs and encloses in scene units', () => {
    const harness = editorHarness(selectionDocument());
    const screen = zoomedAndPanned(harness);
    const from = screen({ x: 50, y: 50 });
    const to = screen({ x: 610, y: 250 });
    const marquee = drag(pointer, [from.x, from.y, to.x, to.y]);
    harness.feed(...marquee.start, marquee.to);
    const [box] = marqueesOf(harness.next());
    expect(box?.x).toBeCloseTo(from.x, 9);
    expect(box?.y).toBeCloseTo(from.y, 9);
    expect(box?.width).toBeCloseTo(1_120, 9);
    expect(box?.height).toBeCloseTo(400, 9);
    harness.feed(marquee.end);
    expect(harness.editor.view.selection).toEqual([RECTANGLE, ELLIPSE]);
  });
});

describe('the touch tolerance at a zoomed camera', () => {
  it('REQ-S03 a touch hits a line within 6 screen pixels, which are 3 scene units at zoom 2', () => {
    const harness = editorHarness(selectionDocument());
    const screen = zoomedAndPanned(harness);
    const tap = tapper('touch');
    // The 2-unit stroke adds 1 unit: a press hits within 4 units, or 8 px, of the line's axis.
    harness.feed(...tap(...shifted(screen({ x: 200, y: 400 }), 7)));
    expect(harness.editor.view.selection).toEqual([LINE]);
    harness.feed(...tap(...shifted(screen({ x: 200, y: 400 }), 9)));
    expect(harness.editor.view.selection).toEqual([]);
  });
});
