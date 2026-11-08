import type { TextMeasurer } from '@planewright/engine';
import { canvasFont } from '@planewright/render-canvas';

// The text measurer port over a 2D context (docs/architecture/engine/modules.md#ports), in the
// bundled fonts that the canvas renderer draws with (ADR 0011).

export type MeasuringContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;

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
