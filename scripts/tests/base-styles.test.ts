import { describe, expect, it } from 'vitest';

import { rulesOf, styleSheet } from './style-sheets.ts';

// The web app's base styles (ADR 0012, decision 5, and the v0.2 plan's S1): base.css gives the
// root its theme and type, and puts every element rule inside :where(), at no specificity, so that
// a rule with a single class always wins over it.

describe('the base styles in base.css', () => {
  const selectors = rulesOf(styleSheet('base.css')).map(({ selector }) => selector);

  it('style the root first', () => {
    expect(selectors[0]).toBe(':root');
  });

  it('put every element rule inside :where()', () => {
    const elements = selectors.slice(1);
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.filter((selector) => !/^:where\(.*\)$/su.test(selector))).toEqual([]);
  });
});
