import { describe, expect, it } from 'vitest';

import { INITIAL_DEFAULT_STYLE, styleForKind } from '../../../src/model/defaults.ts';
import { ELEMENT_KINDS } from '../../../src/model/elements.ts';
import type { Style } from '../../../src/model/style.ts';

describe('the initial default style', () => {
  it("REQ-C12 holds Planewright's own values", () => {
    expect(INITIAL_DEFAULT_STYLE).toStrictEqual({
      stroke: { color: '#1e2430', width: 2, dash: 'solid' },
      fill: null,
      opacity: 1,
      corners: 'round',
      sketch: 0,
    });
  });
});

describe('styleForKind', () => {
  it.each(['rectangle', 'diamond'] as const)(
    'REQ-C12 gives a new %s the default corners',
    (kind) => {
      expect(styleForKind(INITIAL_DEFAULT_STYLE, kind)).toBe(INITIAL_DEFAULT_STYLE);
    },
  );

  it.each(ELEMENT_KINDS.filter((kind) => kind !== 'rectangle' && kind !== 'diamond'))(
    'REQ-C12 gives a new %s the default style with sharp corners',
    (kind) => {
      expect(styleForKind(INITIAL_DEFAULT_STYLE, kind)).toStrictEqual({
        ...INITIAL_DEFAULT_STYLE,
        corners: 'sharp',
      });
    },
  );

  it('follows a changed default style and leaves it unchanged', () => {
    const defaults: Style = { ...INITIAL_DEFAULT_STYLE, corners: 'sharp', opacity: 0.5 };
    const copy: Style = { ...defaults, stroke: { ...defaults.stroke } };
    expect(styleForKind(defaults, 'rectangle')).toStrictEqual(copy);
    expect(styleForKind(defaults, 'ellipse')).toStrictEqual(copy);
    expect(defaults).toStrictEqual(copy);
  });
});
