import { describe, expect, it } from 'vitest';

import { sceneFromScreen } from '../../src/camera/camera.ts';
import { KEYS, shownElements } from '../support/creation-input.ts';
import { editorHarness } from '../support/editors.ts';
import { keyEvent, wheelEvent } from '../support/inputs.ts';
import { TEXT, selectionDocument } from '../support/selection-scene.ts';
import { boxOf, dragFrom } from '../support/transform-scene.ts';

// Keyboard creation (docs/architecture/engine/quality.md#accessibility): with a creation tool
// active and the canvas focused, Enter creates the tool's default element at the centre of the
// 1280 × 720 viewport, (640, 360) at the starting camera, as a tap there would (REQ-C04, REQ-Y05).

const ENTER = keyEvent('key-down', 'Enter', 'Enter');

describe('creating from the keyboard', () => {
  it('REQ-C04 REQ-Y05 Enter makes a 100 by 100 rectangle, ellipse and diamond at the centre, selected with the Selection tool, as one undo step', () => {
    for (const kind of ['rectangle', 'ellipse', 'diamond'] as const) {
      const harness = editorHarness();
      const shown = shownElements(harness);
      harness.feed(KEYS[kind]);
      expect(harness.editor.input(ENTER)).toBe(true);
      const elements = shown();
      expect(elements.map((element) => [element.kind, ...boxOf(element)])).toEqual([
        [kind, 590, 310, 100, 100],
      ]);
      const ids = elements.map(({ id }) => id);
      expect(harness.editor.view).toMatchObject({ tool: 'selection', selection: ids });
      harness.feed(KEYS.undo);
      expect([shown(), harness.editor.view.canUndo]).toEqual([[], false]);
    }
  });

  it('REQ-C03 REQ-C06 REQ-Y05 Enter makes a 100-unit horizontal line, and a freehand dot that keeps its tool', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.feed(KEYS.line, ENTER, KEYS.freehand, ENTER);
    expect(shown().map((element) => [element.kind, ...boxOf(element)])).toEqual([
      ['line', 590, 360, 100, 0],
      ['freehand', 640, 360, 0, 0],
    ]);
    expect(harness.editor.view).toMatchObject({ tool: 'freehand', selection: [] });
  });

  it('REQ-C09 REQ-Y05 Enter places a text at the centre and edits it, then edits a lone selected text again', () => {
    const harness = editorHarness();
    harness.feed(KEYS.text, ENTER);
    expect(harness.editor.view.text?.element).toMatchObject({ x: 640, y: 347.5, height: 25 });
    harness.editor.editText({ type: 'value', text: 'Hi' });
    harness.editor.editText({ type: 'commit' });
    const id = harness.editor.view.selection[0];
    expect([harness.editor.view.tool, harness.editor.view.text]).toEqual(['selection', null]);
    harness.feed(ENTER);
    expect([
      harness.editor.view.text?.element.id,
      harness.editor.view.text?.element.content.text,
    ]).toEqual([id, 'Hi']);
  });

  it('REQ-C10 REQ-Y05 Enter edits a lone selected text of a document and nothing else', () => {
    const harness = editorHarness(selectionDocument());
    harness.feed(ENTER);
    harness.editor.select([TEXT]);
    harness.feed(ENTER);
    expect(harness.editor.view.text?.element.id).toBe(TEXT);
    expect(harness.editor.view.canUndo).toBe(false);
  });

  it('REQ-Y05 Enter creates at the centre of a panned and zoomed view, and keeps the tool with tool lock', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    harness.editor.run('view.zoom-in');
    harness.editor.run('view.zoom-in');
    harness.feed(
      wheelEvent({ x: 100, y: 100 }, { x: 30, y: 100 }),
      KEYS.lock,
      KEYS.rectangle,
      ENTER,
    );
    const centre = sceneFromScreen({ x: 640, y: 360 }, harness.editor.view.camera);
    expect(shown().map(boxOf)).toEqual([[centre.x - 50, centre.y - 50, 100, 100]]);
    expect(harness.editor.view).toMatchObject({ tool: 'rectangle', selection: [] });
  });

  it('REQ-Y05 Enter during a creation drag makes nothing more, and the drag still creates one element', () => {
    const harness = editorHarness();
    const shown = shownElements(harness);
    const { start, to, end } = dragFrom('mouse', [100, 100, 300, 200]);
    harness.feed(KEYS.rectangle, ...start, to, ENTER, end);
    expect(shown().map(boxOf)).toEqual([[100, 100, 200, 100]]);
  });
});
