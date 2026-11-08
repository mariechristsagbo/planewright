import { describe, expect, it } from 'vitest';

import { KEYS, shownElements } from '../support/creation-input.ts';
import { editorHarness } from '../support/editors.ts';
import { POINTERS, drag, tapper } from '../support/selection-input.ts';
import { dragFrom } from '../support/transform-scene.ts';

// Drawing elements, then selecting them with the Selection tool through the editor (ENG-11), with
// a mouse and with touch: the engine side of the end-to-end checks. A filled-free rectangle is
// hit on its outline, so the presses land on the drawn edges.

/** An editor with a rectangle [100,100,100,80] and an ellipse [300,200,100,80], drawn by drags. */
function drawnPair(pointer: (typeof POINTERS)[number]) {
  const harness = editorHarness();
  const shown = shownElements(harness);
  for (const [key, points] of [
    [KEYS.rectangle, [100, 100, 200, 180]],
    [KEYS.ellipse, [300, 200, 400, 280]],
  ] as const) {
    const { start, to, end } = dragFrom(pointer, points);
    harness.feed(key, ...start, to, end);
  }
  const [rectangle, ellipse] = shown().map(({ id }) => id);
  if (rectangle === undefined || ellipse === undefined) throw new Error('Nothing was drawn.');
  return { harness, rectangle, ellipse };
}

describe.each(POINTERS)('selecting drawn elements, with %s input', (pointer) => {
  it('REQ-S01 REQ-S05 a press selects one, and Shift+press adds and removes', () => {
    const { harness, rectangle, ellipse } = drawnPair(pointer);
    const tap = tapper(pointer);
    expect(harness.editor.view.selection).toEqual([ellipse]);
    harness.feed(...tap(100, 140));
    expect(harness.editor.view.selection).toEqual([rectangle]);
    harness.feed(...tap(400, 240, true));
    expect(harness.editor.view.selection).toEqual([rectangle, ellipse]);
    harness.feed(...tap(100, 140, true));
    expect(harness.editor.view.selection).toEqual([ellipse]);
  });

  it('REQ-S06 a marquee selects what it encloses', () => {
    const { harness, rectangle, ellipse } = drawnPair(pointer);
    harness.feed(...tapper(pointer)(700, 500));
    expect(harness.editor.view.selection).toEqual([]);
    const marquee = drag(pointer, [50, 50, 250, 250]);
    harness.feed(...marquee.start, marquee.to, marquee.end);
    expect(harness.editor.view.selection).toEqual([rectangle]);
    const both = drag(pointer, [50, 50, 450, 350]);
    harness.feed(...both.start, both.to, both.end);
    expect(harness.editor.view.selection).toEqual([rectangle, ellipse]);
  });

  it('REQ-S09 REQ-S10 Mod+A selects both, a press on empty canvas clears, and Escape clears', () => {
    const { harness, rectangle, ellipse } = drawnPair(pointer);
    harness.feed(KEYS.selectAll);
    expect(harness.editor.view.selection).toEqual([rectangle, ellipse]);
    harness.feed(...tapper(pointer)(700, 500));
    expect(harness.editor.view.selection).toEqual([]);
    harness.feed(KEYS.selectAll, KEYS.escape);
    expect(harness.editor.view).toMatchObject({ selection: [], tool: 'selection', canUndo: true });
  });

  it('REQ-T01 a drawn element moves when dragged, and a drawn dot too', () => {
    const { harness, rectangle } = drawnPair(pointer);
    const shown = shownElements(harness);
    const move = dragFrom(pointer, [100, 140, 140, 170]);
    harness.feed(...move.start, move.to, move.end);
    expect(shown().find(({ id }) => id === rectangle)).toMatchObject({ x: 140, y: 130 });
    harness.feed(KEYS.freehand, ...tapper(pointer)(600, 500), KEYS.selection);
    harness.feed(...tapper(pointer)(600, 500));
    const dot = harness.editor.view.selection[0];
    const nudge = dragFrom(pointer, [600, 500, 650, 520]);
    harness.feed(...nudge.start, nudge.to, nudge.end);
    expect(shown().find(({ id }) => id === dot)).toMatchObject({ x: 650, y: 520 });
  });
});
