import type { TextMeasurer } from '@planewright/engine';
import { canvasFont } from '@planewright/render-canvas';

// The text measurer port over a 2D context (docs/architecture/engine/modules.md#ports), in the
// bundled fonts that the canvas renderer draws with (ADR 0011).

export type MeasuringContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;

/** The page that gives an offscreen canvas to measure text with. */
export interface MeasuringPage {
  createElement(tag: 'canvas'): { getContext(id: '2d'): MeasuringContext | null };
}

/** A measurer on an offscreen canvas of its own, so that no drawing state is ever shared. */
export function pageTextMeasurer(page: MeasuringPage): TextMeasurer {
  const context = page.createElement('canvas').getContext('2d');
  if (context === null) {
    throw new Error('This browser gave no 2D canvas context to measure text with.');
  }
  return canvasTextMeasurer(context);
}

export function canvasTextMeasurer(context: MeasuringContext): TextMeasurer {
  return {
    measure(text, font) {
      context.font = canvasFont(font);
      const metrics = context.measureText(text);
      return {
        width: metrics.width,
        ascent: metrics.fontBoundingBoxAscent,
        descent: metrics.fontBoundingBoxDescent,
      };
    },
  };
}
