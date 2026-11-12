import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet, tokenValues } from './style-sheets.ts';

// The selection panel's style sheet (ADR 0012, decisions 5 and 14; the v0.2 plan's S6, issue #69's
// D5): bundled from main.tsx with the others, with no media query (media-queries.test.ts), no
// motion, which motion.css holds since S12 (motion-styles.test.ts), no blur, and only the chrome's
// tokens.

const SHEET = styleSheet('selection.css');
const MAIN = readFileSync(
  join(import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'main.tsx'),
  'utf8',
);

describe("the selection panel's style sheet", () => {
  it('is imported from main.tsx among the bundled style sheets, after the drawer’s', () => {
    expect(MAIN).toMatch(/^import '\.\/styles\/selection\.css';$/mu);
    expect(MAIN.indexOf("'./styles/selection.css'")).toBeGreaterThan(
      MAIN.indexOf("'./styles/drawer.css'"),
    );
  });

  it('sets no transition, animation, backdrop filter or blur', () => {
    const properties = rulesOf(SHEET).flatMap(({ body }) =>
      declarationsOf(body).map(({ property }) => property),
    );
    expect(properties.length).toBeGreaterThan(40);
    expect(
      properties.filter((property) =>
        /^(transition|animation|backdrop-filter|filter)/u.test(property),
      ),
    ).toEqual([]);
    expect(SHEET).not.toMatch(/@keyframes|blur\(/u);
  });

  it('reads only custom properties that tokens.css declares', () => {
    const tokens = tokenValues();
    const used = [...SHEET.matchAll(/var\((--[a-z0-9-]+)/gu)].map(([, name]) => name ?? '');
    expect(used.length).toBeGreaterThan(20);
    expect(used.filter((name) => !tokens.has(name))).toEqual([]);
  });
});
