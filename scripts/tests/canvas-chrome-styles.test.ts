import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet, tokenValues } from './style-sheets.ts';

// The canvas's chrome's style sheet (ADR 0012, decisions 5 and 14; the v0.2 plan's S10, issue
// #77's D11 and D12): bundled from main.tsx right after the text-editing chrome's, with no media
// query (media-queries.test.ts), no motion, which motion.css holds since S12 and which never moves
// this chrome, no filter, blur, :has() or :focus-within, and only the chrome's tokens, besides the
// safe-area insets that shell.css reads.

const SHEET = styleSheet('canvas-chrome.css');
const MAIN = readFileSync(
  join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'main.tsx'),
  'utf8',
);

/** The custom properties that the sheet may read besides the tokens. */
const OUTSIDE_TOKENS = /^--shell-safe-(?:top|right|bottom|left)$/u;

/** The declarations of the sheet's rules, each with its selector. */
const declarations = () =>
  rulesOf(SHEET).flatMap(({ selector, body }) =>
    declarationsOf(body).map((declaration) => ({ selector, ...declaration })),
  );

describe("the canvas's chrome's style sheet", () => {
  it('is imported from main.tsx among the bundled style sheets, right after the text-editing chrome’s', () => {
    expect(MAIN).toMatch(/^import '\.\/styles\/canvas-chrome\.css';$/mu);
    const sheets = [...MAIN.matchAll(/^import '\.\/styles\/([a-z-]+)\.css';$/gmu)].map(
      ([, name]) => name,
    );
    expect(sheets.indexOf('canvas-chrome')).toBe(sheets.indexOf('text-session') + 1);
  });

  it('A14 sets no transition, animation, filter or backdrop filter, and uses no blur, :has(), :focus-within or :focus', () => {
    const properties = declarations().map(({ property }) => property);
    expect(properties.length).toBeGreaterThan(15);
    expect(
      properties.filter((property) =>
        /^(transition|animation|backdrop-filter|filter)/u.test(property),
      ),
    ).toEqual([]);
    expect(SHEET).not.toMatch(/@keyframes|blur\(|:has\(|:focus-within|:focus(?!-visible)/u);
  });

  it('reads only custom properties that tokens.css declares and the safe-area insets', () => {
    const tokens = tokenValues();
    const used = [...SHEET.matchAll(/var\((--[a-z0-9-]+)/gu)].map(([, name]) => name ?? '');
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((name) => !tokens.has(name) && !OUTSIDE_TOKENS.test(name))).toEqual([]);
  });

  it('D1 D3 A14 draws the ring through .canvas-host:focus-visible ~ alone, the host drawing no outline of its own', () => {
    const rules = rulesOf(SHEET);
    const rule = (selector: string) =>
      declarationsOf(rules.find((each) => each.selector === selector)?.body ?? '');
    expect(rule('.canvas-host:focus-visible')).toEqual([
      { property: 'outline', value: 'none' },
      { property: 'box-shadow', value: 'none' },
    ]);
    expect(
      rules.filter(({ body }) => body.includes('display: block')).map(({ selector }) => selector),
    ).toEqual(['.canvas-host:focus-visible ~ .canvas-focus-ring']);
    expect(rule('.canvas-focus-ring')).toEqual(
      expect.arrayContaining([
        {
          property: 'inset',
          value:
            'var(--shell-safe-top) var(--shell-safe-right) var(--shell-safe-bottom) var(--shell-safe-left)',
        },
        { property: 'z-index', value: 'var(--pw-layer-hint)' },
        { property: 'display', value: 'none' },
        { property: 'outline', value: '2px solid var(--pw-color-focus-ring)' },
        { property: 'outline-offset', value: '-2px' },
        { property: 'box-shadow', value: 'inset 0 0 0 4px var(--pw-color-focus-halo)' },
        { property: 'pointer-events', value: 'none' },
      ]),
    );
  });

  it('D6 lays the hint out of the flow, in the tools area, on the hint layer, letting presses through', () => {
    const hint = Object.fromEntries(
      declarations()
        .filter(({ selector }) => selector === '.tool-hint')
        .map(({ property, value }) => [property, value]),
    );
    expect(hint).toMatchObject({
      position: 'absolute',
      'grid-area': 'tools',
      'z-index': 'var(--pw-layer-hint)',
      color: 'var(--pw-color-on-surface-muted)',
      background: 'var(--pw-color-surface)',
      font: 'var(--pw-type-caption)',
      'pointer-events': 'none',
      'white-space': 'nowrap',
    });
  });
});
