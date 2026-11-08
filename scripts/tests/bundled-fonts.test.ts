import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The bundled fonts of ADR 0011: each family's face is declared in the web app's styles from a
// WOFF2 file in apps/web/public/fonts, which holds that font's licence text beside it.

const ROOT = join(import.meta.dirname, '..', '..');
const FONTS = join(ROOT, 'apps', 'web', 'public', 'fonts');
const STYLES = readFileSync(join(ROOT, 'apps', 'web', 'src', 'styles.css'), 'utf8');

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

describe('the bundled fonts (ADR 0011)', () => {
  it.each(BUNDLED)('declare $family from its WOFF2 file', ({ family, file }) => {
    const face = faces().find((body) => body.includes(`font-family: '${family}';`));
    expect(face).toBeDefined();
    expect(face).toContain(`src: url('/fonts/${file}') format('woff2');`);
    expect(face).toContain('font-weight: 400;');
    expect(readFileSync(join(FONTS, file)).subarray(0, 4).toString('latin1')).toBe('wOF2');
  });

  it.each(BUNDLED)('ship $file with its open-font licence', ({ licence, copyright }) => {
    const text = readFileSync(join(FONTS, licence), 'utf8');
    expect(text).toContain(copyright);
    expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('hold nothing but the three fonts and their licences', () => {
    expect(faces()).toHaveLength(3);
    expect(readdirSync(FONTS).sort()).toEqual(
      BUNDLED.flatMap(({ file, licence }) => [file, licence]).sort(),
    );
  });
});
