import { describe, expect, it } from 'vitest';

import type { FrameElement } from '../../src/model/elements.ts';
import { KEYS } from '../support/creation-input.ts';
import { keyEvent } from '../support/inputs.ts';
import { editorHarness } from '../support/editors.ts';
import { shapeElement } from '../support/elements.ts';
import { tapper } from '../support/selection-input.ts';
import {
  ELLIPSE,
  LINE,
  RECTANGLE,
  SMALL,
  TEXT,
  documentOf,
  selectionElements,
} from '../support/selection-scene.ts';
import { dragFrom } from '../support/transform-scene.ts';

// The elements that the editor's view lists for the element list
// (docs/architecture/engine/quality.md#accessibility, REQ-Y05): the drawn elements as last
// committed, in drawing order, so that the list follows the document and never a preview.

/** A frame, which P0 neither draws nor hits, above the fixture's elements. */
const FRAME: FrameElement = {
  ...shapeElement('rectangle', 300, 200, { id: 9, order: 'f' }),
  kind: 'frame',
  name: 'Frame',
};

const idsOf = (elements: readonly { readonly id: string }[]) => elements.map(({ id }) => id);

describe('the elements of the editor’s view', () => {
  it('REQ-Y05 lists the drawn elements in drawing order, bottom first, and leaves out the kinds P0 does not draw', () => {
    const { editor } = editorHarness(documentOf(...selectionElements(), FRAME));
    expect(idsOf(editor.view.elements)).toEqual([RECTANGLE, ELLIPSE, LINE, TEXT, SMALL]);
    expect(editor.view.elements[0]).toMatchObject({ kind: 'rectangle', x: 100, y: 100 });
  });

  it('REQ-Y05 keeps the elements from before a move until it is committed, publishing no view meanwhile', () => {
    const harness = editorHarness(documentOf(...selectionElements()));
    const before = harness.editor.view.elements;
    harness.feed(...tapper('mouse')(200, 150));
    const { start, to, end } = dragFrom('mouse', [200, 150, 260, 190]);
    const published = harness.views.length;
    harness.feed(...start, to);
    expect([harness.editor.view.elements, harness.views.length]).toEqual([before, published]);
    harness.feed(end);
    expect(harness.editor.view.elements[0]).toMatchObject({ id: RECTANGLE, x: 160, y: 140 });
    harness.feed(KEYS.undo);
    expect(harness.editor.view.elements[0]).toMatchObject({ id: RECTANGLE, x: 100, y: 100 });
  });

  it('REQ-Y05 lists a new text only once its session is committed', () => {
    const harness = editorHarness();
    harness.feed(KEYS.text, ...tapper('mouse')(300, 300));
    harness.editor.editText({ type: 'value', text: 'Note' });
    expect(harness.editor.view.elements).toEqual([]);
    harness.editor.editText({ type: 'commit' });
    expect(harness.editor.view.elements.map(({ kind }) => kind)).toEqual(['text']);
  });

  it('REQ-Y05 publishes a view when only the listed elements change', () => {
    const harness = editorHarness(documentOf(...selectionElements()));
    const right = keyEvent('key-down', 'ArrowRight', 'ArrowRight');
    harness.editor.select([RECTANGLE]);
    harness.feed(right);
    const published = harness.views.length;
    harness.feed(right);
    expect(harness.views.length).toBe(published + 1);
    expect(harness.views.at(-1)?.elements[0]).toMatchObject({ id: RECTANGLE, x: 102 });
  });

  it('REQ-Y05 keeps the same list while nothing in the document changes', () => {
    const harness = editorHarness(documentOf(...selectionElements()));
    const before = harness.editor.view.elements;
    harness.feed(...tapper('mouse')(450, 150), KEYS.rectangle);
    expect(harness.editor.view.elements).toBe(before);
  });
});
