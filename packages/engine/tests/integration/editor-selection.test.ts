import { describe, expect, it } from 'vitest';

import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { editorHarness } from '../support/editors.ts';
import { down, move, up } from '../support/inputs.ts';
import { ELLIPSE, RECTANGLE, SMALL, TEXT, selectionDocument } from '../support/selection-scene.ts';

// The Selection tool through the editor, over the selection fixture, with a mouse and with touch
// (ENG-09). At the starting camera a screen point is the scene point. Drawing the elements before
// selecting them is the end-to-end check of ENG-11, the first issue whose users can draw.

const POINTERS = ['mouse', 'touch'] as const;

/** Taps a second apart, so that no two of them make a double tap; each lasts 50 ms. */
function tapper(pointer: PointerKind) {
  let time = 0;
  return (x: number, y: number, shift = false) => {
    time += 1_000;
    const options = { pointer, time, modifiers: { shift } };
    return [down(x, y, options), up(x, y, { ...options, time: time + 50 })];
  };
}

/** A drag from one point to another through a point just past the drag threshold. */
function drag(pointer: PointerKind, [x0, y0, x1, y1]: readonly number[], shift = false) {
  const options = { pointer, time: 10_000, modifiers: { shift } };
  const [fromX = 0, fromY = 0, toX = 0, toY = 0] = [x0, y0, x1, y1];
  return {
    start: [down(fromX, fromY, options), move(fromX + 10, fromY + 10, options)],
    to: move(toX, toY, options),
    end: up(toX, toY, options),
  };
}

const marqueesOf = (frames: readonly RenderFrame[]) =>
  frames.flatMap((frame) =>
    (frame.overlay?.primitives ?? []).flatMap((primitive) =>
      primitive.type === 'marquee' ? [primitive.box] : [],
    ),
  );

describe.each(POINTERS)('the Selection tool in the editor, with %s input', (pointer) => {
  it('REQ-S05 selects on a press, and adds and removes with Shift, with no undo step', () => {
    const { editor, feed } = editorHarness(selectionDocument());
    const tap = tapper(pointer);
    feed(...tap(200, 150));
    expect(editor.view.selection).toEqual([RECTANGLE]);
    feed(...tap(450, 150, true));
    expect(editor.view.selection).toEqual([RECTANGLE, ELLIPSE]);
    feed(...tap(200, 150, true));
    expect(editor.view.selection).toEqual([ELLIPSE]);
    feed(...tap(200, 150));
    expect(editor.view).toMatchObject({ selection: [RECTANGLE], canUndo: false });
  });

  it('REQ-S06 shows a marquee while dragging from empty canvas and selects what it encloses', () => {
    const { editor, feed, next } = editorHarness(selectionDocument());
    feed(...tapper(pointer)(450, 415));
    const { start, to, end } = drag(pointer, [50, 50, 610, 250]);
    feed(...start, to);
    expect(marqueesOf(next())).toEqual([{ x: 50, y: 50, width: 560, height: 200 }]);
    feed(end);
    expect(marqueesOf(next())).toEqual([]);
    expect(editor.view).toMatchObject({ selection: [RECTANGLE, ELLIPSE], canUndo: false });
  });

  it('REQ-S06 adds what a marquee encloses with Shift', () => {
    const { editor, feed } = editorHarness(selectionDocument());
    feed(...tapper(pointer)(450, 415));
    const { start, to, end } = drag(pointer, [640, 260, 580, 80], true);
    feed(...start, to, end);
    expect(editor.view.selection).toEqual([TEXT, SMALL]);
  });

  it('REQ-S10 REQ-T07 clears the selection on a tap on empty canvas, with no undo step', () => {
    const { editor, feed } = editorHarness(selectionDocument());
    const tap = tapper(pointer);
    feed(...tap(200, 150), ...tap(450, 150, true));
    feed(...tap(700, 500));
    expect(editor.view).toMatchObject({ selection: [], canUndo: false, canRedo: false });
  });
});

describe('the handles drawn for the pointer', () => {
  it('REQ-Y06 draws 12 px handles after a touch press and 8 px ones after a mouse press', () => {
    const { feed, next } = editorHarness(selectionDocument());
    const sizes = () =>
      new Set(
        (next().at(-1)?.overlay?.primitives ?? []).flatMap((primitive) =>
          primitive.type === 'handle' ? [primitive.size] : [],
        ),
      );
    feed(...tapper('touch')(200, 150));
    expect(sizes()).toEqual(new Set([12]));
    feed(...tapper('mouse')(450, 150));
    expect(sizes()).toEqual(new Set([8]));
  });
});
