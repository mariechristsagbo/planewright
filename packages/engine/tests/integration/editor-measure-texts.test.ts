import { describe, expect, it } from 'vitest';

import type { TextMeasurer } from '../../src/geometry/text-measurer.ts';
import type { Element } from '../../src/model/elements.ts';
import type { DocumentId } from '../../src/persistence/repository.ts';
import { KEYS } from '../support/creation-input.ts';
import { shapeElement, testId, textElement } from '../support/elements.ts';
import { createFixedAdvanceMeasurer } from '../support/fakes.ts';
import { NO_SESSION, memoryStorage, seed } from '../support/memory-backend.ts';
import { loaded, savingEditor } from '../support/saving-editors.ts';
import { doubleTapper, drag } from '../support/selection-input.ts';
import { documentOf } from '../support/selection-scene.ts';

// Texts measured again when a font finishes loading (domain model, ADR 0011): each text whose
// measured size changed is updated without an undo step and saved; while a gesture or a text
// session is open, the measuring waits until it ends.

const ID = 'D000000000000000000001' as DocumentId;
const FIRST = testId(1);
const SECOND = testId(2);

/** A measurer whose advance per character the test can change, as a font that loads does. */
function changingMeasurer(): { measurer: TextMeasurer; set: (advance: number) => void } {
  let current = createFixedAdvanceMeasurer(10);
  return {
    measurer: { measure: (text, font) => current.measure(text, font) },
    set: (advance) => {
      current = createFixedAdvanceMeasurer(advance);
    },
  };
}

/** Two "Hi" texts measured at 10 units a character, and a rectangle, stored at revision 3. */
async function opened() {
  const storage = memoryStorage();
  const document = documentOf(
    textElement(20, 25, { id: 1, x: 100, y: 100 }),
    textElement(20, 25, { id: 2, x: 400, y: 300, rotation: 0.5 }),
    shapeElement('rectangle', 50, 50, { id: 3, x: 700, y: 100 }),
  );
  seed(storage.backend, { id: ID, rev: 3, document }, NO_SESSION);
  const { measurer, set } = changingMeasurer();
  const harness = savingEditor(storage.repository, await loaded(storage.repository), 'E', measurer);
  return { storage, harness, set };
}

const sizes = (elements: readonly Element[]) =>
  elements.flatMap((element) =>
    element.kind === 'text' ? [[element.id, element.width, element.height, element.x]] : [],
  );

describe('measuring texts again', () => {
  it('REQ-C10 updates each text whose size changed, keeping its origin, with no undo step, and saves it', async () => {
    const { storage, harness, set } = await opened();
    const { editor, shown, advance } = harness;
    expect(sizes(shown())).toEqual([
      [FIRST, 20, 25, 100],
      [SECOND, 20, 25, 400],
    ]);
    set(15);
    editor.measureTexts();
    expect(sizes(shown())).toEqual([
      [FIRST, 30, 25, 100],
      [SECOND, 30, 25, 400],
    ]);
    expect([editor.view.canUndo, editor.view.save]).toEqual([false, { type: 'pending' }]);
    await advance(300);
    const stored = await loaded(storage.repository);
    expect([stored.rev, sizes([...stored.document.elements.values()])]).toEqual([
      4,
      [
        [FIRST, 30, 25, 100],
        [SECOND, 30, 25, 400],
      ],
    ]);
  });

  it('changes nothing when every text keeps its size', async () => {
    const { storage, harness } = await opened();
    harness.editor.measureTexts();
    await harness.advance(5_000);
    expect([storage.backend.writes(), harness.editor.view.save]).toEqual([0, { type: 'saved' }]);
  });

  it('waits while a text is edited, then measures the others once the session ends', async () => {
    const { harness, set } = await opened();
    const { editor, feed, shown } = harness;
    feed(...doubleTapper('mouse')(110, 112));
    expect(editor.view.text?.element.id).toBe(FIRST);
    set(15);
    editor.measureTexts();
    expect(sizes(shown())).toEqual([
      [FIRST, 20, 25, 100],
      [SECOND, 20, 25, 400],
    ]);
    editor.editText({ type: 'value', text: 'Hi!' });
    editor.editText({ type: 'commit' });
    expect(sizes(shown())).toEqual([
      [FIRST, 45, 25, 100],
      [SECOND, 30, 25, 400],
    ]);
    feed(KEYS.undo);
    expect(sizes(shown())[0]).toEqual([FIRST, 20, 25, 100]);
  });

  it('waits while a gesture moves a text, then measures it as committed', async () => {
    const { harness, set } = await opened();
    const { editor, feed, shown } = harness;
    const { start, to, end } = drag('mouse', [110, 112, 210, 212]);
    feed(...start, to);
    set(15);
    editor.measureTexts();
    expect(sizes(shown())[0]?.[1]).toBe(20);
    feed(end);
    expect(sizes(shown())[0]).toEqual([FIRST, 30, 25, 200]);
    expect(editor.view.canUndo).toBe(true);
  });
});
