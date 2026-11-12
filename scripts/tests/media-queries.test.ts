import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { styleSheet } from './style-sheets.ts';

// Where the web app's media queries live (ADR 0012, decision 14, and the v0.2 plan's S2): Chromium
// recreates every font face that a style sheet declares when that style sheet's media queries
// change their result, so a resize across a breakpoint would load the canvas's faces again and
// measure every text again. responsive.css, which main.tsx adds as a style element of its own,
// holds them all, and no @font-face; every other sheet under apps/web/src, those in styles/ and
// any beside a component (issue #55's D8), is bundled with fonts.css and holds none.

const SOURCES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src');
const SHEETS = readdirSync(SOURCES, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css'))
  .map((path) => path.split(sep).join('/'))
  .sort();
const MAIN = readFileSync(join(SOURCES, 'main.tsx'), 'utf8');

const plain = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');

/** The phone sheet's query, as shell/sheet.ts exports it. */
const sheetQuery = (): string | undefined =>
  /^export const SHEET_QUERY = '(?<query>[^']+)';$/mu.exec(
    readFileSync(join(SOURCES, 'shell', 'sheet.ts'), 'utf8'),
  )?.groups?.['query'];

/** The rows of each grid-template-areas in a block, each row's area names as written. */
const areaRows = (body: string): string[][] =>
  [...body.matchAll(/grid-template-areas:([^;]+);/gu)].map((match) =>
    [...(match[1] ?? '').matchAll(/'([^']+)'/gu)].map((row) => row[1] ?? ''),
  );

/** A style sheet's @media blocks, each query with the rules inside it. */
function mediaBlocks(css: string): { query: string; body: string }[] {
  const text = plain(css);
  const blocks: { query: string; body: string }[] = [];
  for (let at = text.indexOf('@media '); at >= 0; at = text.indexOf('@media ', at + 1)) {
    const open = text.indexOf('{', at);
    let depth = 1;
    let end = open + 1;
    for (; depth > 0 && end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      if (text[end] === '}') depth -= 1;
    }
    blocks.push({
      query: text.slice(at + '@media '.length, open).trim(),
      body: text.slice(open, end),
    });
  }
  return blocks;
}

/** Phones, in portrait and in landscape: the query under which the view readout is hidden. */
const PHONES = '(max-width: 599px), (max-height: 499px)';

/** Compact and at least 500 px high, where the tool hint owns a row (issue #77's D7). */
const HINT_ROW = '(min-width: 600px) and (max-width: 1199px) and (min-height: 500px)';

/** The selectors that responsive.css's blocks under a query hide with display: none. */
const hiddenUnder = (query: string): string[] =>
  mediaBlocks(styleSheet('responsive.css'))
    .filter((block) => block.query === query)
    .flatMap(({ body }) => [...body.matchAll(/([^{}]+)\{([^{}]*)\}/gu)])
    .filter(([, , declarations = '']) => /\bdisplay: none;/u.test(declarations))
    .flatMap(([, selectors = '']) => selectors.split(',').map((selector) => selector.trim()));

describe("the web app's media queries", () => {
  it('are all in responsive.css, which declares no font, among every style sheet under apps/web/src', () => {
    expect(SHEETS).toContain('styles/fonts.css');
    const withMedia = SHEETS.filter((path) =>
      /@media\b/u.test(plain(readFileSync(join(SOURCES, path), 'utf8'))),
    );
    expect(withMedia).toEqual(['styles/responsive.css']);
    expect(plain(styleSheet('responsive.css'))).not.toMatch(/@font-face|@import/u);
  });

  it('reach the page as a style element of their own, last in the cascade', () => {
    expect(MAIN).toMatch(/^import responsive from '\.\/styles\/responsive\.css\?inline';$/mu);
    expect(MAIN).not.toMatch(/^import '\.\/styles\/responsive\.css';$/mu);
    const lastSheet = MAIN.lastIndexOf("import './styles/");
    expect(MAIN.indexOf('responsive.css?inline')).toBeGreaterThan(lastSheet);
    expect(MAIN).toMatch(/media\.textContent = responsive;\s*document\.head\.append\(media\);/u);
  });

  it('hold the phone sheet’s query that shell/sheet.ts follows, so that the sheet and its inert islands agree', () => {
    const query = sheetQuery();
    expect(query).toBe('(max-width: 599px) and (min-height: 500px)');
    const media = [...plain(styleSheet('responsive.css')).matchAll(/@media ([^{]+?) \{/gu)];
    expect(media.map((match) => match[1])).toContain(query);
  });

  it('hold the dock’s rules under that same query alone, where the dock puts the tool bar in the last row (issue #73’s D1)', () => {
    const blocks = mediaBlocks(styleSheet('responsive.css'));
    const dock = blocks.filter(({ body }) => /\.tools-island\b/u.test(body));
    expect(dock.length).toBeGreaterThan(0);
    expect(new Set(dock.map(({ query }) => query))).toEqual(new Set([sheetQuery()]));
    const rows = dock.flatMap(({ body }) => areaRows(body));
    expect(rows.map((areas) => areas.at(-1))).toEqual(['tools tools tools']);
    expect(rows[0]?.[0]).toBe('identity . top-right');
  });

  it('hide the tool hint and the canvas’s chip on phones, in portrait and in landscape, under the view readout’s query (issue #77’s D2 and D8)', () => {
    expect(hiddenUnder(PHONES)).toEqual(
      expect.arrayContaining(['.view-readout', '.tool-hint', '.canvas-focus-chip']),
    );
  });

  it('give the tool hint a fixed 18 px row under the top row, compact and at least 500 px high alone (issue #77’s D7)', () => {
    const blocks = mediaBlocks(styleSheet('responsive.css')).filter(({ body }) =>
      body.includes("'hint hint hint'"),
    );
    expect(blocks.map(({ query }) => query)).toEqual([HINT_ROW]);
    const body = blocks[0]?.body ?? '';
    expect(areaRows(body)[0]?.slice(0, 3)).toEqual([
      'identity tools top-right',
      'hint hint hint',
      'notices notices notices',
    ]);
    expect(body).toMatch(/grid-template-rows: auto 18px minmax\(0, max-content\) /u);
    expect(body).toMatch(/\.tool-hint \{[^}]*grid-area: hint;/u);
  });
});
