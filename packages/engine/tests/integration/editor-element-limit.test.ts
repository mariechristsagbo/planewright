import { describe, expect, it } from 'vitest';

import type { DocumentState } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { LIMITS } from '../../src/model/limits.ts';
import { KEYS } from '../support/creation-input.ts';
import { shapeElement, testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import type { EditorHarness } from '../support/editors.ts';
import { drag, tapper } from '../support/selection-input.ts';
import { color } from '../support/scene-state.ts';

// A creation in a document that holds the 100,000 elements a document may hold (the ENG-11
// review's m1, fixed before ENG-13 loads stored documents): nothing is created, input never
// throws, and the history is not left locked.

const FIRST = testId(1);

/** A document at the element limit: small squares away from where the tests draw. */
function fullDocument(): DocumentState {
  const elements = new Map<ElementId, Element>();
  for (let index = 1; index <= LIMITS.elements; index += 1) {
    const element = shapeElement('rectangle', 10, 10, { id: index, x: 1_000, y: 600 });
    elements.set(element.id, element);
  }
  return { elements, groups: new Map(), canvas: { background: color('#ffffff') }, rev: 0 };
}

/** The editor over the full document, with one element nudged so that Undo has a step. */
function fullEditor(): EditorHarness {
  const harness = editorHarness(fullDocument());
  harness.editor.select([FIRST]);
  harness.editor.run('selection.nudge-right');
  harness.editor.select([]);
  return harness;
}

const xOf = (harness: EditorHarness): number => {
  const frame = harness.next().findLast((each) => each.scene !== undefined);
  return frame?.scene?.elements.find(({ id }) => id === FIRST)?.x ?? Number.NaN;
};

/** Tries each creation: a drag and a tap with each drawing tool, and a tap with the Text tool. */
function tryEveryCreation(harness: EditorHarness): void {
  const tap = tapper('mouse');
  for (const key of [KEYS.rectangle, KEYS.line, KEYS.freehand]) {
    const { start, to, end } = drag('mouse', [100, 100, 300, 200]);
    harness.feed(key, ...start, to, end, key, ...tap(400, 300));
  }
  harness.feed(KEYS.text, ...tap(500, 300));
}

describe('a creation in a document at the element limit', () => {
  it(
    'REQ-C01 creates nothing and never throws, and Undo still undoes the last step',
    {
      timeout: 60_000,
    },
    () => {
      const harness = fullEditor();
      expect(xOf(harness)).toBe(1_001);
      expect(() => {
        tryEveryCreation(harness);
      }).not.toThrow();
      const view = harness.editor.view;
      expect([view.text, view.selection, view.canUndo]).toEqual([null, [], true]);
      harness.feed(KEYS.escape, KEYS.undo);
      expect(xOf(harness)).toBe(1_000);
      expect(harness.editor.view.canRedo).toBe(true);
    },
  );
});
