import type { ViewportSize } from '../camera/viewport.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import { overlayPrimitives } from './overlay.ts';
import type { OverlayState } from './overlay.ts';
import type { RenderFrame, Theme } from './render-frame.ts';
import { visibleElements } from './visible.ts';

// Building render frames (docs/architecture/engine/rendering-and-hit-testing.md#render-frame-and-renderer-port).

/** What the frames show besides the document: the view, the overlay's inputs and hidden elements. */
export interface RenderState extends OverlayState {
  readonly viewport: ViewportSize;
  readonly theme: Theme;
  /** Elements that something else draws, such as the text being edited in the DOM overlay. */
  readonly hidden: readonly ElementId[];
}

/** Until the canvas host reports its size, the viewport is empty and only the margin is drawn. */
export const INITIAL_RENDER_STATE: RenderState = {
  camera: { x: 0, y: 0, zoom: 1 },
  viewport: { width: 0, height: 0, pixelRatio: 1 },
  theme: 'light',
  selection: [],
  pointer: 'mouse',
  marquee: null,
  hidden: [],
};

/** Which layers a frame redraws, and the elements removed since the scene layer was last drawn. */
export interface DirtyLayers {
  readonly scene: boolean;
  readonly overlay: boolean;
  readonly removed: readonly ElementId[];
}

/** The frame that redraws the dirty layers of a scene shown with a render state. */
export function buildFrame(
  scene: SceneReader,
  state: RenderState,
  dirty: DirtyLayers,
): RenderFrame {
  const { camera, viewport, theme, hidden } = state;
  return {
    camera,
    viewport,
    theme,
    background: scene.canvas.background,
    ...(dirty.scene
      ? {
          scene: {
            elements: visibleElements(scene, camera, viewport),
            hidden,
            removed: dirty.removed,
          },
        }
      : {}),
    ...(dirty.overlay ? { overlay: { primitives: overlayPrimitives(scene, state) } } : {}),
  };
}
