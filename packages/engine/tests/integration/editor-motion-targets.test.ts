import { describe, expect, it } from 'vitest';

import { screenFromScene } from '../../src/camera/camera.ts';
import type { Camera } from '../../src/camera/camera.ts';
import { editorHarness } from '../support/editors.ts';
import type { EditorHarness } from '../support/editors.ts';
import { wheelEvent } from '../support/inputs.ts';
import { RECTANGLE, selectionDocument } from '../support/selection-scene.ts';
import { boxOf, dragFrom } from '../support/transform-scene.ts';

// Motion and targets in the engine (docs/architecture/engine/quality.md#accessibility, REQ-Y06):
// no camera change is animated, so each is drawn whole in the next frame and asks for no frame
// after it; and a touch press hits a handle through a square of 24 screen (CSS) px at any zoom.

/** The cameras of the frames drawn over the next few animation frames. */
function framesAfter(harness: EditorHarness): Camera[] {
  const cameras: Camera[] = [];
  for (let frame = 0; frame < 4; frame += 1) {
    cameras.push(...harness.next().map(({ camera }) => camera));
  }
  return cameras;
}

describe('camera changes without motion', () => {
  it('REQ-Y06 draws each zoom and pan whole in the next frame and asks for no frame after it', () => {
    const harness = editorHarness(selectionDocument());
    const changes = [
      () => harness.editor.run('view.zoom-in'),
      () => harness.editor.run('view.zoom-out'),
      () => harness.editor.run('view.zoom-to-fit'),
      () => harness.editor.run('view.zoom-reset'),
      () => harness.editor.input(wheelEvent({ x: 300, y: 200 }, { x: 0, y: 120 })),
      () => harness.editor.input(wheelEvent({ x: 300, y: 200 }, { x: 0, y: -100 }, { zoom: true })),
    ];
    for (const change of changes) {
      change();
      const final = harness.editor.view.camera;
      expect(framesAfter(harness)).toEqual([final]);
      expect(harness.scheduler.pending()).toBe(0);
    }
  });
});

describe('touch handle hit squares', () => {
  /** The rectangle's box after a touch drag of 20 screen px from `offset` px past its corner. */
  function resizedFrom(zoomIns: number, offset: number): number[] {
    const harness = editorHarness(selectionDocument());
    for (let step = 0; step < zoomIns; step += 1) harness.editor.run('view.zoom-in');
    harness.editor.select([RECTANGLE]);
    const corner = screenFromScene({ x: 300, y: 200 }, harness.editor.view.camera);
    const [x, y] = [corner.x + offset, corner.y + offset];
    const { start, to, end } = dragFrom('touch', [x, y, x + 20, y + 20]);
    harness.feed(...start, to, end);
    const rectangle = harness.editor.view.elements.find(({ id }) => id === RECTANGLE);
    return rectangle === undefined ? [] : boxOf(rectangle);
  }

  it('REQ-Y06 hits a corner handle 11.5 px off it along both axes, at zoom 1 and at zoom 2', () => {
    expect(resizedFrom(0, 11.5)).toEqual([100, 100, 220, 120]);
    expect(resizedFrom(4, 11.5)).toEqual([100, 100, 210, 110]);
  });

  it('REQ-Y06 misses it 12.5 px off, outside the 24 px square', () => {
    expect(resizedFrom(0, 12.5)).toEqual([100, 100, 200, 100]);
    expect(resizedFrom(4, 12.5)).toEqual([100, 100, 200, 100]);
  });
});
