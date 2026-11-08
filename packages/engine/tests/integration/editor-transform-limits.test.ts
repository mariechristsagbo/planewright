import { describe, expect, it } from 'vitest';

import { testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import { tapper } from '../support/selection-input.ts';
import { documentOf } from '../support/selection-scene.ts';
import { fontSizeOf, textWithFont } from '../support/text-fonts.ts';
import { dragFrom, filledBox, sceneWatcher } from '../support/transform-scene.ts';

// A resize that reaches a text's font limit through the editor (the ENG-10 review's M1): input
// never throws, the preview stops at the bound, and the release commits that valid state.

const TEXT = testId(1);

describe('a text resized past its font floor through the editor', () => {
  it('REQ-T05 one text stops at font size 1 without throwing, and its release commits that', () => {
    const harness = editorHarness(
      documentOf(textWithFont(21, { id: 1, order: 'a1', x: 100, y: 100 })),
    );
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(150, 115));
    const { start, to, end } = dragFrom('mouse', [220, 130, -5_000, -5_000]);
    expect(() => {
      harness.feed(...start, to);
    }).not.toThrow();
    expect(fontSizeOf(shown(TEXT))).toBe(1);
    harness.feed(end);
    expect([fontSizeOf(shown(TEXT)), harness.editor.view.canUndo]).toEqual([1, true]);
    harness.editor.run('history.undo');
    expect(fontSizeOf(shown(TEXT))).toBe(21);
  });

  it('REQ-T05 a text beside a rectangle stops at font size 1 without throwing', () => {
    const text = textWithFont(24, { id: 1, order: 'a1', x: 100, y: 100 });
    const harness = editorHarness(documentOf(text, filledBox(2, [300, 100, 50, 50])));
    const shown = sceneWatcher(harness);
    const tap = tapper('mouse');
    harness.feed(...tap(150, 115), ...tap(325, 125, true));
    const { start, to, end } = dragFrom('mouse', [350, 150, -5_000, -5_000]);
    expect(() => {
      harness.feed(...start, to, end);
    }).not.toThrow();
    expect([fontSizeOf(shown(TEXT)), harness.editor.view.canUndo]).toEqual([1, true]);
  });
});
