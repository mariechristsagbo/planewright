import { describe, expect, it } from 'vitest';

import type { DocumentId } from '../../src/persistence/repository.ts';
import { KEYS } from '../support/creation-input.ts';
import { shapeElement, testId } from '../support/elements.ts';
import { memoryStorage, seed } from '../support/memory-backend.ts';
import { loaded, savingEditor } from '../support/saving-editors.ts';
import { documentOf } from '../support/selection-scene.ts';

// Opening a stored document (docs/architecture/engine/persistence.md#loading): the document, its
// camera and its selection come back, the tool is Selection and the history is empty.

const ID = 'D000000000000000000001' as DocumentId;
const TWO = documentOf(
  shapeElement('rectangle', 100, 80, { id: 1, x: 100, y: 100 }),
  shapeElement('ellipse', 60, 60, { id: 2, x: 400, y: 200 }),
);
const CAMERA = { x: 50, y: -20, zoom: 1.5 };

describe('an editor over a stored document', () => {
  it('REQ-P02 REQ-H03 REQ-V11 shows its elements, camera and selection, with the Selection tool and no history', async () => {
    const { backend, repository } = memoryStorage();
    seed(backend, { id: ID, rev: 4, document: TWO }, { camera: CAMERA, selection: [testId(2)] });
    const { editor, shown } = savingEditor(repository, await loaded(repository));
    const { view } = editor;
    expect([view.camera, view.selection, view.tool]).toEqual([CAMERA, [testId(2)], 'selection']);
    expect([view.canUndo, view.canRedo, view.save]).toEqual([false, false, { type: 'saved' }]);
    expect(shown().map(({ id }) => id)).toEqual([testId(1), testId(2)]);
  });

  it('REQ-V08 limits a camera that the repository gives, and gives the default one for NaN', () => {
    const stored = (camera: { x: number; y: number; zoom: number }) => ({
      id: ID,
      rev: 1,
      document: TWO,
      session: { camera, selection: [] },
    });
    const far = savingEditor(undefined, stored({ x: 5e9, y: 0, zoom: 100 })).editor;
    expect(far.view.camera).toEqual({ x: 1e9, y: 0, zoom: 30 });
    const broken = savingEditor(undefined, stored({ x: Number.NaN, y: 3, zoom: 2 })).editor;
    expect(broken.view.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('REQ-P02 selects only the stored selection that exists', () => {
    const session = { camera: CAMERA, selection: [testId(9), testId(1), testId(1)] };
    const { editor } = savingEditor(undefined, { id: ID, rev: 1, document: TWO, session });
    expect(editor.view.selection).toEqual([testId(1)]);
  });

  it('REQ-H03 undo after a load changes nothing', () => {
    const session = { camera: CAMERA, selection: [] };
    const { editor, feed, shown } = savingEditor(undefined, {
      id: ID,
      rev: 1,
      document: TWO,
      session,
    });
    const before = shown();
    feed(KEYS.undo);
    expect(shown()).toBe(before);
    expect(editor.view.canUndo).toBe(false);
  });

  it('an editor without a repository reports no save status and saves nothing', async () => {
    const { editor, advance } = savingEditor(undefined);
    expect(editor.view.save).toBeNull();
    editor.saveNow();
    await editor.resolveStale('load');
    await editor.resolveStale('keep');
    await advance(5_000);
    expect(editor.view.save).toBeNull();
  });
});
