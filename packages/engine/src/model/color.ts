import type { Brand } from './brand.ts';

/**
 * A theme-independent sRGB colour, `#rrggbb` or `#rrggbbaa` in lower case (ADR 0005); a theme
 * changes how it is drawn, never what is stored.
 */
export type Color = Brand<string, 'Color'>;

const COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;

export const isColor = (text: string): text is Color => COLOR.test(text);

/** The colour written as `text`, for constants and checked input; anything else throws. */
export function toColor(text: string): Color {
  if (isColor(text)) {
    return text;
  }
  throw new RangeError(
    `${JSON.stringify(text)} is not a colour: write #rrggbb or #rrggbbaa in lower case.`,
  );
}
