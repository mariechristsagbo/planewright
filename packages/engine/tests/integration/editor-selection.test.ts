import { describe, expect, it } from 'vitest';

import { editorHarness } from '../support/editors.ts';
import { keyEvent, move } from '../support/inputs.ts';
import { POINTERS, drag, marqueesOf, tapper } from '../support/selection-input.ts';
import {
  ELLIPSE,
  LINE,
  RECTANGLE,
  SMALL,
  TEXT,
  selectionDocument,
} from '../support/selection-scene.ts';

// The Selection tool, Select all and Escape through the editor, over the selection fixture, with a
// mouse and with touch (ENG-09). At the starting camera a screen point is the scene point. Drawing the elements before
// selecting them is the end-to-end check of ENG-11, the first issue whose users can draw.

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

  it('keeps the selection on drags from the rotation handle and from inside the selection box, until ENG-10', () => {
    const { editor, feed, next } = editorHarness(selectionDocument());
    const tap = tapper(pointer);
    feed(...tap(200, 150));
    const rotation = drag(pointer, [200, 76, 260, 20]);
    feed(...rotation.start, rotation.to, rotation.end);
    feed(...tap(450, 150, true));
    const inside = drag(pointer, [350, 150, 360, 300]);
    feed(...inside.start, inside.to);
    expect(marqueesOf(next())).toEqual([]);
    feed(inside.end);
    expect(editor.view).toMatchObject({ selection: [RECTANGLE, ELLIPSE], canUndo: false });
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

const MOD_A = keyEvent('key-down', 'a', 'KeyA', { mod: true });
const ESCAPE = keyEvent('key-down', 'Escape', 'Escape');

describe.each(POINTERS)('Select all and Escape in the editor, with %s input', (pointer) => {
  it('REQ-S09 Mod+A selects every selectable element in any tool, with no undo step', () => {
    const { editor, feed } = editorHarness(selectionDocument());
    feed(...tapper(pointer)(200, 150));
    editor.run('tool.hand');
    expect(editor.input(MOD_A)).toBe(true);
    expect(editor.view).toMatchObject({
      tool: 'hand',
      selection: [RECTANGLE, ELLIPSE, LINE, TEXT, SMALL],
      canUndo: false,
    });
  });

  it('REQ-S10 Escape with no gesture clears the selection and returns to the Selection tool', () => {
    const { editor, feed } = editorHarness(selectionDocument());
    feed(...tapper(pointer)(200, 150));
    editor.run('tool.hand');
    expect(editor.input(ESCAPE)).toBe(true);
    expect(editor.view).toMatchObject({ tool: 'selection', selection: [], canUndo: false });
  });

  it('REQ-S10 Escape during a marquee cancels it and keeps the selection; the pointer then does nothing', () => {
    const { editor, feed, next } = editorHarness(selectionDocument());
    feed(...tapper(pointer)(450, 415));
    const { start, to, end } = drag(pointer, [50, 50, 610, 250]);
    feed(...start, to);
    expect(marqueesOf(next())).toHaveLength(1);
    feed(ESCAPE);
    const frames = next();
    expect([frames.length, marqueesOf(frames)]).toEqual([1, []]);
    feed(move(700, 300, { pointer, time: 10_000 }), end);
    expect(editor.view.selection).toEqual([TEXT]);
    expect(marqueesOf(next())).toEqual([]);
  });
});
