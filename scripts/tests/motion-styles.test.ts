import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf, mediaBlocks, rulesOf, styleSheet } from './style-sheets.ts';

// The chrome's motion in the style sheets (ADR 0012, D2; the v0.2 plan's S12): motion.css, bundled
// and so free of media queries, holds every keyframe, entrance and fade, animates only opacity and
// translate by D2's tokens, and fades only a colour; responsive.css gives the Elements sheet its
// entrance under the sheet's query and, under reduced motion, sets the durations to 0 and removes
// every entrance and fade that motion.css declares, the tooltip's delay staying; nothing animates
// the canvas or scrolls smoothly.

const SOURCES = join(import.meta.dirname, '..', '..', 'apps', 'web', 'src');
const SHEETS = readdirSync(SOURCES, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.css'))
  .map((path) => path.split(sep).join('/'))
  .sort();
const read = (path: string): string => readFileSync(join(SOURCES, path), 'utf8');
const plain = (css: string): string => css.replaceAll(/\/\*[\s\S]*?\*\//gu, '');
const MOTION = (): string => plain(styleSheet('motion.css'));
const RESPONSIVE = (): string => styleSheet('responsive.css');

/** The phone sheet's query, as shell/sheet.ts exports it. */
const SHEET_QUERY = '(max-width: 599px) and (min-height: 500px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/** A style sheet's @keyframes, each name with its keyframes' rules. */
const keyframesOf = (css: string) =>
  [...plain(css).matchAll(/@keyframes ([\w-]+) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/gu)].map(
    ([, name = '', body = '']) => ({ name, rules: rulesOf(body) }),
  );

/** The rules outside @keyframes, each selector with its declarations. */
const rulesOutsideKeyframes = (css: string) =>
  rulesOf(plain(css).replaceAll(/@keyframes [\w-]+ \{(?:[^{}]*\{[^{}]*\})*\s*\}/gu, '')).map(
    ({ selector, body }) => ({ selector, declarations: declarationsOf(body) }),
  );

/** Each selector of motion.css with the value of its animation or transition shorthand. */
const motionOf = (property: 'animation' | 'transition'): Map<string, string> =>
  new Map(
    rulesOutsideKeyframes(MOTION()).flatMap(({ selector, declarations }) =>
      declarations
        .filter((declaration) => declaration.property === property)
        .flatMap(({ value }) => selector.split(',').map((one) => [one.trim(), value] as const)),
    ),
  );

/** D2's entrances: each surface's keyframes and duration token (the issue's D2 table). */
const ENTRANCES = new Map([
  ['.chrome-menu', 'pw-enter-above var(--pw-dur-enter)'],
  ['.selection-panel', 'pw-enter-above var(--pw-dur-enter)'],
  ['.selection-bar', 'pw-enter-above var(--pw-dur-enter)'],
  ['.notices', 'pw-enter-above var(--pw-dur-enter)'],
  ['.dialog', 'pw-enter-above var(--pw-dur-enter)'],
  ['.more-tools', 'pw-enter-below var(--pw-dur-enter)'],
  ['.element-list-drawer', 'pw-enter-side var(--pw-dur-panel)'],
  ['.details-sheet', 'pw-enter-sheet var(--pw-dur-sheet)'],
]);

/** Where each keyframes starts, settling from there into place (the issue's D2 table). */
const STARTS = {
  'pw-enter-above': '0 calc(-1 * var(--pw-shift-enter))',
  'pw-enter-below': '0 var(--pw-shift-enter)',
  'pw-enter-side': 'var(--pw-shift-panel) 0',
  'pw-enter-sheet': '0 var(--pw-shift-sheet)',
};

describe('motion.css', () => {
  it('A11 holds no media query, and every keyframe, animation and transition of the bundled style sheets', () => {
    expect(MOTION()).not.toMatch(/@media/u);
    const moving = SHEETS.filter((path) =>
      /@keyframes|\b(animation|transition)[\w-]*\s*:/u.test(plain(read(path))),
    );
    expect(moving).toEqual(['styles/motion.css', 'styles/responsive.css']);
  });

  it('A11 starts each keyframes transparent and translated by D2’s distance, animating only opacity and translate', () => {
    const keyframes = keyframesOf(styleSheet('motion.css'));
    expect(
      Object.fromEntries(
        keyframes.map(({ name, rules }) => [
          name,
          rules.map(({ selector, body }) => [selector, declarationsOf(body)]),
        ]),
      ),
    ).toEqual(
      Object.fromEntries(
        Object.entries(STARTS).map(([name, start]) => [
          name,
          [
            [
              'from',
              [
                { property: 'opacity', value: '0' },
                { property: 'translate', value: start },
              ],
            ],
          ],
        ]),
      ),
    );
  });

  it('A11 D2 gives each surface its entrance, eased by --pw-ease, once, without delay, filling only backwards', () => {
    const animations = motionOf('animation');
    expect([...animations.keys()].sort()).toEqual([...ENTRANCES.keys()].sort());
    for (const [selector, value] of animations) {
      expect(value, selector).toBe(`${ENTRANCES.get(selector) ?? ''} var(--pw-ease) backwards`);
    }
  });

  it('A11 D6 fades only the menu item’s highlight, its background colour in 90 ms by --pw-ease', () => {
    expect([...motionOf('transition')]).toEqual([
      ['.chrome-menu .chrome-menu-item', 'background-color var(--pw-dur-quick) var(--pw-ease)'],
    ]);
    expect(MOTION()).not.toMatch(
      /transition[^;]*\b(all|outline|box-shadow|transform|width|height|top|left|margin|padding)\b/u,
    );
  });

  it('D1 reads only D2’s motion tokens, and adds no blur, filter, :has() or will-change', () => {
    const tokens = [...MOTION().matchAll(/var\((--[\w-]+)\)/gu)].map(([, name]) => name);
    expect(
      tokens.filter((name) => !/^--pw-(ease|dur-[a-z]+|shift-[a-z]+)$/u.test(name ?? '')),
    ).toEqual([]);
    expect(MOTION()).not.toMatch(/blur|filter|:has\(|will-change|infinite|forwards|both/u);
  });

  it('A11 is bundled after dialog.css, before responsive.css, which main.tsx adds last', () => {
    const main = read('main.tsx');
    const order = [
      "import './styles/dialog.css';",
      "import './styles/motion.css';",
      'responsive.css?inline',
    ];
    const at = order.map((text) => main.indexOf(text));
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
});

describe('responsive.css’s motion', () => {
  it('A11 D3 gives the Elements sheet its entrance under the sheet’s query alone', () => {
    const named = mediaBlocks(RESPONSIVE()).filter(({ body }) =>
      body.includes('animation-name: pw-enter-sheet'),
    );
    expect(named.map(({ query }) => query)).toEqual([SHEET_QUERY]);
    expect(named[0]?.body).toMatch(
      /\.element-list-drawer \{[^}]*animation-name: pw-enter-sheet;\s*animation-duration: var\(--pw-dur-sheet\);/u,
    );
  });

  it('A11 D7 under reduced motion sets the four durations to 0 ms, keeps the tooltip’s delay and removes every entrance and fade', () => {
    const blocks = mediaBlocks(RESPONSIVE()).filter(({ query }) => query === REDUCE);
    expect(blocks).toHaveLength(1);
    const rules = rulesOf(blocks[0]?.body.slice(1) ?? '').map(({ selector, body }) => ({
      selectors: selector.split(',').map((one) => one.trim()),
      declarations: declarationsOf(body),
    }));
    const root = rules.find(({ selectors }) => selectors.includes(':root'));
    expect(root?.declarations).toEqual(
      ['quick', 'enter', 'panel', 'sheet'].map((name) => ({
        property: `--pw-dur-${name}`,
        value: '0ms',
      })),
    );
    const removed = (value: string) =>
      rules
        .filter(({ declarations }) =>
          declarations.some(
            (declaration) => `${declaration.property}: ${declaration.value}` === value,
          ),
        )
        .flatMap(({ selectors }) => selectors)
        .sort();
    expect(removed('animation: none')).toEqual([...motionOf('animation').keys()].sort());
    expect(removed('transition: none')).toEqual([...motionOf('transition').keys()].sort());
    expect(blocks[0]?.body).not.toMatch(/--pw-delay-tooltip|!important/u);
  });

  it('A11 D7 puts the reduced-motion block last, after the sheet’s entrance, in fewer than 400 lines', () => {
    const queries = mediaBlocks(RESPONSIVE()).map(({ query }) => query);
    expect(queries.at(-1)).toBe(REDUCE);
    expect(RESPONSIVE().split('\n').length).toBeLessThan(400);
  });
});

describe('the canvas and the page', () => {
  it('A7 A11 no rule animates or transitions the canvas, its layers or its ring, and nothing scrolls smoothly', () => {
    const canvas = /canvas|text-layer|text-editor/u;
    const moving = SHEETS.flatMap((path) =>
      rulesOf(plain(read(path)))
        .filter(({ selector }) => canvas.test(selector))
        .filter(({ body }) => /\b(animation|transition)[\w-]*\s*:/u.test(body))
        .map(({ selector }) => `${path} ${selector}`),
    );
    expect(moving).toEqual([]);
    expect(SHEETS.filter((path) => /scroll-behavior:\s*smooth/u.test(read(path)))).toEqual([]);
  });
});
