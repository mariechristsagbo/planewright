import type { Editor, EditorView, SaveStatus } from '@planewright/engine';
import { act } from '@testing-library/react';

import type { EditorSurface } from '../../src/editor/surface.ts';
import type { StorageNotice } from '../../src/platform/storage.ts';
import { surfaceHarness } from './surface.tsx';
import type { SurfaceHarness } from './surface.tsx';

// A real editor whose view reports a save status that the test sets, for the components that show
// saving (the v0.2 plan's S7). Each status set is published as the engine publishes one, in a new
// view; the editor's own publishes, such as a camera step, keep the status's identity, as
// view.save does (packages/engine/src/editor/view.ts).

export interface SaveHarness {
  /** The editor the components see, whose view carries the status set last. */
  readonly editor: Editor;
  /** The real editor behind it, for camera steps and drawing. */
  readonly inner: Editor;
  readonly surface: EditorSurface;
  readonly said: SurfaceHarness['said'];
  /** Publishes a new status, inside act(). */
  readonly setSave: (save: SaveStatus | null) => void;
}

export function saveHarness(
  save: SaveStatus | null,
  storageNotice: StorageNotice | null = null,
): SaveHarness {
  const { editor: inner, surface, said } = surfaceHarness();
  const listeners = new Set<(view: EditorView) => void>();
  let status = save;
  let view: EditorView = { ...inner.view, save: status };
  const publish = (): void => {
    view = { ...inner.view, save: status };
    for (const listener of [...listeners]) listener(view);
  };
  inner.subscribe(publish);
  const editor: Editor = {
    ...inner,
    get view() {
      return view;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    editor,
    inner,
    surface: { ...surface, editor, storageNotice },
    said,
    setSave(next) {
      act(() => {
        status = next;
        publish();
      });
    },
  };
}
