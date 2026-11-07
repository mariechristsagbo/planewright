import type { Editor, EditorView } from '@planewright/engine';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

import type { Platform } from '../platform/platform.ts';
import type { RendererFactory } from './renderer.ts';

/** What the editor surface's components share: the editor, the platform and the renderer factory. */
export interface EditorSurface {
  readonly editor: Editor;
  readonly platform: Platform;
  readonly createRenderer: RendererFactory;
}

export const SurfaceContext = createContext<EditorSurface | null>(null);

export function useSurface(): EditorSurface {
  const surface = useContext(SurfaceContext);
  if (surface === null) throw new Error('The editor surface needs an EditorProvider above it.');
  return surface;
}

/** The editor's view; the component renders again whenever the editor publishes a new one. */
export function useEditorView(): EditorView {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => editor.view);
}
