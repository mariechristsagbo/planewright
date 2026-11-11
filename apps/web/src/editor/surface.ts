import type { Editor, EditorView } from '@planewright/engine';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import type { LiveRegion } from '../a11y/live-region.ts';
import type { Platform } from '../platform/platform.ts';
import type { StorageNotice } from '../platform/storage.ts';
import type { RendererFactory } from './renderer.ts';

/**
 * What the editor surface's components share: the editor, the platform, the renderer factory, why
 * storage opened no drawing, if it did not, and the live regions, where the web app says what the
 * engine does not announce (REQ-Y04).
 */
export interface EditorSurface {
  readonly editor: Editor;
  readonly platform: Platform;
  readonly createRenderer: RendererFactory;
  readonly storageNotice: StorageNotice | null;
  readonly live: LiveRegion;
}

export const SurfaceContext = createContext<EditorSurface | null>(null);

export function useSurface(): EditorSurface {
  const surface = useContext(SurfaceContext);
  if (surface === null) throw new Error('The editor surface needs an EditorProvider above it.');
  return surface;
}

/**
 * One value of the editor's view; the component renders again only when that value changes. A pan
 * or zoom step publishes a new view whose other values keep their identity, so a component that
 * reads only those renders not at all (ADR 0012, decision 14).
 */
export function useViewValue<T>(read: (view: EditorView) => T): T {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => read(editor.view));
}

/** The editor's view; the component renders again whenever the editor publishes a new one. */
export function useEditorView(): EditorView {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => editor.view);
}
