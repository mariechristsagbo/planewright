import type { FontSpec, TextBlock } from '../model/style.ts';
import type { TextMeasurer } from './text-measurer.ts';

// Text layout (docs/architecture/engine/rendering-and-hit-testing.md#text-layout).

export interface TextLine {
  readonly text: string;
  readonly width: number;
}

/** A laid-out block: its lines, the height of each, and the block's size. */
export interface TextLayout {
  readonly lines: readonly TextLine[];
  /** The font size times its line height. */
  readonly lineHeight: number;
  /** The widest line's width. */
  readonly width: number;
  /** The number of lines times the line height. */
  readonly height: number;
}

/** A line's width from the port, which lies outside the engine and so is checked. */
function widthOf(measurer: TextMeasurer, text: string, font: FontSpec): number {
  const { width } = measurer.measure(text, font);
  if (!(width >= 0 && width < Infinity)) {
    throw new RangeError(
      `The text measurer gave the width ${String(width)}; a width must be finite and not negative.`,
    );
  }
  return width;
}

/** Splits a word that is wider than the line into the longest runs of code points that fit. */
function breakWord(word: string, fits: (text: string) => boolean): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const character of word) {
    if (piece !== '' && !fits(piece + character)) {
      pieces.push(piece);
      piece = character;
    } else {
      piece += character;
    }
  }
  pieces.push(piece);
  return pieces;
}

/** Wraps one line at its spaces, breaking a word only when it is wider than the line. */
function wrapLine(text: string, fits: (text: string) => boolean): string[] {
  const lines: string[] = [];
  let current: string | undefined;
  for (const word of text.split(' ')) {
    const joined = current === undefined ? word : `${current} ${word}`;
    if (fits(joined)) {
      current = joined;
      continue;
    }
    if (current !== undefined) lines.push(current);
    const pieces = fits(word) ? [word] : breakWord(word, fits);
    lines.push(...pieces.slice(0, -1));
    current = pieces.at(-1);
  }
  lines.push(current ?? '');
  return lines;
}

/**
 * Lays a text block out through the measurer: it splits the text at its line breaks and, when a
 * maximum width is given (P1 container labels and notes), wraps each line at its spaces, breaking
 * a word only when it is wider than the line. P0 texts give no maximum width and never wrap.
 */
export function layoutText(
  block: TextBlock,
  measurer: TextMeasurer,
  maxWidth?: number,
): TextLayout {
  if (maxWidth !== undefined && !(maxWidth >= 0)) {
    throw new RangeError(`A maximum text width must be 0 or more, not ${String(maxWidth)}.`);
  }
  const measure = (text: string): number => widthOf(measurer, text, block.font);
  const paragraphs = block.text.split('\n');
  const texts =
    maxWidth === undefined
      ? paragraphs
      : paragraphs.flatMap((paragraph) => wrapLine(paragraph, (text) => measure(text) <= maxWidth));
  const lines = texts.map((text) => ({ text, width: measure(text) }));
  const lineHeight = block.font.size * block.font.lineHeight;
  const width = lines.reduce((widest, line) => Math.max(widest, line.width), 0);
  return { lines, lineHeight, width, height: lines.length * lineHeight };
}
