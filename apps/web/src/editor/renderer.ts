import type { Renderer } from '@planewright/engine';
import { createCanvasRenderer } from '@planewright/render-canvas';
import type { CanvasSurface } from '@planewright/render-canvas';

import { canvasTextMeasurer } from '../platform/text-measurer.ts';
import type { MeasuringContext } from '../platform/text-measurer.ts';

/** Makes the renderer of the canvas host's scene and overlay canvases. */
export type RendererFactory = (scene: CanvasSurface, overlay: CanvasSurface) => Renderer;

/** The page that gives an offscreen canvas to measure text with. */
export interface MeasuringPage {
  createElement(tag: 'canvas'): { getContext(id: '2d'): MeasuringContext | null };
}

/** The Canvas 2D renderer, measuring texts on a canvas of its own so drawing state is never shared. */
export const canvasRenderer =
  (page: MeasuringPage): RendererFactory =>
  (scene, overlay) => {
    const context = page.createElement('canvas').getContext('2d');
    if (context === null) {
      throw new Error('This browser gave no 2D canvas context to measure text with.');
    }
    return createCanvasRenderer({ scene, overlay, measurer: canvasTextMeasurer(context) });
  };
