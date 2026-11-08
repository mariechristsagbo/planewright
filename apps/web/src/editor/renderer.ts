import type { Renderer } from '@planewright/engine';
import { createCanvasRenderer } from '@planewright/render-canvas';
import type { CanvasSurface } from '@planewright/render-canvas';

import { pageTextMeasurer } from '../platform/text-measurer.ts';
import type { MeasuringPage } from '../platform/text-measurer.ts';

/** Makes the renderer of the canvas host's scene and overlay canvases. */
export type RendererFactory = (scene: CanvasSurface, overlay: CanvasSurface) => Renderer;

/** The Canvas 2D renderer, measuring texts on a canvas of its own so drawing state is never shared. */
export const canvasRenderer =
  (page: MeasuringPage): RendererFactory =>
  (scene, overlay) =>
    createCanvasRenderer({ scene, overlay, measurer: pageTextMeasurer(page) });
