import type { Renderer, TextMeasurer, ViewportSize } from '@planewright/engine';

import type { CanvasSurface, Layer } from './canvas.ts';
import { drawOverlay } from './overlay-layer.ts';
import { createPathCache } from './path-cache.ts';
import { drawScene } from './scene-layer.ts';

// The renderer port's Canvas 2D implementation (ADR 0006).

export interface CanvasRendererOptions {
  /** The lower canvas, for committed and transient elements. */
  readonly scene: CanvasSurface;
  /** The upper canvas, for selection chrome, handles and the marquee. */
  readonly overlay: CanvasSurface;
  /** Measures the lines of texts, as the editor's text measurer does. */
  readonly measurer: TextMeasurer;
  /** Makes an empty path: a new Path2D unless a test records them. */
  readonly createPath?: () => Path2D;
}

function layerOf(canvas: CanvasSurface, name: string): Layer {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error(`The ${name} canvas gave no 2D context.`);
  return { canvas, context };
}

/**
 * Sizes a backing store to the CSS size times the pixel ratio, rounded. Assigning a size clears
 * the canvas, so a size that has not changed is left alone.
 */
function fit(canvas: CanvasSurface, viewport: ViewportSize): void {
  const width = Math.round(viewport.width * viewport.pixelRatio);
  const height = Math.round(viewport.height * viewport.pixelRatio);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

/**
 * A renderer over a scene canvas and an overlay canvas stacked above it. Each frame redraws only
 * the layers whose part it carries, the scene first, so an overlay-only frame never touches the
 * scene canvas. It holds no editing state, only the cache of paths and text layouts.
 */
export function createCanvasRenderer(options: CanvasRendererOptions): Renderer {
  const scene = layerOf(options.scene, 'scene');
  const overlay = layerOf(options.overlay, 'overlay');
  const cache = createPathCache(options.createPath ?? (() => new Path2D()), options.measurer);
  let disposed = false;
  return {
    render(frame) {
      if (disposed) throw new Error('This canvas renderer has been disposed.');
      if (frame.scene !== undefined) {
        fit(scene.canvas, frame.viewport);
        drawScene(scene, frame, frame.scene, cache);
      }
      if (frame.overlay !== undefined) {
        fit(overlay.canvas, frame.viewport);
        drawOverlay(overlay, frame, frame.overlay, cache);
      }
    },
    dispose() {
      disposed = true;
      cache.clear();
    },
  };
}
