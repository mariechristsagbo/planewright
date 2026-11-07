import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

// The canvas renderer's boundary (ADR 0004): it may use Canvas 2D and its DOM types, depends on
// the engine's entry only, and draws the frames it is handed, so it needs no Node.js API, no page
// global, no timer, no clock and no randomness.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const BOUNDARY_RULES = new Set([
  'no-restricted-globals',
  'no-restricted-imports',
  'no-restricted-properties',
  'no-restricted-syntax',
]);

// Loading the whole ESLint configuration can exceed Vitest's 10 s hook limit under a full run.
const CONFIG_LOAD_MS = 60_000;

async function boundaryRulesFor(path: string): Promise<Linter.RulesRecord> {
  const config = (await new ESLint({ cwd: ROOT }).calculateConfigForFile(path)) as Linter.Config;
  const rules: Linter.RulesRecord = {};
  for (const [name, entry] of Object.entries(config.rules ?? {})) {
    if (BOUNDARY_RULES.has(name) && entry !== undefined) {
      rules[name] = entry;
    }
  }
  return rules;
}

function lint(code: string, rules: Linter.RulesRecord): Linter.LintMessage[] {
  return new Linter().verify(code, {
    languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules,
  });
}

const ruleIds = (code: string, rules: Linter.RulesRecord): (string | null)[] =>
  lint(code, rules).map((message) => message.ruleId);

const FORBIDDEN_EVERYWHERE: readonly (readonly [string, string])[] = [
  ['process.env.HOME;', 'no-restricted-globals'],
  ['Buffer.from("a");', 'no-restricted-globals'],
  ['setTimeout(() => 0, 10);', 'no-restricted-globals'],
  ['requestAnimationFrame(() => 0);', 'no-restricted-globals'],
  ['window.devicePixelRatio;', 'no-restricted-globals'],
  ['document.createElement("canvas");', 'no-restricted-globals'],
  ['globalThis.Path2D;', 'no-restricted-globals'],
  ['Date.now();', 'no-restricted-properties'],
  ['Math.random();', 'no-restricted-properties'],
  ['new Date();', 'no-restricted-syntax'],
  ['Date();', 'no-restricted-syntax'],
  ['location.href;', 'no-restricted-globals'],
  ['devicePixelRatio;', 'no-restricted-globals'],
  ['innerWidth;', 'no-restricted-globals'],
  ['matchMedia("(min-width: 1px)");', 'no-restricted-globals'],
  ['new XMLHttpRequest();', 'no-restricted-globals'],
  ['indexedDB.open("a");', 'no-restricted-globals'],
  ['new Image();', 'no-restricted-globals'],
  ['new OffscreenCanvas(1, 1);', 'no-restricted-globals'],
  ['createImageBitmap(source);', 'no-restricted-globals'],
];

describe('the canvas renderer source boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/render-canvas/src/renderer.ts');
  }, CONFIG_LOAD_MS);

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it.each([
    'import { readFileSync } from "node:fs";',
    'import { createRoot } from "react-dom/client";',
    'export { PROTOCOL_VERSION } from "@planewright/protocol";',
    'import { geometryOf } from "@planewright/engine/src/geometry/kinds.ts";',
    'import type { SceneStore } from "../../engine/src/scene/store.ts";',
    'export { PROTOCOL_VERSION } from "../../protocol/src/index.ts";',
    'import { geometryOf } from "../../engine/src/geometry/kinds.ts";',
  ])('rejects the import in %s', (code) => {
    expect(ruleIds(code, rules)).toEqual(['no-restricted-imports']);
  });

  it("allows the engine's entry, relative imports and Canvas 2D", () => {
    const code = [
      'import type { RenderFrame } from "@planewright/engine";',
      'import { geometryOf } from "@planewright/engine";',
      'import { drawScene } from "./scene-layer.ts";',
      'const path = new Path2D();',
      'export type Context = Pick<CanvasRenderingContext2D, "fill">;',
      'export const created = new Date(0);',
      'path.moveTo(0, 0);',
      'export const twice = (value: number): number => value * 2;',
    ].join('\n');
    expect(lint(code, rules)).toEqual([]);
  });

  it('says what the renderer reaches the platform through', () => {
    const messages = (code: string): string[] => lint(code, rules).map(({ message }) => message);
    expect(messages('document.body;')).toEqual([expect.stringContaining('canvases it is given')]);
    expect(messages('setTimeout(() => 0, 10);')).toEqual([
      expect.stringContaining('Scheduler port'),
    ]);
    expect(messages('import "@planewright/protocol";')).toEqual([
      expect.stringContaining("engine's entry"),
    ]);
    expect(messages('new Date();')).toEqual([expect.stringContaining('reads no clock')]);
  });
});

describe('the canvas renderer test boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/render-canvas/tests/unit/renderer.test.ts');
  }, CONFIG_LOAD_MS);

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it('lets tests import their runner', () => {
    expect(lint('import { it, vi } from "vitest";', rules)).toEqual([]);
  });
});
