import { describe, expect, it } from 'vitest';

import type { TextMeasurer } from '../../../src/geometry/text-measurer.ts';
import { layoutText } from '../../../src/geometry/text-layout.ts';
import type { FontSpec, TextBlock } from '../../../src/model/style.ts';
import { createFixedAdvanceMeasurer } from '../../support/fakes.ts';

const FONT: FontSpec = { family: 'sans', size: 20, lineHeight: 1.25 };
const block = (text: string, font: FontSpec = FONT): TextBlock => ({ text, font, align: 'left' });
const measurer = createFixedAdvanceMeasurer(10);
const texts = (text: string, maxWidth?: number): string[] =>
  layoutText(block(text), measurer, maxWidth).lines.map((line) => line.text);

describe('text layout without a maximum width (P0 texts)', () => {
  it('splits at line breaks; the block is as wide as its widest line and a line height per line', () => {
    expect(layoutText(block('Hello\nworld!'), measurer)).toStrictEqual({
      lines: [
        { text: 'Hello', width: 50 },
        { text: 'world!', width: 60 },
      ],
      lineHeight: 25,
      width: 60,
      height: 50,
    });
  });

  it('gives an empty text one empty line', () => {
    expect(layoutText(block(''), measurer)).toStrictEqual({
      lines: [{ text: '', width: 0 }],
      lineHeight: 25,
      width: 0,
      height: 25,
    });
  });

  it('measures each line through the port in the block font and never wraps', () => {
    const asked: [string, FontSpec][] = [];
    const recording: TextMeasurer = {
      measure: (text, font) => {
        asked.push([text, font]);
        return { width: 1000, ascent: 0, descent: 0 };
      },
    };
    const mono: FontSpec = { family: 'mono', size: 40, lineHeight: 2 };
    const layout = layoutText(block('a long line that stays whole\nb', mono), recording);
    expect(asked).toStrictEqual([
      ['a long line that stays whole', mono],
      ['b', mono],
    ]);
    expect([layout.lineHeight, layout.width, layout.height]).toStrictEqual([80, 1000, 160]);
  });
});

describe('text layout with a maximum width (P1 labels and notes)', () => {
  it('wraps at spaces, keeping as many words on a line as fit', () => {
    expect(texts('the quick brown fox', 100)).toStrictEqual(['the quick', 'brown fox']);
    expect(texts('one two\nthree four', 70)).toStrictEqual(['one two', 'three', 'four']);
    expect(texts('a  b', 100)).toStrictEqual(['a  b']);
  });

  it('breaks a word only when it is wider than the line, by code points', () => {
    expect(texts('a supercalifragilistic b', 60)).toStrictEqual([
      'a',
      'superc',
      'alifra',
      'gilist',
      'ic b',
    ]);
    expect(texts('😀😀', 10)).toStrictEqual(['😀', '😀']);
    expect(texts('ab', 0)).toStrictEqual(['a', 'b']);
    expect(texts('the quick brown fox', Infinity)).toStrictEqual(['the quick brown fox']);
  });

  it('refuses a maximum width that is negative or not a number', () => {
    expect(() => layoutText(block('a'), measurer, -1)).toThrow(RangeError);
    expect(() => layoutText(block('a'), measurer, Number.NaN)).toThrow(
      'A maximum text width must be 0 or more, not NaN.',
    );
  });
});

describe('text layout through a faulty measurer', () => {
  it('refuses a width that is negative or not finite', () => {
    for (const width of [-1, Number.NaN, Infinity]) {
      const faulty: TextMeasurer = { measure: () => ({ width, ascent: 0, descent: 0 }) };
      expect(() => layoutText(block('a'), faulty)).toThrow(
        `The text measurer gave the width ${String(width)}; a width must be finite and not negative.`,
      );
    }
  });
});
