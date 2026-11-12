import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet } from './style-sheets.ts';
import type { Declaration } from './style-sheets.ts';

// The web app's base styles (ADR 0012, decisions 5 and 8, and the v0.2 plan's S1): base.css gives
// the root its theme and type, and puts every element rule inside :where(), at no specificity, so
// that a rule with a single class always wins over it; 500 is the only emphasis weight. Its
// pressed, unavailable and focus-visible rules, the selected row and the text area take the
// tokens' state colours (the v0.2 plan's S10, issue #77's D9), and no style sheet keeps P0's.

const SHEETS = readdirSync(join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'styles'));

/** Every style sheet under apps/web/src, those beside a component included. */
const SOURCES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src');
const EVERY_SHEET = readdirSync(SOURCES, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css'))
  .map((path) => path.split(sep).join('/'));

/** The declarations of the rule of a style sheet with this exact selector. */
const ruleOf = (sheet: string, selector: string): Declaration[] =>
  declarationsOf(rulesOf(styleSheet(sheet)).find((rule) => rule.selector === selector)?.body ?? '');

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

  it('A11 D9 give the pressed, unavailable and focus-visible rules the tokens’ state colours alone', () => {
    expect(ruleOf('base.css', ":where(button[aria-pressed='true'])")).toEqual([
      { property: 'color', value: 'var(--pw-color-on-primary-container)' },
      { property: 'background', value: 'var(--pw-color-primary-container)' },
      { property: 'border-color', value: 'var(--pw-color-primary)' },
    ]);
    expect(ruleOf('base.css', ":where(button:disabled, button[aria-disabled='true'])")).toEqual([
      { property: 'color', value: 'var(--pw-color-disabled-content)' },
      { property: 'border-style', value: 'dashed' },
    ]);
    expect(ruleOf('base.css', ':where(:is(button, a, summary, [tabindex]):focus-visible)')).toEqual(
      [
        { property: 'outline', value: '2px solid var(--pw-color-focus-ring)' },
        { property: 'outline-offset', value: '2px' },
        { property: 'box-shadow', value: '0 0 0 2px var(--pw-color-focus-halo)' },
      ],
    );
  });

  it('A11 D9 give the selected row the container’s colours and the text area the focus ring’s', () => {
    expect(ruleOf('element-list.css', ".element-option[aria-selected='true']")).toEqual([
      { property: 'color', value: 'var(--pw-color-on-primary-container)' },
      { property: 'background', value: 'var(--pw-color-primary-container)' },
    ]);
    expect(ruleOf('canvas.css', '.text-editor')).toContainEqual({
      property: 'outline',
      value: '2px solid var(--pw-color-focus-ring)',
    });
  });

  it('A11 D9 leave no style sheet under apps/web/src with P0’s blue or grey', () => {
    expect(EVERY_SHEET).toContain('styles/base.css');
    const old = EVERY_SHEET.filter((path) =>
      /#2a62d0|#4b5563/iu.test(readFileSync(join(SOURCES, path), 'utf8')),
    );
    expect(old).toEqual([]);
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
