import { useCallback, useSyncExternalStore } from 'react';

import { useSurface } from '../editor/surface.ts';
import { emptyCanvasNoteOf } from './empty-canvas-note.ts';

/**
 * The note's words while the canvas is empty, with no element and no text being edited, or null.
 * It renders again only when they change, not at each pan step, which publishes a new view (ADR
 * 0012, decision 14).
 */
function useEmptyCanvasNote(): string | null {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => {
    const { elements, text, save } = editor.view;
    return elements.length === 0 && text === null ? emptyCanvasNoteOf(save) : null;
  });
}

/**
 * The empty-canvas note (ADR 0012, D5): over an empty canvas, the pre-release sentence that About
 * this build holds, without its saving clause while nothing is saved in this browser
 * (empty-canvas-note.ts). Presses go through it to the canvas, and it is no status, so nothing
 * announces it.
 */
export function EmptyCanvasNote() {
  const note = useEmptyCanvasNote();
  return note === null ? null : <p className="empty-canvas-note">{note}</p>;
}
