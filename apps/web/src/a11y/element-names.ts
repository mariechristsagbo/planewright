import { localBox } from '@planewright/engine';
import type { Element } from '@planewright/engine';

import { KIND_NAMES } from './names.ts';

// How the element list names an element (docs/architecture/engine/quality.md#accessibility,
// REQ-Y05): by its kind, a text's words, its size and its position in scene units, and how far it
// is turned, as in "Rectangle, 120 by 100, at 300, 180".

/** The most of a text's words that a name holds. */
const TEXT_LENGTH = 40;

/** One decimal place, and never "-0". */
const decimal = (value: number): string => String(Math.round(value * 10) / 10 + 0);

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

/** The turn in degrees from 0 to 360, or nothing when it rounds to none. */
function turnOf(rotation: number): string[] {
  const degrees = Math.round((((((rotation * 180) / Math.PI) % 360) + 360) % 360) * 10) / 10;
  return degrees === 0 || degrees === 360 ? [] : [`turned ${decimal(degrees)} degrees`];
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
