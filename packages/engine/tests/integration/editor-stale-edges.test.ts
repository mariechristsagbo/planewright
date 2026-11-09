import { describe, expect, it } from 'vitest';

import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { DocumentId } from '../../src/persistence/repository.ts';
import { shapeElement, testId } from '../support/elements.ts';
import { NO_SESSION, memoryStorage, seed } from '../support/memory-backend.ts';
import { loaded, savingEditor } from '../support/saving-editors.ts';
import type { SavingEditor } from '../support/saving-editors.ts';
import { color } from '../support/scene-state.ts';
import { documentOf } from '../support/selection-scene.ts';

// The edges of answering a stale save (docs/architecture/engine/persistence.md#what-eng-13-decided):
// loading a newer version that holds no element or another canvas, a repository that no longer
// loads a document, and an editor disposed while the newer version loads.

const ID = 'D000000000000000000001' as DocumentId;
const AT_REVISION_5 = documentOf(shapeElement('rectangle', 100, 80, { id: 1, x: 100, y: 100 }));

/** A, at revision 5, made stale by another tab that replaced the document with `newer`. */
async function staleAgainst(newer: DocumentState) {
  const storage = memoryStorage();
  seed(storage.backend, { id: ID, rev: 5, document: AT_REVISION_5 });
  const a = savingEditor(storage.repository, await loaded(storage.repository), 'A');
  const replaced = await storage.repository.save({
    type: 'replace',
    id: ID,
    baseRev: 5,
    document: newer,
    session: NO_SESSION,
  });
  expect(replaced).toEqual({ ok: true, rev: 6 });
  a.editor.select([testId(1)]);
  a.editor.run('selection.nudge-right');
  await a.advance(300);
  expect(a.editor.view.save).toEqual({ type: 'stale' });
  return { storage, a };
}

/** The canvas background of the last frame the editor hands over. */
function background({ editor, scheduler }: SavingEditor): string {
  const frames: RenderFrame[] = [];
  const stop = editor.onFrame((frame) => frames.push(frame));
  scheduler.frame();
  stop();
  return frames.at(-1)?.background ?? '';
}

describe('loading the newer version', () => {
  it('REQ-P06 shows a newer version that holds no element', async () => {
    const { a } = await staleAgainst(documentOf());
    await a.editor.resolveStale('load');
    expect([a.shown(), a.editor.view.selection, a.editor.view.save]).toEqual([
      [],
      [],
      { type: 'saved' },
    ]);
  });

  it('REQ-P06 takes the newer version’s canvas with its elements', async () => {
    const cream = color('#fff8e7');
    const newer = {
      ...documentOf(shapeElement('ellipse', 40, 40, { id: 2, x: 300 })),
      canvas: { background: cream },
    };
    const { a } = await staleAgainst(newer);
    expect(background(a)).toBe('#ffffff');
    await a.editor.resolveStale('load');
    expect([background(a), a.shown().map(({ id }) => id)]).toEqual([cream, [testId(2)]]);
  });

  it('REQ-P06 leaves the notice when the repository no longer loads a document', async () => {
    const { storage, a } = await staleAgainst(documentOf());
    storage.backend.close();
    await a.editor.resolveStale('load');
    expect([a.editor.view.save, a.shown().map(({ x }) => x)]).toEqual([{ type: 'stale' }, [101]]);
  });

  it('does nothing once the editor is disposed while the newer version loads', async () => {
    const { storage, a } = await staleAgainst(documentOf());
    const answer = a.editor.resolveStale('load');
    a.editor.dispose();
    await answer;
    expect((await loaded(storage.repository)).rev).toBe(6);
    expect(storage.backend.writes()).toBe(1);
  });
});
