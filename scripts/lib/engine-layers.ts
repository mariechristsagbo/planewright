import ts from 'typescript';

/**
 * The engine's layers, lowest first, as accepted in ADR 0004 and
 * docs/architecture/engine/modules.md. A module may import from its own layer and from earlier
 * ones, never from a later one.
 */
export const ENGINE_LAYERS: readonly (readonly string[])[] = [
  ['math', 'ports'],
  ['model'],
  ['geometry', 'camera'],
  ['scene'],
  ['history', 'selection', 'transform'],
  ['input', 'tools'],
  ['commands'],
  ['persistence', 'collab'],
  ['editor'],
];

/** Files directly in `src`, such as the public entry point, sit above every layer. */
export const ENTRY_LAYER = ENGINE_LAYERS.length + 1;

export interface EngineSource {
  /** The path relative to `packages/engine/src`, with `/` separators. */
  readonly path: string;
  readonly text: string;
}

export interface LayerViolation {
  readonly file: string;
  /** The offending module specifier, or null when the file itself is misplaced. */
  readonly specifier: string | null;
  readonly reason: string;
}

/** The layer number of a source path, or undefined when no layer names its directory. */
export function layerOf(path: string): number | undefined {
  const [first = '', ...rest] = path.split('/');
  if (rest.length === 0) {
    return ENTRY_LAYER;
  }
  const index = ENGINE_LAYERS.findIndex((modules) => modules.includes(first));
  return index === -1 ? undefined : index + 1;
}

/**
 * Resolves a relative module specifier against the importing file's path. Returns null for a
 * package or built-in module, and for a path that leaves `src`.
 */
export function resolveImport(from: string, specifier: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '..') {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
    } else if (segment !== '.') {
      parts.push(segment);
    }
  }
  return parts.join('/');
}

/** Every module a file imports or re-exports, including type-only and dynamic imports. */
export function importSpecifiers(text: string): string[] {
  return ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName);
}

function layerName(layer: number): string {
  const modules = ENGINE_LAYERS[layer - 1];
  return modules === undefined
    ? 'the entry point'
    : `layer ${String(layer)} (${modules.join(', ')})`;
}

function importProblem(from: string, own: number, specifier: string): string | null {
  const target = resolveImport(from, specifier);
  if (target === null) {
    return "imports something outside the engine's sources";
  }
  const layer = layerOf(target);
  if (layer === undefined) {
    return 'imports a module in no engine layer';
  }
  return layer > own ? `${layerName(own)} imports ${layerName(layer)}` : null;
}

/** Every import that breaks the layer order, and every file that sits in no layer. */
export function layerViolations(files: readonly EngineSource[]): LayerViolation[] {
  const violations: LayerViolation[] = [];
  for (const file of files) {
    const own = layerOf(file.path);
    if (own === undefined) {
      violations.push({ file: file.path, specifier: null, reason: 'is in no engine layer' });
      continue;
    }
    for (const specifier of importSpecifiers(file.text)) {
      const reason = importProblem(file.path, own, specifier);
      if (reason !== null) {
        violations.push({ file: file.path, specifier, reason });
      }
    }
  }
  return violations;
}

export function formatViolation({ file, specifier, reason }: LayerViolation): string {
  return specifier === null ? `${file}: ${reason}` : `${file} → ${specifier}: ${reason}`;
}

/** The code spans of a Markdown fragment: every other piece between backticks. */
const backticked = (text: string): string[] =>
  text.split('`').filter((_, index) => index % 2 === 1);

/** The modules of each row of the "Engine layers" table in modules.md, lowest layer first. */
export function documentedLayers(markdown: string): string[][] {
  const section = /^## Engine layers\n([\s\S]*?)(?=^## )/mu.exec(markdown)?.[1] ?? '';
  return section
    .split('\n')
    .filter((line) => /^\| \d+ +\|/u.test(line))
    .map((line) => line.split('|').slice(2, 3).flatMap(backticked));
}

/** The layer order that ADR 0004 writes as one sentence, groups separated by semicolons. */
export function adrLayerOrder(text: string): string[][] {
  const sentence = /in this order:\s*([^.]*)\./u.exec(text)?.[1] ?? '';
  return sentence
    .split(';')
    .map(backticked)
    .filter((modules) => modules.length > 0);
}
