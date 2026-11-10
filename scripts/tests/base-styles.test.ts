import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet } from './style-sheets.ts';

// The web app's base styles (ADR 0012, decisions 5 and 8, and the v0.2 plan's S1): base.css gives
// the root its theme and type, and puts every element rule inside :where(), at no specificity, so
// that a rule with a single class always wins over it; 500 is the only emphasis weight.

const SHEETS = readdirSync(join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'styles'));

/** Each declaration of every style sheet, with its sheet and selector. */
const everyDeclaration = () =>
  SHEETS.flatMap((sheet) =>
    rulesOf(styleSheet(sheet)).flatMap(({ selector, body }) =>
      declarationsOf(body).map((declaration) => ({ sheet, selector, ...declaration })),
    ),
  );

describe("the web app's base styles", () => {
  const selectors = rulesOf(styleSheet('base.css')).map(({ selector }) => selector);

  it('style the root first', () => {
    expect(selectors[0]).toBe(':root');
  });

  it('put every element rule inside :where()', () => {
    const elements = selectors.slice(1);
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.filter((selector) => !/^:where\(.*\)$/su.test(selector))).toEqual([]);
  });

  it('give strong, b, h1 to h3 and th the one emphasis weight, 500', () => {
    const rule = rulesOf(styleSheet('base.css')).find(
      ({ selector }) => selector === ':where(strong, b, h1, h2, h3, th)',
    );
    expect(declarationsOf(rule?.body ?? '')).toEqual([{ property: 'font-weight', value: '500' }]);
  });

  it('leave no style sheet a weight but 400 and 500, nor a bold', () => {
    const weights = everyDeclaration().filter(({ property, value }) =>
      property === 'font-weight'
        ? !['400', '500'].includes(value)
        : /\b(bold|bolder|[6-9]00)\b/u.test(value),
    );
    expect(weights).toEqual([]);
  });

  it('keep the text area at 400', () => {
    const area = rulesOf(styleSheet('canvas.css')).find(
      ({ selector }) => selector === '.text-editor',
    );
    expect(declarationsOf(area?.body ?? '')).toContainEqual({
      property: 'font-weight',
      value: '400',
    });
  });
});
