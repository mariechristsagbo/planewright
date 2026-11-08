import { describe, expect, it } from 'vitest';

import { resizeElements } from '../../../src/transform/resize-many.ts';
import { resizeElement } from '../../../src/transform/resize.ts';
import { shapeElement } from '../../support/elements.ts';
import { fontSizeOf, textWithFont } from '../../support/text-fonts.ts';

// A text's font size stops exactly at the document's limits, 1 and 1000 (the ENG-10 review's M1):
// the ratio limits come from divisions, so multiplying back by the font size could land one
// rounding step outside them, which the scene store refuses.

const FREE = { keepAspect: false, fromCenter: false };

describe('the font size at the limits of a resize', () => {
  it('REQ-T05 a font-21 text shrunk past its floor stops at font size 1', () => {
    const after = resizeElement(textWithFont(21), {
      handle: 'se',
      drag: { x: -1e5, y: -1e5 },
      options: FREE,
    });
    expect(fontSizeOf(after)).toBe(1);
  });

  it('a font-15 text grown past its ceiling stops at font size 1000', () => {
    const after = resizeElement(textWithFont(15), {
      handle: 'se',
      drag: { x: 1e7, y: 1e7 },
      options: FREE,
    });
    expect(fontSizeOf(after)).toBe(1_000);
  });

  it('REQ-T05 a font-24 text beside a rectangle, shrunk past the floor, stops at font size 1', () => {
    const [text] = resizeElements(
      [textWithFont(24), shapeElement('rectangle', 50, 50, { x: 200 })],
      { x: 0, y: 0, width: 250, height: 50 },
      { handle: 'se', drag: { x: -1e5, y: -1e5 }, options: FREE },
    );
    expect(fontSizeOf(text)).toBe(1);
  });
});
