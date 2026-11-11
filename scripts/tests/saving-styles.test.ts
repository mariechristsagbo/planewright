import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

// The save state on the shell's root (ADR 0012, decision 12; the v0.2 plan's S7): data-save-state
// exists for the tests alone, so no style sheet under apps/web/src selects it and no production
// code reads it; EditorShell.tsx writes it, once.

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
