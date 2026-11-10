import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { styleSheet } from './style-sheets.ts';

// Where the web app's media queries live (ADR 0012, decision 14, and the v0.2 plan's S2): Chromium
// recreates every font face that a style sheet declares when that style sheet's media queries
// change their result, so a resize across a breakpoint would load the canvas's faces again and
// measure every text again. responsive.css, which main.tsx adds as a style element of its own,
// holds them all, and no @font-face; the other sheets, bundled with fonts.css, hold none.

const SOURCES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src');
const SHEETS = readdirSync(join(SOURCES, 'styles'));
const MAIN = readFileSync(join(SOURCES, 'main.tsx'), 'utf8');

const plain = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');

describe("the web app's media queries", () => {
  it('are all in responsive.css, which declares no font', () => {
    const withMedia = SHEETS.filter((sheet) => /@media\b/u.test(plain(styleSheet(sheet))));
    expect(withMedia).toEqual(['responsive.css']);
    expect(plain(styleSheet('responsive.css'))).not.toMatch(/@font-face|@import/u);
  });

  it('reach the page as a style element of their own, last in the cascade', () => {
    expect(MAIN).toMatch(/^import responsive from '\.\/styles\/responsive\.css\?inline';$/mu);
    expect(MAIN).not.toMatch(/^import '\.\/styles\/responsive\.css';$/mu);
    const lastSheet = MAIN.lastIndexOf("import './styles/");
    expect(MAIN.indexOf('responsive.css?inline')).toBeGreaterThan(lastSheet);
    expect(MAIN).toMatch(/media\.textContent = responsive;\s*document\.head\.append\(media\);/u);
  });
});
