import { describe, expect, it } from 'vitest';

import { INITIAL_DEFAULT_STYLE } from '../../src/model/defaults.ts';
import type { Element } from '../../src/model/elements.ts';
import { KEYS, shownElements } from '../support/creation-input.ts';
import { editorHarness } from '../support/editors.ts';
import { POINTERS, tapper } from '../support/selection-input.ts';
import { boxOf, dragFrom } from '../support/transform-scene.ts';

// The creation tools through the editor (ENG-11), chosen by their keys, with a mouse and with
// touch. B-01's drags and boxes, and B-05's stroke, are the numbers committed in
// behavior-analysis.md.

const kindAndBox = (element: Element | undefined) =>
  element === undefined ? undefined : [element.kind, boxOf(element)];

describe.each(POINTERS)('the creation tools in the editor, with %s input', (pointer) => {
  it('REQ-C01 REQ-C05 B-01: each drag draws its box, then the new element alone is selected in the Selection tool', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    const drags = [
      [KEYS.rectangle, [300, 180, 420, 280]],
      [KEYS.ellipse, [520, 180, 660, 280]],
      [KEYS.diamond, [820, 170, 940, 290]],
      [KEYS.line, [300, 420, 420, 420]],
    ] as const;
    for (const [key, points] of drags) {
      harness.feed(key);
      const { start, to, end } = dragFrom(pointer, points);
      harness.feed(...start, to, end);
      const last = shown().at(-1);
      expect(harness.editor.view).toMatchObject({ tool: 'selection', selection: [last?.id] });
    }
    expect(shown().map(kindAndBox)).toEqual([
      ['rectangle', [300, 180, 120, 100]],
      ['ellipse', [520, 180, 140, 100]],
      ['diamond', [820, 170, 120, 120]],
      ['line', [300, 420, 120, 0]],
    ]);
  });

  it('REQ-C02 a drag towards the top-left gives the same box', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.ellipse);
    const { start, to, end } = dragFrom(pointer, [660, 280, 520, 180]);
    harness.feed(...start, to, end);
    expect(shown().map(kindAndBox)).toEqual([['ellipse', [520, 180, 140, 100]]]);
  });

  it('REQ-C03 REQ-C04 taps draw the default sizes centred on them', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    const tap = tapper(pointer);
    for (const [key, x, y] of [
      [KEYS.rectangle, 200, 200],
      [KEYS.ellipse, 400, 200],
      [KEYS.diamond, 600, 200],
      [KEYS.line, 800, 200],
    ] as const) {
      harness.feed(key, ...tap(x, y));
    }
    expect(shown().map(kindAndBox)).toEqual([
      ['rectangle', [150, 150, 100, 100]],
      ['ellipse', [350, 150, 100, 100]],
      ['diamond', [550, 150, 100, 100]],
      ['line', [750, 200, 100, 0]],
    ]);
    expect(harness.editor.view.tool).toBe('selection');
  });
});

describe.each(POINTERS)('tool lock and the freehand tool, with %s input', (pointer) => {
  it('REQ-C05 with tool lock the tool stays and nothing is selected', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.lock, KEYS.rectangle);
    expect(harness.editor.view).toMatchObject({ tool: 'rectangle', toolLock: true });
    for (const x of [100, 400]) {
      const { start, to, end } = dragFrom(pointer, [x, 100, x + 100, 200]);
      harness.feed(...start, to, end);
      expect(harness.editor.view).toMatchObject({ tool: 'rectangle', selection: [] });
    }
    harness.feed(...tapper(pointer)(700, 300));
    expect(shown()).toHaveLength(3);
    expect(harness.editor.view).toMatchObject({ tool: 'rectangle', selection: [] });
  });

  it('REQ-C06 REQ-C07 B-05: a stroke is its input’s extent, a tap makes a dot, and the tool stays with nothing selected', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.freehand);
    const { start, end } = dragFrom(pointer, [520, 400, 620, 440]);
    const path = [
      [540, 420],
      [560, 440],
      [580, 410],
      [600, 430],
      [620, 440],
    ].map(([x = 0, y = 0]) => ({ ...end, type: 'pointer-move' as const, at: { x, y } }));
    harness.feed(...start, ...path, end);
    harness.feed(...tapper(pointer)(100, 100));
    expect(shown().map(kindAndBox)).toEqual([
      ['freehand', [520, 400, 100, 40]],
      ['freehand', [100, 100, 0, 0]],
    ]);
    expect(harness.editor.view).toMatchObject({ tool: 'freehand', selection: [] });
  });

  it('REQ-C12 new elements take the editor’s default style', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    const tap = tapper(pointer);
    harness.feed(KEYS.lock);
    for (const key of [KEYS.rectangle, KEYS.ellipse, KEYS.diamond, KEYS.line, KEYS.freehand]) {
      harness.feed(key, ...tap(300, 300));
    }
    const round = { ...INITIAL_DEFAULT_STYLE, corners: 'round' };
    const sharp = { ...INITIAL_DEFAULT_STYLE, corners: 'sharp' };
    expect(shown().map(({ style }) => style)).toEqual([round, sharp, round, sharp, sharp]);
  });
});

describe('choosing and leaving a creation tool', () => {
  it('choosing a creation tool clears the selection', () => {
    const harness = editorHarness();
    harness.feed(KEYS.rectangle, ...tapper('mouse')(200, 200));
    expect(harness.editor.view.selection).toHaveLength(1);
    harness.feed(KEYS.line);
    expect(harness.editor.view).toMatchObject({ tool: 'line', selection: [] });
  });

  it('Escape during a drag cancels it with no undo step and keeps the tool; then Escape returns to the Selection tool', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.diamond);
    const { start, to, end } = dragFrom('mouse', [300, 300, 400, 400]);
    harness.feed(...start, to);
    expect(shown()).toHaveLength(1);
    harness.feed(KEYS.escape, end);
    expect(shown()).toHaveLength(0);
    expect(harness.editor.view).toMatchObject({ tool: 'diamond', canUndo: false });
    harness.feed(KEYS.escape);
    expect(harness.editor.view.tool).toBe('selection');
  });

  it('a tool change during a drag cancels it', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.freehand);
    const { start, to, end } = dragFrom('touch', [300, 300, 400, 400]);
    harness.feed(...start, to, KEYS.ellipse, end);
    expect(shown()).toHaveLength(0);
    expect(harness.editor.view).toMatchObject({ tool: 'ellipse', canUndo: false });
  });
});
