import { localBox } from '@planewright/engine';
import type { Element } from '@planewright/engine';

import { KIND_NAMES } from './names.ts';
import { decimal, normalizedDegrees } from './rounding.ts';

// How the element list names an element (docs/architecture/engine/quality.md#accessibility,
// REQ-Y05): by its kind, a text's words, its size and its position in scene units, and how far it
// is turned, as in "Rectangle, 120 by 100, at 300, 180". A row of the list shows the same words and
// figures, shorter: "Rectangle" and "120 × 100 · 300, 180" (the v0.2 plan's S5). Both round as the
// selection's figures do (rounding.ts).

/** The most of a text's words that a name holds. */
const TEXT_LENGTH = 40;

const SPACE = /\s/u;

/**
 * A text's words on one line, white space between them made one space and none at either end,
 * cut after 40 characters with an ellipsis. The text is read only until the cut, so that a name
 * costs the same for a text of 100,000 characters as for a short one (ENG-15, C2).
 */
function wordsOf(text: string): string {
  let words = '';
  let spaced = false;
  for (const character of text) {
    if (SPACE.test(character)) {
      spaced = words !== '';
      continue;
    }
    words += spaced ? ` ${character}` : character;
    spaced = false;
    if (words.length > TEXT_LENGTH) return `${words.slice(0, TEXT_LENGTH)}…`;
  }
  return words;
}

/** The kind, and for a text its words on one line, cut after 40 characters. */
function kindOf(element: Element): string {
  return element.kind === 'text'
    ? `Text “${wordsOf(element.content.text)}”`
    : KIND_NAMES[element.kind];
}

/** The turn in degrees from 0 to 360 to a tenth, or null when it rounds to none. */
function degreesOf(rotation: number): number | null {
  const degrees = normalizedDegrees(rotation);
  return degrees === 0 ? null : degrees;
}

/** The turn in degrees, or nothing when it rounds to none. */
function turnOf(rotation: number): string[] {
  const degrees = degreesOf(rotation);
  return degrees === null ? [] : [`turned ${decimal(degrees)} degrees`];
}

/** The element's name: its kind, its unrotated box's size and top-left corner, and its turn. */
export function elementName(element: Element): string {
  const { x, y, width, height } = localBox(element);
  return [
    kindOf(element),
    `${decimal(width)} by ${decimal(height)}`,
    `at ${decimal(x)}, ${decimal(y)}`,
    ...turnOf(element.rotation),
  ].join(', ');
}

/** What a row of the element list shows beside its kind's glyph. */
export interface ElementRow {
  /** The kind's name, or a text's words in quotation marks, cut as its name cuts them. */
  readonly label: string;
  /** The size, the top-left corner and the turn, as "120 × 100 · 300, 180 · 45°". */
  readonly metadata: string;
}

/** A row's words and figures, each of which its element's name also says (WCAG 2.5.3). */
export function elementRow(element: Element): ElementRow {
  const { x, y, width, height } = localBox(element);
  const words = element.kind === 'text' ? wordsOf(element.content.text) : '';
  const degrees = degreesOf(element.rotation);
  return {
    label: words === '' ? KIND_NAMES[element.kind] : `“${words}”`,
    metadata: [
      `${decimal(width)} × ${decimal(height)}`,
      `${decimal(x)}, ${decimal(y)}`,
      ...(degrees === null ? [] : [`${decimal(degrees)}°`]),
    ].join(' · '),
  };
}
