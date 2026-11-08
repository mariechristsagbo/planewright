import { createEditor } from '@planewright/engine';
import type { Editor, EditorPorts, RenderFrame, Renderer } from '@planewright/engine';
import type { CanvasSurface } from '@planewright/render-canvas';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { EditorProvider } from '../../src/editor/EditorProvider.tsx';
import type { EditorSurface } from '../../src/editor/surface.ts';
import type { Platform } from '../../src/platform/platform.ts';

// An editor over manual ports, with a renderer factory that records what it is given, for the
// editor surface's component tests in jsdom (which has no 2D canvas).

export interface SurfaceHarness {
  readonly editor: Editor;
  readonly surface: EditorSurface;
  /** Runs the animation frames asked for so far. */
  readonly flush: () => void;
  /** The canvases each renderer was made over, and the frames it was asked to draw. */
  readonly made: {
    readonly canvases: readonly CanvasSurface[];
    readonly frames: RenderFrame[];
    disposed: boolean;
  }[];
  readonly wrap: (children: ReactNode) => ReactNode;
}

export function surfaceHarness(platform: Platform = 'other'): SurfaceHarness {
  const frames: ((time: number) => void)[] = [];
  let id = 0;
  const ports: EditorPorts = {
    clock: { now: () => 0 },
    scheduler: {
      after: () => () => undefined,
      nextFrame(task) {
        frames.push(task);
        return () => {
          frames.splice(frames.indexOf(task) >>> 0, 1);
        };
      },
    },
    ids: { next: () => String((id += 1)).padStart(22, 'A') },
    // Every character is 10 px wide at size 20, as the engine's own tests measure.
    text: {
      measure: (text, font) => ({ width: (text.length * font.size) / 2, ascent: 16, descent: 4 }),
    },
  };
  const editor = createEditor(ports);
  const made: SurfaceHarness['made'] = [];
  const surface: EditorSurface = {
    editor,
    platform,
    createRenderer: (scene, overlay): Renderer => {
      const record = { canvases: [scene, overlay], frames: [] as RenderFrame[], disposed: false };
      made.push(record);
      return {
        render: (frame) => {
          record.frames.push(frame);
        },
        dispose: () => {
          record.disposed = true;
        },
      };
    },
  };
  return {
    editor,
    surface,
    made,
    flush: () => {
      act(() => {
        for (const task of frames.splice(0)) task(0);
      });
    },
    wrap: (children) => <EditorProvider surface={surface}>{children}</EditorProvider>,
  };
}
