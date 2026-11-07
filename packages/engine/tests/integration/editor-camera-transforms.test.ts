import { describe, expect, it } from 'vitest';

import { screenFromScene } from '../../src/camera/camera.ts';
import { testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import { wheelEvent } from '../support/inputs.ts';
import { POINTERS, tapper } from '../support/selection-input.ts';
import { documentOf } from '../support/selection-scene.ts';
import { boxOf, dragFrom, filledBox, sceneWatcher } from '../support/transform-scene.ts';

// Transforms at a zoomed and panned camera, where a screen point is not the scene point: presses
// hit through the camera and drags move and resize by scene deltas, half the pointer's at zoom 2.

const FIRST = testId(1);

/** An editor over one rectangle at zoom 2, panned, and where the camera shows a scene point. */
function zoomedAndPanned() {
  const harness = editorHarness(documentOf(filledBox(1, [100, 100, 200, 100])));
  for (let step = 0; step < 4; step += 1) harness.editor.run('view.zoom-in');
  harness.editor.input(wheelEvent({ x: 0, y: 0 }, { x: -400, y: -200 }));
  const { camera } = harness.editor.view;
  expect(camera.zoom).toBe(2);
  const screen = (x: number, y: number) => screenFromScene({ x, y }, camera);
  return { harness, screen, shown: sceneWatcher(harness) };
}

const rounded = (values: readonly number[]) => values.map((value) => Math.round(value * 1e6) / 1e6);

describe.each(POINTERS)('transforms at a zoomed and panned camera, with %s input', (pointer) => {
  it('REQ-T01 a move follows the pointer by the scene delta', () => {
    const { harness, screen, shown } = zoomedAndPanned();
    const centre = screen(200, 150);
    harness.feed(...tapper(pointer)(centre.x, centre.y));
    const { start, to, end } = dragFrom(pointer, [
      centre.x,
      centre.y,
      centre.x + 80,
      centre.y + 40,
    ]);
    harness.feed(...start, to, end);
    expect(rounded(boxOf(shown(FIRST)))).toEqual([140, 120, 200, 100]);
  });

  it('REQ-T02 a resize handle is found and dragged through the camera', () => {
    const { harness, screen, shown } = zoomedAndPanned();
    const centre = screen(200, 150);
    harness.feed(...tapper(pointer)(centre.x, centre.y));
    const corner = screen(300, 200);
    const { start, to, end } = dragFrom(pointer, [
      corner.x,
      corner.y,
      corner.x + 60,
      corner.y + 40,
    ]);
    harness.feed(...start, to, end);
    expect(rounded(boxOf(shown(FIRST)))).toEqual([100, 100, 230, 120]);
  });
});
