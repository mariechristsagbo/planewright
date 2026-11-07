import { describe, expect, it } from 'vitest';

import type { PointerKind } from '../../src/selection/pointer.ts';
import { editorHarness } from '../support/editors.ts';
import { keyEvent, move } from '../support/inputs.ts';
import { POINTERS, drag, marqueesOf, tapper } from '../support/selection-input.ts';
import { ELLIPSE, RECTANGLE, TEXT, selectionDocument } from '../support/selection-scene.ts';

// A tool change during a tool's gesture cancels that gesture first, as Escape does: the old tool
// removes what it shows, and the pointer does nothing until it lifts (ENG-09 review finding M1).

const H = keyEvent('key-down', 'h', 'KeyH');
const V = keyEvent('key-down', 'v', 'KeyV');
const ESCAPE = keyEvent('key-down', 'Escape', 'Escape');

/** An editor over the selection fixture, the text selected, while a marquee is being drawn. */
function marqueeOpen(pointer: PointerKind) {
  const harness = editorHarness(selectionDocument());
  harness.feed(...tapper(pointer)(450, 415));
  const gesture = drag(pointer, [50, 50, 610, 250]);
  harness.feed(...gesture.start, gesture.to);
  expect(marqueesOf(harness.next())).toEqual([{ x: 50, y: 50, width: 560, height: 200 }]);
  return { ...harness, gesture };
}

describe.each(POINTERS)('a tool change during a marquee, with %s input', (pointer) => {
  it('removes the marquee when H chooses the Hand tool; the move and release then change nothing', () => {
    const { editor, feed, next, gesture } = marqueeOpen(pointer);
    feed(H);
    const frames = next();
    expect([frames.length, marqueesOf(frames)]).toEqual([1, []]);
    feed(move(700, 300, { pointer, time: 10_000 }), gesture.end);
    expect(next()).toEqual([]);
    expect(editor.view).toMatchObject({
      tool: 'hand',
      selection: [TEXT],
      camera: { x: 0, y: 0, zoom: 1 },
    });
  });

  it('lets the next drag pan with the Hand tool once the cancelled pointer has lifted', () => {
    const { editor, feed, gesture } = marqueeOpen(pointer);
    feed(H, gesture.end);
    const pan = drag(pointer, [400, 300, 300, 250]);
    feed(...pan.start, pan.to, pan.end);
    expect(editor.view.camera).toEqual({ x: 100, y: 50, zoom: 1 });
  });

  it('removes the marquee when the tool bar chooses the Hand tool', () => {
    const { editor, feed, next, gesture } = marqueeOpen(pointer);
    editor.run('tool.hand');
    const frames = next();
    expect([frames.length, marqueesOf(frames)]).toEqual([1, []]);
    feed(gesture.end);
    expect(next()).toEqual([]);
    expect(editor.view).toMatchObject({ tool: 'hand', selection: [TEXT] });
  });

  it('REQ-S10 leaves no marquee when Escape follows the tool change before the release', () => {
    const { editor, feed, next, gesture } = marqueeOpen(pointer);
    feed(H, ESCAPE);
    const frames = next();
    expect([frames.length, marqueesOf(frames)]).toEqual([1, []]);
    expect(editor.view).toMatchObject({ tool: 'selection', selection: [] });
    feed(gesture.end);
    expect(next()).toEqual([]);
    feed(...tapper(pointer)(200, 150));
    expect(editor.view.selection).toEqual([RECTANGLE]);
  });

  it('keeps the marquee when the key chooses the tool that is already active', () => {
    const { editor, feed, next, gesture } = marqueeOpen(pointer);
    feed(V, move(560, 240, { pointer, time: 10_000 }));
    expect(marqueesOf(next())).toEqual([{ x: 50, y: 50, width: 510, height: 190 }]);
    feed(gesture.end);
    expect(editor.view.selection).toEqual([RECTANGLE, ELLIPSE]);
  });
});
