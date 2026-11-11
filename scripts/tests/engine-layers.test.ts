import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  ENGINE_LAYERS,
  ENTRY_LAYER,
  adrLayerOrder,
  documentedLayers,
  formatViolation,
  importSpecifiers,
  layerOf,
  layerViolations,
  resolveImport,
} from '../lib/engine-layers.ts';
import type { EngineSource } from '../lib/engine-layers.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'packages', 'engine', 'src');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Every TypeScript file of the engine's sources, with its path relative to `src`. */
function engineSources(): EngineSource[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return { path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') };
    });
}

const check = (...files: EngineSource[]): string[] => layerViolations(files).map(formatViolation);

describe('the engine layer order', () => {
  it('is the order accepted in modules.md and ADR 0004', () => {
    expect(documentedLayers(read('docs/architecture/engine/modules.md'))).toEqual(ENGINE_LAYERS);
    expect(adrLayerOrder(read('docs/adr/0004-canvas-engine-package-boundaries.md'))).toEqual(
      ENGINE_LAYERS,
    );
  });

  it('holds for every engine source file', () => {
    const files = engineSources();
    expect(files.map(({ path }) => path)).toContain('index.ts');
    expect(layerViolations(files).map(formatViolation)).toEqual([]);
  });
});

describe('layerOf', () => {
  it.each([
    ['math/vector.ts', 1],
    ['ports/clock.ts', 1],
    ['model/element.ts', 2],
    ['camera/zoom.ts', 3],
    ['transform/resize/handles.ts', 5],
    ['editor/editor.ts', 9],
    ['index.ts', ENTRY_LAYER],
  ])('puts %s in layer %i', (path, layer) => {
    expect(layerOf(path)).toBe(layer);
  });

  it('puts a directory that no layer names in none', () => {
    expect(layerOf('widgets/button.ts')).toBeUndefined();
  });
});

describe('resolveImport', () => {
  it.each([
    ['math/vector.ts', './angle.ts', 'math/angle.ts'],
    ['math/vector.ts', '../ports/clock.ts', 'ports/clock.ts'],
    ['math/vector.ts', '../index.ts', 'index.ts'],
    ['index.ts', './math/./sub/../box.ts', 'math/box.ts'],
  ])('resolves %s → %s to %s', (from, specifier, resolved) => {
    expect(resolveImport(from, specifier)).toBe(resolved);
  });

  it.each([
    ['math/vector.ts', '../../../apps/web/src/shell/EditorShell.tsx'],
    ['index.ts', '../package.json'],
    ['math/vector.ts', 'node:fs'],
    ['math/vector.ts', '@planewright/protocol'],
  ])('finds no engine module for %s → %s', (from, specifier) => {
    expect(resolveImport(from, specifier)).toBeNull();
  });
});

describe('importSpecifiers', () => {
  it('lists static, type-only, re-exported and dynamic imports, but not comments or strings', () => {
    const text = [
      "import { a } from './a.ts';",
      "import type { B } from '../model/b.ts';",
      "export * from '../scene/c.ts';",
      "export type { D } from '../editor/d.ts';",
      "const e = await import('../tools/e.ts');",
      "type F = typeof import('../history/f.ts');",
      "// import { g } from '../commands/g.ts';",
      'const h = "import { h } from \'../input/h.ts\'";',
    ].join('\n');
    expect(importSpecifiers(text)).toEqual([
      './a.ts',
      '../model/b.ts',
      '../scene/c.ts',
      '../editor/d.ts',
      '../tools/e.ts',
      '../history/f.ts',
    ]);
  });
});

describe('layerViolations', () => {
  it('allows imports from the same layer and from earlier layers', () => {
    expect(
      check(
        { path: 'math/vector.ts', text: "import { TAU } from './angle.ts';" },
        { path: 'math/random.ts', text: "import type { Clock } from '../ports/clock.ts';" },
        { path: 'model/element.ts', text: "import { add } from '../math/vector.ts';" },
        { path: 'editor/editor.ts', text: "import type { Element } from '../model/element.ts';" },
        { path: 'index.ts', text: "export type { Editor } from './editor/editor.ts';" },
      ),
    ).toEqual([]);
  });

  it.each([
    "import { createDocument } from '../model/document.ts';",
    "import type { Document } from '../model/document.ts';",
    "export { createDocument } from '../model/document.ts';",
    "const model = await import('../model/document.ts');",
  ])('rejects an import of a later layer: %s', (text) => {
    expect(check({ path: 'math/vector.ts', text })).toEqual([
      'math/vector.ts → ../model/document.ts: layer 1 (math, ports) imports layer 2 (model)',
    ]);
  });

  it('rejects a layer importing the public entry point', () => {
    expect(
      check({ path: 'editor/editor.ts', text: "import type { X } from '../index.ts';" }),
    ).toEqual(['editor/editor.ts → ../index.ts: layer 9 (editor) imports the entry point']);
  });

  it.each(['node:fs', '@planewright/protocol', '../../../apps/web/src/shell/EditorShell.tsx'])(
    'rejects an import from outside the engine: %s',
    (specifier) => {
      expect(check({ path: 'math/vector.ts', text: `import x from '${specifier}';` })).toEqual([
        `math/vector.ts → ${specifier}: imports something outside the engine's sources`,
      ]);
    },
  );

  it('rejects a module outside every layer, and an import of one', () => {
    expect(
      check(
        { path: 'widgets/button.ts', text: '' },
        { path: 'editor/editor.ts', text: "import { button } from '../widgets/button.ts';" },
      ),
    ).toEqual([
      'widgets/button.ts: is in no engine layer',
      'editor/editor.ts → ../widgets/button.ts: imports a module in no engine layer',
    ]);
  });
});

describe('the documented order', () => {
  it('reads the layer table of modules.md', () => {
    const markdown = [
      '## Engine layers',
      '',
      '| Layer | Modules            | Responsibility |',
      '| ----- | ------------------ | -------------- |',
      '| 1     | `math`, `ports`    | basics         |',
      '| 2     | `model`            | documents      |',
      '',
      '## Ports',
      '',
      '| 3     | `elsewhere`        | not a layer    |',
    ].join('\n');
    expect(documentedLayers(markdown)).toEqual([['math', 'ports'], ['model']]);
  });

  it('reads the order sentence of ADR 0004', () => {
    const text =
      'Modules import only from the layers below them, in this order:\n   `math` and\n   `ports`; `model`; `history`, `selection` and `transform`; `editor`. The first issue…';
    expect(adrLayerOrder(text)).toEqual([
      ['math', 'ports'],
      ['model'],
      ['history', 'selection', 'transform'],
      ['editor'],
    ]);
  });

  it('finds no order where none is written', () => {
    expect(documentedLayers('# Packages\n')).toEqual([]);
    expect(adrLayerOrder('No order here.')).toEqual([]);
  });
});
