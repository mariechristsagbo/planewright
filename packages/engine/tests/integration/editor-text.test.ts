import { describe, expect, it } from 'vitest';

import { KEYS } from '../support/creation-input.ts';
import { wheelEvent } from '../support/inputs.ts';
import { POINTERS } from '../support/selection-input.ts';
import { textAndBox, textHarness } from '../support/text-input.ts';
import { boxOf } from '../support/transform-scene.ts';

// The Text tool and its text session through the editor (ENG-12), with a mouse and with touch, and
// a measurer that gives every character 10 units at size 20. B-06's click at (820,420) and its
// mobile tap at (60,300) are the numbers committed in behavior-analysis.md.

describe.each(POINTERS)('placing and committing a text in the editor, with %s input', (pointer) => {
  it('REQ-C09 B-06 a tap starts editing an empty text, its left edge at the tap and its first line centred on it', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420);
    const { view } = harness.editor;
    expect(view).toMatchObject({ tool: 'text', selection: [], canUndo: false });
    expect(view.text?.box).toEqual({ x: 820, y: 407.5, width: 0, height: 25 });
    const id = view.text?.element.id;
    expect(harness.shown().map(textAndBox)).toEqual([['', [820, 407.5, 0, 25]]]);
    expect(harness.next()).toEqual([]);
    harness.type('Hello');
    expect(harness.next().at(-1)?.scene?.hidden).toEqual([id]);
  });

  it('REQ-C09 measures each value again through the text measurer, keeping the top-left corner', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'Hello');
    expect(harness.editor.view.text?.box).toEqual({ x: 820, y: 407.5, width: 50, height: 25 });
    harness.type('Hi\r\nthere\rnow');
    const element = harness.editor.view.text?.element;
    expect(element && textAndBox(element)).toEqual(['Hi\nthere\nnow', [820, 407.5, 50, 75]]);
  });

  it('REQ-C09 Escape or Mod+Enter in the text area commits: the text alone is selected in the Selection tool', () => {
    const harness = textHarness(pointer);
    harness.place(820, 420, 'Hello');
    const id = harness.editor.view.text?.element.id;
    harness.commit();
    expect(harness.editor.view).toMatchObject({
      text: null,
      tool: 'selection',
      selection: [id],
      canUndo: true,
    });
    expect(harness.shown().map(textAndBox)).toEqual([['Hello', [820, 407.5, 50, 25]]]);
    expect(harness.next()).toEqual([]);
  });

  it('REQ-C09 B-06 a press on empty canvas commits, and its tap leaves nothing selected', () => {
    const harness = textHarness(pointer);
    harness.place(60, 300, 'Plan');
    harness.tap(400, 500);
    expect(harness.editor.view).toMatchObject({ text: null, tool: 'selection', selection: [] });
    expect(harness.shown().map(textAndBox)).toEqual([['Plan', [60, 287.5, 40, 25]]]);
    expect(harness.editor.view.canUndo).toBe(true);
  });

  it('a press on another element commits, and the Selection tool selects that element', () => {
    const harness = textHarness(pointer);
    harness.place(100, 100, 'first');
    harness.commit();
    const [first] = harness.shown();
    harness.place(100, 300, 'second');
    harness.tap(120, 100);
    expect(harness.editor.view).toMatchObject({ text: null, selection: [first?.id] });
    expect(harness.shown().map(textAndBox)).toEqual([
      ['first', [100, 87.5, 50, 25]],
      ['second', [100, 287.5, 60, 25]],
    ]);
  });

  it('a tool change commits the text', () => {
    const harness = textHarness(pointer);
    harness.place(200, 200, 'Hi');
    expect(harness.editor.run('tool.rectangle')).toBe('done');
    expect(harness.editor.view).toMatchObject({ text: null, tool: 'rectangle', selection: [] });
    expect(harness.shown().map(textAndBox)).toEqual([['Hi', [200, 187.5, 20, 25]]]);
    expect(harness.editor.view.canUndo).toBe(true);
  });

  it('REQ-C10 an empty new text disappears without an undo step, however its session ends', () => {
    const harness = textHarness(pointer);
    harness.place(100, 100);
    harness.commit();
    harness.place(200, 200, 'abc', '');
    harness.tap(500, 500);
    harness.place(300, 300);
    harness.feed(KEYS.ellipse);
    expect(harness.editor.view).toMatchObject({ text: null, tool: 'ellipse', canUndo: false });
    expect(harness.shown()).toEqual([]);
  });
});

describe('the text area over a moved camera', () => {
  it('REQ-C09 places the text at the scene point under the tap and shows its box on screen', () => {
    const harness = textHarness('mouse');
    harness.feed(wheelEvent({ x: 640, y: 360 }, { x: 40, y: 100 }));
    harness.editor.run('view.zoom-in');
    const { camera } = harness.editor.view;
    harness.place(820, 420, 'Hello');
    const text = harness.editor.view.text;
    const x = 820 / camera.zoom + camera.x;
    const y = 420 / camera.zoom + camera.y;
    expect(text && boxOf(text.element)).toEqual([x, y - 12.5, 50, 25]);
    expect(text?.box).toEqual({
      x: (x - camera.x) * camera.zoom,
      y: (y - 12.5 - camera.y) * camera.zoom,
      width: 50 * camera.zoom,
      height: 25 * camera.zoom,
    });
  });
});
