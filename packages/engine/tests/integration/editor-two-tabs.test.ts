import { describe, expect, it } from 'vitest';

import type { Element } from '../../src/model/elements.ts';
import type { DocumentId } from '../../src/persistence/repository.ts';
import { KEYS } from '../support/creation-input.ts';
import { shapeElement, testId } from '../support/elements.ts';
import { memoryStorage, seed } from '../support/memory-backend.ts';
import type { MemoryStorage } from '../support/memory-backend.ts';
import { loaded, savingEditor } from '../support/saving-editors.ts';
import type { SavingEditor } from '../support/saving-editors.ts';
import { tapper } from '../support/selection-input.ts';
import { documentOf } from '../support/selection-scene.ts';

// Two editors over one in-memory repository, as two tabs over one storage (the roadmap's ENG-13
// scenario, REQ-P06): both load revision 5 and B saves revision 6; A edits, its save is refused as
// stale, and A keeps its version, so storage holds exactly A's document at revision 7; B's next
// save is then refused and raises B's notice. Had A loaded the newer version instead, it would show
// B's document with an empty history.

const ID = 'D000000000000000000001' as DocumentId;
const ONE = testId(1);
const TWO = testId(2);
const AT_REVISION_5 = documentOf(
  shapeElement('rectangle', 100, 80, { id: 1, x: 100, y: 100 }),
  shapeElement('ellipse', 60, 60, { id: 2, x: 400, y: 200 }),
);

/** Nudges one element right by 1 unit: one committed local change. */
function nudge({ editor }: SavingEditor, id: typeof ONE): void {
  editor.select([id]);
  editor.run('selection.nudge-right');
}

const xs = (elements: readonly Element[]): Record<string, number> =>
  Object.fromEntries(elements.map(({ id, x }) => [id, x]));

/** Both editors over revision 5, and B's edit saved as revision 6. */
async function bothLoadedThenBSaves() {
  const storage = memoryStorage();
  seed(storage.backend, { id: ID, rev: 5, document: AT_REVISION_5 });
  const a = savingEditor(storage.repository, await loaded(storage.repository), 'A');
  const b = savingEditor(storage.repository, await loaded(storage.repository), 'B');
  nudge(b, TWO);
  await b.advance(300);
  expect((await loaded(storage.repository)).rev).toBe(6);
  nudge(a, ONE);
  await a.advance(300);
  expect(a.editor.view.save).toEqual({ type: 'stale' });
  return { storage, a, b };
}

const storedXs = async (storage: MemoryStorage) =>
  xs([...(await loaded(storage.repository)).document.elements.values()]);

describe('two editors over one repository', () => {
  it('REQ-P06 A keeps its version over B’s newer save: storage holds exactly A’s document at revision 7', async () => {
    const { storage, a } = await bothLoadedThenBSaves();
    await a.editor.resolveStale('keep');
    await a.advance(0);
    const stored = await loaded(storage.repository);
    expect(stored.rev).toBe(7);
    expect([...stored.document.elements.values()]).toEqual(a.shown());
    expect(xs(a.shown())).toEqual({ [ONE]: 101, [TWO]: 400 });
    expect(a.editor.view.save).toEqual({ type: 'saved' });
  });

  it('REQ-P06 B’s next save is then refused and raises B’s notice', async () => {
    const { storage, a, b } = await bothLoadedThenBSaves();
    await a.editor.resolveStale('keep');
    await a.advance(0);
    nudge(b, TWO);
    await b.advance(300);
    expect(b.editor.view.save).toEqual({ type: 'stale' });
    expect([(await loaded(storage.repository)).rev, await storedXs(storage)]).toEqual([
      7,
      { [ONE]: 101, [TWO]: 400 },
    ]);
  });

  it('REQ-P06 REQ-H03 had A loaded the newer version, it would show B’s document with an empty history', async () => {
    const { storage, a } = await bothLoadedThenBSaves();
    a.feed(KEYS.rectangle);
    await a.editor.resolveStale('load');
    const { view } = a.editor;
    expect(xs(a.shown())).toEqual({ [ONE]: 100, [TWO]: 401 });
    expect([view.canUndo, view.canRedo, view.tool, view.save]).toEqual([
      false,
      false,
      'selection',
      { type: 'saved' },
    ]);
    nudge(a, ONE);
    await a.advance(300);
    expect([(await loaded(storage.repository)).rev, await storedXs(storage)]).toEqual([
      7,
      { [ONE]: 101, [TWO]: 401 },
    ]);
  });
});

describe('a stale editor in the middle of an edit', () => {
  it('REQ-P06 keeps its version without the text being edited, which it saves once committed', async () => {
    const { storage, a } = await bothLoadedThenBSaves();
    a.feed(KEYS.text, ...tapper('mouse')(600, 500));
    a.editor.editText({ type: 'value', text: 'Draft' });
    await a.editor.resolveStale('keep');
    await a.advance(0);
    expect(Object.keys(await storedXs(storage))).toEqual([ONE, TWO]);
    a.editor.editText({ type: 'commit' });
    await a.advance(300);
    expect(Object.keys(await storedXs(storage))).toHaveLength(3);
    expect((await loaded(storage.repository)).rev).toBe(8);
  });

  it('REQ-P06 loading the newer version drops the text being edited and the gesture', async () => {
    const { a } = await bothLoadedThenBSaves();
    a.feed(KEYS.text, ...tapper('mouse')(600, 500));
    a.editor.editText({ type: 'value', text: 'Draft' });
    await a.editor.resolveStale('load');
    expect([a.editor.view.text, a.shown().length]).toEqual([null, 2]);
    expect(a.editor.view.tool).toBe('selection');
  });

  it('answers only a stale refusal, and only once', async () => {
    const { storage, a } = await bothLoadedThenBSaves();
    const first = a.editor.resolveStale('load');
    const second = a.editor.resolveStale('load');
    await Promise.all([first, second]);
    await a.editor.resolveStale('keep');
    await a.advance(0);
    expect([(await loaded(storage.repository)).rev, a.editor.view.save]).toEqual([
      6,
      { type: 'saved' },
    ]);
  });
});
