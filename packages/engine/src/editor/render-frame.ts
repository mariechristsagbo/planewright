import type { Camera } from '../camera/camera.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import type { Color } from '../model/color.ts';
import type { Box, Element, Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { HandleId } from '../selection/handles.ts';

// Render frames and the renderer port
// (docs/architecture/engine/rendering-and-hit-testing.md#render-frame-and-renderer-port).

/** What the overlay layer draws. Its primitives are in screen space, so zoom never resizes them. */
export type OverlayPrimitive =
  | { readonly type: 'selection-outline'; readonly corners: readonly [Point, Point, Point, Point] }
  | {
      readonly type: 'handle';
      readonly handle: HandleId;
      readonly center: Point;
      readonly size: number;
    }
  | { readonly type: 'marquee'; readonly box: Box }
  | { readonly type: 'element-outline'; readonly element: ElementId };

/** The colour scheme a frame is drawn in; P0 has only the light theme. */
export type Theme = 'light' | 'dark';

/**
 * Everything the renderer draws, as plain data. A layer's part is present only when that layer
 * must be redrawn; a renderer leaves an absent layer as it is.
 */
export interface RenderFrame {
  readonly camera: Camera;
  readonly viewport: ViewportSize;
  readonly theme: Theme;
  /** The document's canvas background, which the scene layer is cleared to. */
  readonly background: Color;
  readonly scene?: {
    /** The visible elements, bottom first. */
    readonly elements: readonly Element[];
    /** Elements that something else draws, such as the text being edited; skipped. */
    readonly hidden: readonly ElementId[];
    /** Elements removed since the last frame that redrew the scene, so caches can drop them. */
    readonly removed: readonly ElementId[];
  };
  readonly overlay?: { readonly primitives: readonly OverlayPrimitive[] };
}

/** The renderer port: it draws frames and holds no editing state. */
export interface Renderer {
  render(frame: RenderFrame): void;
  dispose(): void;
}
