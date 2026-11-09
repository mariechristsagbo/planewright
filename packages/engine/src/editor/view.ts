import type { Camera } from '../camera/camera.ts';
import { geometryOf } from '../geometry/kinds.ts';
import type { Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { SaveStatus } from '../persistence/autosave.ts';
import type { Cancel } from '../ports/ports.ts';
import { sameIds } from '../selection/selection.ts';
import type { CursorKind, ToolId } from '../tools/tool.ts';
import type { EditorCore } from './editor-core.ts';
import { textView } from './text-session.ts';
import type { TextEditView } from './text-session.ts';

// The editor's view: what the interface reads, published to its listeners after each change.

/** What the interface reads: a new object after every change. */
export interface EditorView {
  readonly tool: ToolId;
  /** Whether a creation tool stays active after a creation (REQ-C05). */
  readonly toolLock: boolean;
  readonly cursor: CursorKind;
  readonly camera: Camera;
  /** The selected elements, in the order they were selected. */
  readonly selection: readonly ElementId[];
  /**
   * Whether the history has a step to undo or redo; false while a text is edited, whose session
   * holds the history's transaction and so disables both commands until it ends (REQ-H06).
   */
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** The text being edited and its box on screen, or null when no text is edited. */
  readonly text: TextEditView | null;
  /** Whether the drawing is saved, or null when this editor saves nothing (REQ-P05, REQ-P06). */
  readonly save: SaveStatus | null;
  /**
   * The drawn elements in drawing order, bottom first, as last committed, for the element list
   * (REQ-Y05): while a gesture or a text session is open, the same list as before it, so that it
   * never shows a preview. The kinds that P0 does not draw are left out, as Select all leaves them.
   */
  readonly elements: readonly Element[];
}

/** The listed elements, with the scene's ordered elements they were taken from. */
interface Listed {
  readonly source: readonly Element[] | null;
  readonly elements: readonly Element[];
}

/**
 * The elements to list: the last list while a transaction is open or the scene still holds the
 * same ordered elements, and otherwise its drawn elements, read once per committed change.
 */
function listedOf(core: EditorCore, last: Listed): Listed {
  if (core.transaction !== null || core.session !== null) return last;
  const source = core.scene.ordered();
  if (source === last.source) return last;
  return { source, elements: source.filter((element) => geometryOf(element) !== undefined) };
}

const viewOf = (core: EditorCore, elements: readonly Element[]): EditorView => ({
  tool: core.tool.id,
  toolLock: core.toolLock,
  cursor: core.cursor,
  camera: core.loop.state().camera,
  selection: core.selection.get(),
  canUndo: core.history.canUndo && core.session === null,
  canRedo: core.history.canRedo && core.session === null,
  text: textView(core),
  save: core.saveStatus,
  elements,
});

/** The tool, its lock and the cursor; Undo and Redo; saving. */
const sameControls = (a: EditorView, b: EditorView): boolean =>
  a.tool === b.tool &&
  a.toolLock === b.toolLock &&
  a.cursor === b.cursor &&
  a.canUndo === b.canUndo &&
  a.canRedo === b.canRedo &&
  a.save === b.save;

export const sameView = (a: EditorView, b: EditorView): boolean =>
  sameControls(a, b) &&
  a.camera === b.camera &&
  a.elements === b.elements &&
  sameIds(a.selection, b.selection) &&
  // The box follows from the element and the camera, which are compared by identity.
  a.text?.element === b.text?.element;

export interface ViewPublisher {
  readonly view: () => EditorView;
  /** Builds the view again and tells every listener, if anything in it changed. */
  readonly publish: () => void;
  readonly subscribe: (listener: (view: EditorView) => void) => Cancel;
  readonly clear: () => void;
}

export function createViewPublisher(core: EditorCore): ViewPublisher {
  const listeners = new Set<{ readonly listener: (view: EditorView) => void }>();
  let listed = listedOf(core, { source: null, elements: [] });
  let view = viewOf(core, listed.elements);
  return {
    view: () => view,
    publish() {
      listed = listedOf(core, listed);
      const next = viewOf(core, listed.elements);
      if (sameView(next, view)) return;
      view = next;
      for (const { listener } of [...listeners]) listener(view);
    },
    subscribe(listener) {
      const entry = { listener };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    clear() {
      listeners.clear();
    },
  };
}
