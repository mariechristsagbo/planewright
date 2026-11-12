import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet, tokenValues } from './style-sheets.ts';

// The text-editing chrome's style sheet (ADR 0012, decisions 5 and 14; the v0.2 plan's S9, issue
// #75's D14): bundled from main.tsx after the dock's, with no media query (media-queries.test.ts),
// no motion, which is S12's, no filter, blur or :has(), and only the chrome's tokens, besides the
// safe-area insets that shell.css reads and the keyboard's inset that the Done bar sets at run time.

const SHEET = styleSheet('text-session.css');
const MAIN = readFileSync(
  join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'main.tsx'),
  'utf8',
);

/** The custom properties that the sheet may read besides the tokens. */
const OUTSIDE_TOKENS = /^--(?:shell-safe-(?:top|right|bottom|left)|kb)$/u;

describe("the text-editing chrome's style sheet", () => {
  it('is imported from main.tsx among the bundled style sheets, right after the dock’s', () => {
    expect(MAIN).toMatch(/^import '\.\/styles\/text-session\.css';$/mu);
    const sheets = [...MAIN.matchAll(/^import '\.\/styles\/([a-z-]+)\.css';$/gmu)].map(
      ([, name]) => name,
    );
    expect(sheets.indexOf('text-session')).toBe(sheets.indexOf('dock') + 1);
  });

  it('sets no transition, animation, filter or backdrop filter, no blur and no :has()', () => {
    const properties = rulesOf(SHEET).flatMap(({ body }) =>
      declarationsOf(body).map(({ property }) => property),
    );
    expect(properties.length).toBeGreaterThan(15);
    expect(
      properties.filter((property) =>
        /^(transition|animation|backdrop-filter|filter)/u.test(property),
      ),
    ).toEqual([]);
    expect(SHEET).not.toMatch(/@keyframes|blur\(|:has\(/u);
  });

  it('reads only custom properties that tokens.css declares, the safe-area insets and --kb', () => {
    const tokens = tokenValues();
    const used = [...SHEET.matchAll(/var\((--[a-z0-9-]+)/gu)].map(([, name]) => name ?? '');
    expect(used.length).toBeGreaterThan(10);
    expect(used.filter((name) => !tokens.has(name) && !OUTSIDE_TOKENS.test(name))).toEqual([]);
    // --kb is set on the bar at run time, never declared in a style sheet, nor a token.
    expect(declaredKb()).toEqual([]);
    expect(tokens.has('--kb')).toBe(false);
  });
});

/** The rules of every bundled style sheet that declare --kb. */
function declaredKb(): string[] {
  const names = [...MAIN.matchAll(/^import '\.\/styles\/([a-z-]+)\.css';$/gmu)].map(
    ([, name]) => name ?? '',
  );
  return [...names, 'responsive'].flatMap((name) =>
    rulesOf(styleSheet(`${name}.css`))
      .filter(({ body }) => declarationsOf(body).some(({ property }) => property === '--kb'))
      .map(({ selector }) => `${name}.css ${selector}`),
  );
}
