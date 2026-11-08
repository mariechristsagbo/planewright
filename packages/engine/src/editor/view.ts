import type { Camera } from '../camera/camera.ts';
import type { ElementId } from '../model/ids.ts';
import type { Cancel } from '../ports/ports.ts';
import { sameIds } from '../selection/selection.ts';
import type { CursorKind, ToolId } from '../tools/tool.ts';
import type { EditorCore } from './editor-core.ts';

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
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export const viewOf = (core: EditorCore): EditorView => ({
  tool: core.tool.id,
  toolLock: core.toolLock,
  cursor: core.cursor,
  camera: core.loop.state().camera,
  selection: core.selection.get(),
  canUndo: core.history.canUndo,
  canRedo: core.history.canRedo,
});

export const sameView = (a: EditorView, b: EditorView): boolean =>
  a.tool === b.tool &&
  a.toolLock === b.toolLock &&
  a.cursor === b.cursor &&
  a.camera === b.camera &&
  sameIds(a.selection, b.selection) &&
  a.canUndo === b.canUndo &&
  a.canRedo === b.canRedo;

export interface ViewPublisher {
  readonly view: () => EditorView;
  /** Builds the view again and tells every listener, if anything in it changed. */
  readonly publish: () => void;
  readonly subscribe: (listener: (view: EditorView) => void) => Cancel;
  readonly clear: () => void;
}

export function createViewPublisher(core: EditorCore): ViewPublisher {
  const listeners = new Set<{ readonly listener: (view: EditorView) => void }>();
  let view = viewOf(core);
  return {
    view: () => view,
    publish() {
      const next = viewOf(core);
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
