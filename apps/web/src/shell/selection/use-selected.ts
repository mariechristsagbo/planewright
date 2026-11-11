import type { EditorView } from '@planewright/engine';
import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';

import { focusCanvas } from '../../a11y/focus.ts';
import { useSurface } from '../../editor/surface.ts';
import { selectionGeometry } from './geometry.ts';
import type { SelectionGeometry } from './geometry.ts';

// What the selection's surfaces read of the editor's view (ADR 0012, decision 14; the v0.2 plan's
// S6): only values that keep their identity across camera changes, so that a pan or zoom step,
// which publishes a new view, renders none of them, never the whole view.

/** One value of the view; the component renders again only when it changes. */
function useViewValue<T>(read: (view: EditorView) => T): T {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => read(editor.view));
}

/** What the panel, the bar and the Details sheet show of a selection. */
export interface Selected {
  readonly geometry: SelectionGeometry;
  /** Whether canvas.enter would edit the selected element, a text selected alone. */
  readonly editsText: boolean;
}

/**
 * The selection's geometry, worked out again only when the elements or the selection change, and
 * whether Edit text applies; null while nothing drawn is selected or a text is being edited.
 */
export function useSelected(): Selected | null {
  const elements = useViewValue((view) => view.elements);
  const selection = useViewValue((view) => view.selection);
  const editing = useViewValue((view) => view.text !== null);
  const tool = useViewValue((view) => view.tool);
  const geometry = useMemo(() => selectionGeometry(elements, selection), [elements, selection]);
  if (geometry === null || editing) return null;
  // As canvas.enter decides: the Selection tool, one element selected, and that element a text.
  const editsText =
    tool === 'selection' &&
    selection.length === 1 &&
    geometry.type === 'single' &&
    geometry.kind === 'text';
  return { geometry, editsText };
}

/**
 * Gives the focus to the canvas when the surface goes with the focus inside it, as Delete or an
 * emptied selection makes it go, so that the focus never falls to the page's body (REQ-Y02). The
 * cleanup runs before the surface leaves the page, while the focus is still inside it.
 */
export function useFocusRescue(surface: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = surface.current;
    return () => {
      if (element?.contains(document.activeElement) === true) focusCanvas(document);
    };
  }, [surface]);
}
