import { describe, expect, it } from 'vitest';

import type { TextElement } from '../../src/model/elements.ts';
import { KEYS } from '../support/creation-input.ts';
import { memoryStorage } from '../support/memory-backend.ts';
import { loaded, savingEditor } from '../support/saving-editors.ts';
import { doubleTapper, drag, tapper } from '../support/selection-input.ts';

// Autosave through the editor (docs/architecture/engine/persistence.md#autosave): committed
// creations and deletions are saved, a text being edited never is, a new empty one included, and
// the camera and selection ride along (REQ-P01, REQ-P03, REQ-V11).

/** The texts of the stored document. */
async function storedTexts(storage: ReturnType<typeof memoryStorage>): Promise<string[]> {
  const result = await storage.repository.load();
  if (result.type !== 'loaded') return [];
  return [...result.stored.document.elements.values()]
    .filter((element): element is TextElement => element.kind === 'text')
    .map(({ content }) => content.text);
}

describe('saving from the editor', () => {
  it('REQ-P01 REQ-P03 saves a drawn rectangle within 300 ms, then its deletion', async () => {
    const storage = memoryStorage();
    const { editor, feed, advance } = savingEditor(storage.repository);
    const { start, to, end } = drag('mouse', [100, 100, 300, 200]);
    feed(KEYS.rectangle, ...start, to, end);
    expect(editor.view.save).toEqual({ type: 'pending' });
    await advance(300);
    expect(editor.view.save).toEqual({ type: 'saved' });
    const first = await loaded(storage.repository);
    expect([first.rev, first.document.elements.size]).toEqual([1, 1]);
    editor.run('selection.delete');
    await advance(300);
    const second = await loaded(storage.repository);
    expect([second.rev, second.document.elements.size]).toEqual([2, 0]);
    expect([...(storage.backend.elements.get(second.id)?.keys() ?? [])]).toEqual([]);
  });

  it('REQ-P01 never saves a text being edited, not even a new empty one, until it is committed', async () => {
    const storage = memoryStorage();
    const { editor, feed, advance } = savingEditor(storage.repository);
    feed(KEYS.text, ...tapper('mouse')(300, 300));
    expect(editor.view.text?.element.content.text).toBe('');
    await advance(5_000);
    editor.editText({ type: 'value', text: 'Hi' });
    editor.saveNow();
    await advance(5_000);
    expect(storage.backend.writes()).toBe(0);
    editor.editText({ type: 'commit' });
    await advance(300);
    expect(await storedTexts(storage)).toEqual(['Hi']);
  });

  it('REQ-P01 keeps the stored text while it is edited again, and saves the edit once committed', async () => {
    const storage = memoryStorage();
    const { editor, feed, advance } = savingEditor(storage.repository);
    feed(KEYS.text, ...tapper('mouse')(300, 300));
    editor.editText({ type: 'value', text: 'One' });
    editor.editText({ type: 'commit' });
    await advance(300);
    feed(...doubleTapper('mouse')(310, 300));
    expect(editor.view.text?.element.content.text).toBe('One');
    editor.editText({ type: 'value', text: 'Two' });
    await advance(5_000);
    expect(await storedTexts(storage)).toEqual(['One']);
    editor.editText({ type: 'commit' });
    await advance(300);
    expect(await storedTexts(storage)).toEqual(['Two']);
  });

  it('REQ-V11 saves a camera change alone 1 s after it, and saveNow saves at once', async () => {
    const storage = memoryStorage();
    const { editor, feed, advance } = savingEditor(storage.repository);
    feed(KEYS.rectangle, ...tapper('mouse')(500, 400));
    await advance(300);
    const created = await loaded(storage.repository);
    expect([created.rev, created.session.selection]).toEqual([1, editor.view.selection]);
    editor.run('view.zoom-in');
    await advance(999);
    expect((await loaded(storage.repository)).session.camera.zoom).toBe(1);
    await advance(1);
    expect((await loaded(storage.repository)).session.camera.zoom).toBe(1.1);
    editor.select([]);
    editor.saveNow();
    await advance(0);
    const stored = await loaded(storage.repository);
    expect([stored.session.selection, stored.rev]).toEqual([[], 1]);
  });
});
