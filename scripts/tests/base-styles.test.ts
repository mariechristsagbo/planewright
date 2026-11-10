import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet } from './style-sheets.ts';
import type { Declaration } from './style-sheets.ts';

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

/** The properties other than font-weight whose value can set a weight: a bold in any other is none. */
const WEIGHT_CARRIERS = /^(font|font-variation-settings|--pw-type-.+)$/u;

/** Whether a declaration sets a weight but 400 or 500, or a bold. */
const setsAnotherWeight = ({ property, value }: Declaration): boolean =>
  property === 'font-weight'
    ? !['400', '500'].includes(value)
    : WEIGHT_CARRIERS.test(property) && /\b(bold|bolder|[6-9]00)\b/u.test(value);

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
    expect(everyDeclaration().filter(setsAnotherWeight)).toEqual([]);
  });

  it('read a bold only in the properties that set a weight, so that a layer or an order is no bold', () => {
    const planted: Declaration[] = [
      { property: 'z-index', value: '700' },
      { property: 'order', value: '600' },
      { property: 'font', value: '700 16px/1.5 var(--pw-font-ui)' },
      { property: 'font-weight', value: '600' },
      { property: 'font-variation-settings', value: "'wght' 800" },
      { property: '--pw-type-title-md', value: 'bold 16px/22px var(--pw-font-ui)' },
    ];
    expect(planted.filter(setsAnotherWeight).map(({ property }) => property)).toEqual([
      'font',
      'font-weight',
      'font-variation-settings',
      '--pw-type-title-md',
    ]);
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
