import { useCallback, useSyncExternalStore } from 'react';

import { useSurface } from '../editor/surface.ts';
import { BUILD_STATUS } from '../foundation.ts';

/**
 * Whether the canvas is empty: no element and no text being edited. It renders again only when
 * that changes, not at each pan step, which publishes a new view (ADR 0012, decision 14).
 */
function useEmptyCanvas(): boolean {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(
    subscribe,
    () => editor.view.elements.length === 0 && editor.view.text === null,
  );
}

/**
 * The empty-canvas note (ADR 0012, D5): over an empty canvas, the pre-release sentence that About
 * this build holds. Presses go through it to the canvas, and it is no status, so nothing announces
 * it.
 */
export function EmptyCanvasNote() {
  if (!useEmptyCanvas()) return null;
  return <p className="empty-canvas-note">{BUILD_STATUS}</p>;
}
