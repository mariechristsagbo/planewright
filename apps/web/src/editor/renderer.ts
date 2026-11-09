import type { Renderer } from '@planewright/engine';
import { createCanvasRenderer } from '@planewright/render-canvas';
import type { CanvasSurface } from '@planewright/render-canvas';

import { timedRenderer } from '../platform/frame-timing.ts';
import type { FrameTiming } from '../platform/frame-timing.ts';
import { pageTextMeasurer } from '../platform/text-measurer.ts';
import type { MeasuringPage } from '../platform/text-measurer.ts';

/** Makes the renderer of the canvas host's scene and overlay canvases. */
export type RendererFactory = (scene: CanvasSurface, overlay: CanvasSurface) => Renderer;

/**
 * The Canvas 2D renderer, measuring texts on a canvas of its own so drawing state is never shared,
 * with each render measured when the page was opened to measure its frames.
 */
export const canvasRenderer =
  (page: MeasuringPage, timing: FrameTiming | null = null): RendererFactory =>
  (scene, overlay) => {
    const renderer = createCanvasRenderer({ scene, overlay, measurer: pageTextMeasurer(page) });
    return timing === null ? renderer : timedRenderer(renderer, timing);
  };
