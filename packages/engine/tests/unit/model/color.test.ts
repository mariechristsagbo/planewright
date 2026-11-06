import { describe, expect, expectTypeOf, it } from 'vitest';

import { isColor, toColor } from '../../../src/model/color.ts';
import type { Color } from '../../../src/model/color.ts';
import { randomText } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

describe('colours', () => {
  it.each(['#1e2430', '#ffffff', '#000000', '#1e243080', '#00000000'])(
    'accept the lower-case sRGB form %s',
    (text) => {
      expect(isColor(text)).toBe(true);
      expect(toColor(text)).toBe(text);
    },
  );

  it.each([
    ['upper case', '#FFFFFF'],
    ['three digits', '#fff'],
    ['four digits', '#ffff'],
    ['seven digits', '#fffffff'],
    ['nine digits', '#fffffffff'],
    ['no hash', 'ffffff'],
    ['a name', 'red'],
    ['a function', 'rgb(0, 0, 0)'],
    ['a letter beyond f', '#fffffg'],
    ['a trailing line break', '#ffffff\n'],
    ['the empty string', ''],
  ])('refuse %s', (_, text) => {
    expect(isColor(text)).toBe(false);
    expect(() => toColor(text)).toThrow(
      new RangeError(
        `${JSON.stringify(text)} is not a colour: write #rrggbb or #rrggbbaa in lower case.`,
      ),
    );
  });

  it('accept a generated hash and hex string exactly when it has 6 or 8 digits', () => {
    checkProperty(
      { seed: 0xc010 },
      (random) => `#${randomText(random, '0123456789abcdef', Math.floor(random.next() * 11))}`,
      (text) => {
        expect(isColor(text)).toBe(text.length === 7 || text.length === 9);
      },
    );
  });

  it('are branded, so a plain string is not a colour', () => {
    expectTypeOf<Color>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<Color>();
    expectTypeOf(toColor('#ffffff')).toEqualTypeOf<Color>();
  });
});
