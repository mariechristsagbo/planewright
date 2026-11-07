import type { ReactNode } from 'react';

import { SurfaceContext } from './surface.ts';
import type { EditorSurface } from './surface.ts';

/**
 * Gives one editor surface to the components below it. The page creates the editor once, so a
 * component that mounts again, as React's strict mode makes it, finds the same editor.
 */
export function EditorProvider({
  surface,
  children,
}: {
  readonly surface: EditorSurface;
  readonly children: ReactNode;
}) {
  return <SurfaceContext value={surface}>{children}</SurfaceContext>;
}
