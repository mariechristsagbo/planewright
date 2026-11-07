import type { FontSpec } from '../model/style.ts';

// The text measurer port (docs/architecture/engine/modules.md#ports). It sits in `geometry`, the
// lowest layer whose types it needs, because it measures a model font for the text layout. The
// web app measures with an offscreen 2D context; tests give each character a fixed advance.

/** The metrics of one line of text, in scene units. */
export interface TextMetrics {
  readonly width: number;
  readonly ascent: number;
  readonly descent: number;
}

export interface TextMeasurer {
  measure(text: string, font: FontSpec): TextMetrics;
}
