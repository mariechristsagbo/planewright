import { describe, expect, it } from 'vitest';

import type { OverlayPrimitive, RenderFrame } from '../../src/editor/render-frame.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { editorHarness } from '../support/editors.ts';
import { fixtureDocument } from '../support/fixtures.ts';
import { testId } from '../support/elements.ts';
import { fixtureId } from '../support/stores.ts';
import {
  ELLIPSE,
  LINE,
  RECTANGLE,
  SMALL,
  TEXT,
  selectionDocument,
} from '../support/selection-scene.ts';

// The selection as the editor holds it, and its chrome on the overlay, over a fixture document:
// nothing can be drawn to select until ENG-11 (ENG-09).

const primitivesOf = (frames: readonly RenderFrame[]): readonly OverlayPrimitive[] =>
  frames.at(-1)?.overlay?.primitives ?? [];

const handleNames = (frames: readonly RenderFrame[]) =>
  primitivesOf(frames).flatMap((primitive) =>
    primitive.type === 'handle' ? [primitive.handle] : [],
  );

/** An editor over the selection fixture with the given elements selected, and its next frames. */
function selected(...ids: readonly ElementId[]) {
  const harness = editorHarness(selectionDocument());
  harness.editor.select(ids);
  return { ...harness, frames: harness.next() };
}

describe('the selection chrome on the overlay', () => {
  it('REQ-S12 shows the outline, eight resize handles and the rotation handle above the top centre', () => {
    const { frames } = selected(RECTANGLE);
    expect(primitivesOf(frames)[0]).toEqual({
      type: 'selection-outline',
      corners: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 100, y: 200 },
      ],
    });
    expect(handleNames(frames)).toEqual(['nw', 'ne', 'se', 'sw', 'rotate', 'n', 'e', 's', 'w']);
    expect(primitivesOf(frames)[5]).toEqual({
      type: 'handle',
      handle: 'rotate',
      center: { x: 200, y: 76 },
      size: 8,
    });
  });

  it('REQ-S12 hides the side handles of a box too small on screen to hit them', () => {
    expect(handleNames(selected(SMALL).frames)).toEqual(['nw', 'ne', 'se', 'sw', 'rotate']);
  });

  it('REQ-S12 shows the side handles of the same box once it is large enough on screen', () => {
    const { editor, next } = selected(SMALL);
    for (let step = 0; step < 4; step += 1) editor.run('view.zoom-in');
    expect(editor.view.camera.zoom).toBeGreaterThanOrEqual(1.8);
    expect(handleNames(next())).toEqual(['nw', 'ne', 'se', 'sw', 'rotate', 'n', 'e', 's', 'w']);
  });

  it('shows a two-point line’s start and end handles on its ends, with no box', () => {
    expect(primitivesOf(selected(LINE).frames)).toEqual([
      { type: 'handle', handle: 'start', center: { x: 100, y: 400 }, size: 8 },
      { type: 'handle', handle: 'end', center: { x: 300, y: 400 }, size: 8 },
    ]);
  });

  it('shows a lone text’s corners and rotation handle, with no side handles', () => {
    expect(handleNames(selected(TEXT).frames)).toEqual(['nw', 'ne', 'se', 'sw', 'rotate']);
  });

  it('shows the axis-aligned outline of several elements with all its handles', () => {
    const { frames } = selected(RECTANGLE, ELLIPSE);
    expect(primitivesOf(frames)[0]).toMatchObject({
      corners: [
        { x: 100, y: 100 },
        { x: 500, y: 100 },
        { x: 500, y: 200 },
        { x: 100, y: 200 },
      ],
    });
    expect(handleNames(frames)).toHaveLength(9);
  });

  it('redraws only the overlay for a selection change, and nothing once it is cleared', () => {
    const { editor, next, frames } = selected(RECTANGLE);
    expect(frames.map(({ scene, overlay }) => [scene, overlay === undefined])).toEqual([
      [undefined, false],
    ]);
    editor.select([]);
    expect(primitivesOf(next())).toEqual([]);
  });
});

describe('the selection that the editor holds', () => {
  it('reports the selected elements that the document holds, each once, in the order given', () => {
    const { editor, views } = selected(ELLIPSE, RECTANGLE, ELLIPSE, testId(99));
    expect(editor.view.selection).toEqual([ELLIPSE, RECTANGLE]);
    expect(views.map(({ selection }) => selection)).toEqual([[ELLIPSE, RECTANGLE]]);
  });

  it('asks for no frame and publishes no view when the selection does not change', () => {
    const { editor, scheduler, views } = selected(RECTANGLE);
    editor.select([RECTANGLE]);
    expect(scheduler.pending()).toBe(0);
    expect(views).toHaveLength(1);
  });

  it('REQ-S13 never makes a selection change an undo step, nor the opened document', () => {
    const { editor } = selected(RECTANGLE, LINE);
    editor.select([TEXT]);
    editor.select([]);
    expect(editor.view).toMatchObject({ canUndo: false, canRedo: false, selection: [] });
  });

  it('opens the shared fixture document without an undo step and with nothing selected', () => {
    const { editor } = editorHarness(fixtureDocument());
    expect(editor.view).toMatchObject({ selection: [], canUndo: false });
    editor.select([fixtureId(9), fixtureId(0)]);
    expect(editor.view.selection).toEqual([fixtureId(9), fixtureId(0)]);
  });
});
