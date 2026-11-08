import { describe, expect, it } from 'vitest';

import { canvasFont, FONT_STACKS } from '../../src/fonts.ts';

// The fonts behind the three families (ADR 0011): the bundled face first, then the generic family
// that stands in until it loads or for the characters it lacks.

describe('the font families', () => {
  it('name the bundled face of each family before its generic fallback', () => {
    expect(FONT_STACKS).toEqual({
      sans: '"Planewright Sans", sans-serif',
      hand: '"Planewright Hand", cursive',
      mono: '"Planewright Mono", monospace',
    });
  });

  it('give a 2D context the font of a spec at its size in scene units', () => {
    expect(canvasFont({ family: 'sans', size: 20, lineHeight: 1.25 })).toBe(
      '20px "Planewright Sans", sans-serif',
    );
    expect(canvasFont({ family: 'hand', size: 12.5, lineHeight: 1 })).toBe(
      '12.5px "Planewright Hand", cursive',
    );
    expect(canvasFont({ family: 'mono', size: 1000, lineHeight: 3 })).toBe(
      '1000px "Planewright Mono", monospace',
    );
  });
});
