import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, rulesOf, styleSheet } from './style-sheets.ts';

// Saving's chrome in the style sheets (ADR 0012, decisions 3, 12 and 14; the v0.2 plan's S7):
// data-save-state exists for the tests alone, so no style sheet under apps/web/src selects it and
// no production code reads it, EditorShell.tsx writing it once; and saving.css takes its colours,
// type, radii, spacing and shadows from the tokens alone, with no motion and no blur.

const SOURCES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src');
const FILES = readdirSync(SOURCES, { recursive: true, encoding: 'utf8' })
  .map((path) => path.split(sep).join('/'))
  .sort();
const read = (path: string): string => readFileSync(join(SOURCES, path), 'utf8');
const plain = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');

describe('data-save-state', () => {
  it('D9 is selected by no style sheet under apps/web/src', () => {
    const sheets = FILES.filter((path) => path.endsWith('.css'));
    expect(sheets).toContain('styles/saving.css');
    expect(sheets.filter((path) => /save-state|saveState/iu.test(plain(read(path))))).toEqual([]);
  });

  it('D2 is written by EditorShell.tsx alone, once, and read by no production code', () => {
    const code = FILES.filter((path) => /\.tsx?$/u.test(path));
    const readers = code.filter((path) =>
      /\[data-save-state|dataset\.saveState|Attribute\(\s*'data-save-state'/u.test(read(path)),
    );
    expect(readers).toEqual([]);
    const writers = code.filter((path) => read(path).includes('data-save-state='));
    expect(writers).toEqual(['shell/EditorShell.tsx']);
    expect(
      read('shell/EditorShell.tsx').match(/data-save-state=\{saveStateOf\(save\)\}/gu),
    ).toHaveLength(1);
  });
});

/** The properties whose every value in saving.css is one token. */
const TOKENISED =
  /^(color|background|box-shadow|font|letter-spacing|border-radius|gap|padding|min-height|min-width)$/u;

describe('saving.css', () => {
  it('D9 holds no colour of its own, no motion, no blur and no weight', () => {
    const css = plain(styleSheet('saving.css'));
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/iu);
    expect(css).not.toMatch(/transition|animation|backdrop-filter|font-weight|@media/iu);
  });

  it('D9 takes its colours, type, radii, spacing and shadows from the tokens', () => {
    const values = rulesOf(styleSheet('saving.css'))
      .flatMap(({ body }) => declarationsOf(body))
      .filter(({ property }) => TOKENISED.test(property));
    expect(values.length).toBeGreaterThan(20);
    expect(
      values.filter(
        ({ value }) => !/^var\(--pw-[a-z\d-]+\)( var\(--pw-[a-z\d-]+\))?$/u.test(value),
      ),
    ).toEqual([]);
  });

  it('D9 leaves the landscape chip and the touch targets to responsive.css, with no motion', () => {
    const css = plain(styleSheet('responsive.css'));
    expect(css).toMatch(/\.problem-chip-words \{[^}]*clip-path: inset\(50%\)/u);
    expect(css).not.toMatch(/\.problem-chip-words \{[^}]*display: none/u);
    expect(css).not.toMatch(/transition|animation|backdrop-filter/iu);
  });
});
