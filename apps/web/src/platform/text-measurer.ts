import type { FontFamily, TextMeasurer } from '@planewright/engine';

// The text measurer port over a 2D context (docs/architecture/engine/modules.md#ports). Its font
// families are the canvas renderer's, generic until the text issue chooses fonts.

const FAMILIES: Readonly<Record<FontFamily, string>> = {
  sans: 'sans-serif',
  hand: 'cursive',
  mono: 'monospace',
};

export type MeasuringContext = Pick<CanvasRenderingContext2D, 'font' | 'measureText'>;

export function canvasTextMeasurer(context: MeasuringContext): TextMeasurer {
  return {
    measure(text, font) {
      context.font = `${String(font.size)}px ${FAMILIES[font.family]}`;
      const metrics = context.measureText(text);
      return {
        width: metrics.width,
        ascent: metrics.fontBoundingBoxAscent,
        descent: metrics.fontBoundingBoxDescent,
      };
    },
  };
}
