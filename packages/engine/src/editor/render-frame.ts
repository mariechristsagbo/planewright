import type { Box, Point } from '../model/elements.ts';
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
