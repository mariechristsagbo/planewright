import type { Color } from './color.ts';

// Each list holds every value its type allows, so that the codec checks against the same source.
export const STROKE_DASHES = ['solid', 'dashed', 'dotted'] as const;
export const FILL_PATTERNS = ['solid', 'hatch', 'crosshatch'] as const;
export const CORNERS = ['sharp', 'round'] as const;
/** 0 draws exact geometry; 1 and 2 are reserved for the P1 sketch styles. */
export const SKETCH_LEVELS = [0, 1, 2] as const;
/** Planewright's family names, each mapped to a bundled open-licence font by the text issue. */
export const FONT_FAMILIES = ['sans', 'hand', 'mono'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;

export interface Stroke {
  readonly color: Color;
  /** Scene units, in (0, 100]. */
  readonly width: number;
  readonly dash: (typeof STROKE_DASHES)[number];
}

export interface Fill {
  readonly color: Color;
  readonly pattern: (typeof FILL_PATTERNS)[number];
}

export interface Style {
  readonly stroke: Stroke;
  /** Null draws no fill: the shape is hit on its outline only (REQ-S01). */
  readonly fill: Fill | null;
  /** In [0, 1]. */
  readonly opacity: number;
  readonly corners: (typeof CORNERS)[number];
  readonly sketch: (typeof SKETCH_LEVELS)[number];
}

export type FontFamily = (typeof FONT_FAMILIES)[number];

export interface FontSpec {
  readonly family: FontFamily;
  /** Scene units, in [1, 1000]. */
  readonly size: number;
  /** A multiple of the size, in [1, 3]. */
  readonly lineHeight: number;
}

export interface TextBlock {
  /** At most 100,000 characters, with line breaks as '\n'. */
  readonly text: string;
  readonly font: FontSpec;
  readonly align: (typeof TEXT_ALIGNS)[number];
}
