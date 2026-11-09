import { layoutText } from '../geometry/text-layout.ts';
import type { ElementChange } from '../scene/change-set.ts';
import { LIMITS } from '../model/limits.ts';
import type { EditorCore } from './editor-core.ts';

// Measuring texts again (docs/architecture/engine/domain-model.md#elements, ADR 0011): a text
// stores its measured size, which is measured again when a font finishes loading, since a text
// measured in a fallback font would otherwise keep that size.

/** Updates of every text whose measured size differs now, keeping its origin. */
function measuredAgain(core: EditorCore): ElementChange[] {
  return core.scene.ordered().flatMap((element): ElementChange[] => {
    if (element.kind !== 'text') return [];
    const { width, height } = layoutText(element.content, core.measurer);
    const same = width === element.width && height === element.height;
    if (same || width > LIMITS.size || height > LIMITS.size) return [];
    const before = { width: element.width, height: element.height };
    return [{ type: 'update', id: element.id, before, after: { width, height } }];
  });
}

/**
 * Measures every text again through the text port, as one `local` change set that is no undo
 * step: the font's arrival is nobody's edit, and autosave saves it. While a gesture or a text
 * session holds the history's transaction, it waits until the transaction ends, so that no
 * preview is measured or saved.
 */
export function measureTexts(core: EditorCore): void {
  core.measureLater = core.history.inTransaction;
  if (core.measureLater) return;
  const changes = measuredAgain(core);
  if (changes.length === 0) return;
  core.scene.apply({ elements: changes, groups: [], ...core.stamp() }, 'local');
}

/** Measures the texts that had to wait, once no transaction is open any more. */
export function measureWaiting(core: EditorCore): void {
  if (core.measureLater && !core.history.inTransaction) measureTexts(core);
}
