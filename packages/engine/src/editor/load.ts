import { DEFAULT_CAMERA, limitCamera } from '../camera/camera.ts';
import type { DocumentState } from '../model/document.ts';
import type { SessionState } from '../persistence/repository.ts';
import { isEmptyChangeSet } from '../scene/change-set.ts';
import { loadOf } from './editor-core.ts';
import type { EditorCore } from './editor-core.ts';

// Opening a stored document (docs/architecture/engine/persistence.md#loading): its elements as
// `load` change sets, which neither autosave nor the history records, then its camera and
// selection. The caller sees to the tool and the history.

/** Shows the stored session: the camera within its limits and the selection that exists. */
export function showSession(core: EditorCore, { camera, selection }: SessionState): void {
  // The repository's camera is untrusted too: one that holds NaN gives the default camera.
  core.loop.update({ camera: limitCamera(camera, DEFAULT_CAMERA) });
  core.selection.set(selection);
}

/**
 * Replaces the scene's document with another one: every element and group removed, then the
 * other's added with its canvas, each as a `load` set. The scene must hold no preview.
 */
export function replaceDocument(core: EditorCore, document: DocumentState): void {
  const current = core.scene.document();
  const removal = {
    elements: [...current.elements.values()].map(
      (element) => ({ type: 'remove', element }) as const,
    ),
    groups: [...current.groups.values()].map((group) => ({ type: 'remove', group }) as const),
  };
  if (!isEmptyChangeSet(removal)) core.scene.apply({ ...removal, ...core.stamp() }, 'load');
  const before = core.scene.canvas;
  const canvas =
    before.background === document.canvas.background
      ? {}
      : { canvas: { before, after: document.canvas } };
  const addition = { ...loadOf(document, core.stamp()), ...canvas };
  if (!isEmptyChangeSet(addition)) core.scene.apply(addition, 'load');
}
