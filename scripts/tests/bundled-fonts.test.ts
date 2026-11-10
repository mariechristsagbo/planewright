import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { declarationsOf } from './style-sheets.ts';
import type { Declaration } from './style-sheets.ts';

// The bundled fonts of ADR 0011: each family's face is declared in the web app's fonts.css from a
// WOFF2 file in apps/web/public/fonts, which holds that font's licence text beside it. ADR 0012,
// decision 8, adds the chrome's family, Planewright UI: Inter 400 from the canvas's own file, Inter
// 500 from one more file that Inter's licence already covers, and a metric-matched local fallback.

const ROOT = join(import.meta.dirname, '..', '..');
const FONTS = join(ROOT, 'apps', 'web', 'public', 'fonts');
const STYLE_SHEETS = join(ROOT, 'apps', 'web', 'src', 'styles');
const STYLES = readFileSync(join(STYLE_SHEETS, 'fonts.css'), 'utf8');

const BUNDLED = [
  {
    family: 'Planewright Sans',
    file: 'inter-latin-400-normal.woff2',
    licence: 'Inter-OFL.txt',
    copyright: 'Copyright 2016 The Inter Project Authors',
  },
  {
    family: 'Planewright Hand',
    file: 'patrick-hand-latin-400-normal.woff2',
    licence: 'PatrickHand-OFL.txt',
    copyright: 'Copyright (c) 2010-2012 Patrick Wagesreiter',
  },
  {
    family: 'Planewright Mono',
    file: 'jetbrains-mono-latin-400-normal.woff2',
    licence: 'JetBrainsMono-OFL.txt',
    copyright: 'Copyright 2020 The JetBrains Mono Project Authors',
  },
] as const;

/** The declarations of each `@font-face` rule in the styles. */
const faces = (): string[] =>
  [...STYLES.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map(([, body]) => body ?? '');

/** The declarations of the faces of a family, in the order written. */
const facesOf = (family: string): Declaration[][] =>
  faces()
    .map(declarationsOf)
    .filter((face) =>
      face.some(({ property, value }) => property === 'font-family' && value === `'${family}'`),
    );

/** A face's declarations, as `font-face` rules write them in fonts.css. */
const face = (family: string, weight: number, display: string, src: string): Declaration[] => [
  { property: 'font-family', value: `'${family}'` },
  { property: 'font-style', value: 'normal' },
  { property: 'font-weight', value: String(weight) },
  { property: 'font-display', value: display },
  { property: 'src', value: src },
];

const url = (file: string): string => `url('/fonts/${file}') format('woff2')`;

/** The chrome's Inter 500 file: Fontsource 5.3.0's, as ADR 0012, decision 8, gives it. */
const CHROME_500 = {
  file: 'inter-latin-500-normal.woff2',
  bytes: 24_272,
  sha256: 'f3779f1efccc4bdcdf9c0a02ab95bf6bd092ed09c48c08cedc725889edd1d19f',
};

describe('the bundled fonts (ADR 0011)', () => {
  it.each(BUNDLED)('declare $family from its WOFF2 file', ({ family, file }) => {
    const face = faces().find((body) => body.includes(`font-family: '${family}';`));
    expect(face).toBeDefined();
    expect(face).toContain(`src: url('/fonts/${file}') format('woff2');`);
    expect(face).toContain('font-weight: 400;');
    expect(readFileSync(join(FONTS, file)).subarray(0, 4).toString('latin1')).toBe('wOF2');
  });

  it.each(BUNDLED)('keep the face of $family as ADR 0011 declared it', ({ family, file }) => {
    expect(facesOf(family)).toEqual([face(family, 400, 'block', url(file))]);
  });

  it.each(BUNDLED)('ship $file with its open-font licence', ({ licence, copyright }) => {
    const text = readFileSync(join(FONTS, licence), 'utf8');
    expect(text).toContain(copyright);
    expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('are declared in fonts.css and in no other style sheet', () => {
    const others = readdirSync(STYLE_SHEETS).filter((name) => name !== 'fonts.css');
    expect(others.length).toBeGreaterThan(0);
    expect(
      others.filter((name) =>
        readFileSync(join(STYLE_SHEETS, name), 'utf8').includes('@font-face'),
      ),
    ).toEqual([]);
  });

  it('hold nothing but the three fonts, their licences and the chrome’s 500 file', () => {
    expect(faces()).toHaveLength(6);
    expect(readdirSync(FONTS).sort()).toEqual(
      [...BUNDLED.flatMap(({ file, licence }) => [file, licence]), CHROME_500.file].sort(),
    );
  });
});

describe("the chrome's faces (ADR 0012, decision 8)", () => {
  it('declare Planewright UI 400 and 500, the 400 face at the canvas’s Inter 400 URL', () => {
    expect(facesOf('Planewright UI')).toEqual([
      face('Planewright UI', 400, 'swap', url('inter-latin-400-normal.woff2')),
      face('Planewright UI', 500, 'swap', url(CHROME_500.file)),
    ]);
  });

  it('ship Inter 500 as Fontsource 5.3.0 built it, under the Inter licence already beside it', () => {
    const font = readFileSync(join(FONTS, CHROME_500.file));
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(font.length).toBe(CHROME_500.bytes);
    expect(createHash('sha256').update(font).digest('hex')).toBe(CHROME_500.sha256);
    expect(readFileSync(join(FONTS, 'Inter-OFL.txt'), 'utf8')).toContain(
      'Copyright 2016 The Inter Project Authors',
    );
  });

  it('declare the metric-matched local fallback, Planewright UI Fallback', () => {
    expect(facesOf('Planewright UI Fallback')).toEqual([
      [
        { property: 'font-family', value: "'Planewright UI Fallback'" },
        { property: 'src', value: "local('Arial'), local('Helvetica'), local('Liberation Sans')" },
        { property: 'size-adjust', value: '106.8%' },
        { property: 'ascent-override', value: '90.7%' },
        { property: 'descent-override', value: '22.6%' },
        { property: 'line-gap-override', value: '0%' },
      ],
    ]);
  });
});
