import type { FontFamily, FontSpec } from '@planewright/engine';

// The fonts behind the three families (ADR 0011). The web app declares each bundled face under
// its Planewright name; the generic family stands in until it loads and for the characters it
// lacks. The renderer draws with these, and the web app measures and edits texts with them too.

/** The CSS font family list of each family: its bundled face, then a generic fallback. */
export const FONT_STACKS: Readonly<Record<FontFamily, string>> = {
  sans: '"Planewright Sans", sans-serif',
  hand: '"Planewright Hand", cursive',
  mono: '"Planewright Mono", monospace',
};

/** A 2D context's font for a spec, its size in scene units. */
export const canvasFont = (font: FontSpec): string =>
  `${String(font.size)}px ${FONT_STACKS[font.family]}`;
