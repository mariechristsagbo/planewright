import type { TextElement } from '../../src/model/elements.ts';
import type { Placement } from './elements.ts';
import { textElement } from './elements.ts';

// Texts with a given font size, for the font-limit tests of the ENG-10 review's M1.

/** A 120 × 30 text whose font has the given size. */
export function textWithFont(size: number, placement: Placement = {}): TextElement {
  const text = textElement(120, 30, placement);
  return { ...text, content: { ...text.content, font: { ...text.content.font, size } } };
}

/** The font size of an element that a test expects to be a text. */
export function fontSizeOf(element: unknown): number {
  const { kind, content } = element as Partial<TextElement>;
  if (kind !== 'text' || content === undefined) throw new Error('The element is not a text.');
  return content.font.size;
}
