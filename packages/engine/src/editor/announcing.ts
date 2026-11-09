import type { HistoryEntry } from '../history/entry.ts';
import type { History } from '../history/history.ts';
import type { ElementChange } from '../scene/change-set.ts';
import type { SceneReader } from '../scene/store.ts';
import { sameIds } from '../selection/selection.ts';
import type { AnnouncementValues, Announcer } from './announcer.ts';
import type { EditorCore } from './editor-core.ts';

// What the editor announces (docs/architecture/engine/quality.md#accessibility, REQ-Y04): after
// each input, command or call, the change, undo or redo it made, or else the new selection count.

/** A history entry that a commit, an undo or a redo produced since the last announcement. */
export interface Note {
  readonly key: 'change' | 'undo' | 'redo';
  readonly entry: HistoryEntry;
}

/**
 * The history, noting each entry that a transaction's commit records and each that undo and redo
 * apply, so that the editor can announce them.
 */
export function notingHistory(history: History, notes: Note[]): History {
  const noted = (key: Note['key'], entry: HistoryEntry | null): HistoryEntry | null => {
    if (entry !== null) notes.push({ key, entry });
    return entry;
  };
  return {
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
    get inTransaction() {
      return history.inTransaction;
    },
    begin() {
      const transaction = history.begin();
      return {
        preview: (changes) => {
          transaction.preview(changes);
        },
        commit: (label, options) => noted('change', transaction.commit(label, options)),
        cancel: () => {
          transaction.cancel();
        },
      };
    },
    record: (entry) => {
      history.record(entry);
    },
    undo: () => noted('undo', history.undo()),
    redo: () => noted('redo', history.redo()),
    clear: () => {
      history.clear();
    },
  };
}

/** The kind of the element a change is about, as the scene holds it for an update. */
const kindOf = (change: ElementChange, scene: SceneReader): string =>
  change.type === 'update' ? (scene.get(change.id)?.kind ?? '') : change.element.kind;

/** A note's values: its label, its element count, a lone element's kind and the selection count. */
function valuesOf({ entry }: Note, scene: SceneReader, selected: number): AnnouncementValues {
  const changes = entry.changes.elements;
  const [only] = changes;
  const kind = changes.length === 1 && only !== undefined ? kindOf(only, scene) : '';
  return { action: entry.label, count: changes.length, kind, selected };
}

export interface Announcing {
  /** Announces the last note since the last call, or else a change of the selection's count. */
  readonly publish: () => void;
  /**
   * Takes the editor's state as already said, without announcing it, and starts announcing: the
   * editor settles once it has shown a stored document's session.
   */
  readonly settle: () => void;
}

export function createAnnouncing(core: EditorCore, announcer: Announcer | undefined): Announcing {
  let said = core.selection.get();
  let settled = false;
  return {
    publish() {
      const notes = core.notes.splice(0);
      const selection = core.selection.get();
      if (!settled || announcer === undefined) return;
      const note = notes.at(-1);
      if (note !== undefined) {
        announcer.announce(note.key, valuesOf(note, core.scene, selection.length));
      } else if (!sameIds(selection, said)) {
        announcer.announce('selection', { selected: selection.length });
      }
      said = selection;
    },
    settle() {
      core.notes.length = 0;
      said = core.selection.get();
      settled = true;
    },
  };
}
