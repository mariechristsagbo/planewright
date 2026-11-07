import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const TRIPLE_SLASH = '@typescript-eslint/triple-slash-reference';

// The rules that draw the engine's boundary; every other rule is irrelevant to these snippets.
const BOUNDARY_RULES = new Set([
  TRIPLE_SLASH,
  'no-restricted-globals',
  'no-restricted-imports',
  'no-restricted-properties',
  'no-restricted-syntax',
]);

/** The boundary rules, with their configured options, that the repository's config gives a file. */
// Loading the whole ESLint configuration can take longer than Vitest's 10 s hook limit while the
// full coverage run keeps every core busy, so the hooks that load it get a minute.
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

// Engine files are TypeScript, so the snippets go through the same parser and plugin as they do.
function lint(code: string, rules: Linter.RulesRecord): Linter.LintMessage[] {
  return new Linter().verify(code, {
    languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules,
  });
}

const ruleIds = (code: string, rules: Linter.RulesRecord): (string | null)[] =>
  lint(code, rules).map((message) => message.ruleId);

// Platform and non-deterministic code that no engine file may contain, with the rule that stops it.
const FORBIDDEN_EVERYWHERE: readonly (readonly [string, string])[] = [
  ['window.innerWidth;', 'no-restricted-globals'],
  ['document.createElement("canvas");', 'no-restricted-globals'],
  ['navigator.language;', 'no-restricted-globals'],
  ['process.env.HOME;', 'no-restricted-globals'],
  ['Buffer.from("a");', 'no-restricted-globals'],
  ['console.log(1);', 'no-restricted-globals'],
  ['performance.now();', 'no-restricted-globals'],
  ['crypto.getRandomValues(new Uint8Array(16));', 'no-restricted-globals'],
  ['structuredClone({});', 'no-restricted-globals'],
  ['globalThis.setTimeout;', 'no-restricted-globals'],
  ['setTimeout(() => 0, 10);', 'no-restricted-globals'],
  ['setInterval(() => 0, 10);', 'no-restricted-globals'],
  ['setImmediate(() => 0);', 'no-restricted-globals'],
  ['requestAnimationFrame(() => 0);', 'no-restricted-globals'],
  ['queueMicrotask(() => 0);', 'no-restricted-globals'],
  ['Math.random();', 'no-restricted-properties'],
  ['const { random } = Math;', 'no-restricted-properties'],
  ['Date.now();', 'no-restricted-properties'],
  ['new Date();', 'no-restricted-syntax'],
  ['Date();', 'no-restricted-syntax'],
];

// One-line escapes that type checking accepts: a directive that adds a library, ambient types or a
// file to the ECMAScript-only build, or an ambient declaration that hides a global from the rules.
const ESCAPES: readonly (readonly [string, string])[] = [
  ['/// <reference lib="dom" />', TRIPLE_SLASH],
  ['/// <reference types="node" />', TRIPLE_SLASH],
  ['/// <reference path="./platform.d.ts" />', TRIPLE_SLASH],
  ['declare const window: { innerWidth: number }; window.innerWidth;', 'no-restricted-syntax'],
  [
    'declare function setTimeout(task: () => void, delay: number): number; setTimeout(() => 0, 10);',
    'no-restricted-syntax',
  ],
  ['export {}; declare global { const process: { env: object } }', 'no-restricted-syntax'],
  [
    'declare module "node:fs" { function readFileSync(path: string): string; }',
    'no-restricted-syntax',
  ],
  ['declare namespace NodeJS { interface ProcessEnv { HOME: string } }', 'no-restricted-syntax'],
  ['declare class Worker { constructor(url: string); }', 'no-restricted-syntax'],
];

// ECMAScript and erasable TypeScript that the engine may use freely.
const ALLOWED = [
  'Math.max(1, 2) + Math.hypot(3, 4) + Number.EPSILON;',
  'new Date(0).getTime() + Date.UTC(2026, 10, 6);',
  'Object.freeze(new Map([[1, new Set([2])]]));',
  'export const twice = (value: number): number => value * 2;',
  'const brand: unique symbol = Symbol("brand");',
  'export type Id = string & { readonly [brand]: "Id" };',
  'export interface Size { readonly width: number }',
].join('\n');

describe('the engine source boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/engine/src/math/vector.ts');
  }, CONFIG_LOAD_MS);

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it.each(ESCAPES)('rejects the escape %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it.each([
    'import { readFileSync } from "node:fs";',
    'import { join } from "path";',
    'import { it } from "vitest";',
    'export { PROTOCOL_VERSION } from "@planewright/protocol";',
  ])('rejects the non-relative import in %s', (code) => {
    expect(ruleIds(code, rules)).toEqual(['no-restricted-imports']);
  });

  it('allows ECMAScript built-ins and relative imports', () => {
    const code = `import { a } from './a.ts';\nimport { b } from '../ports/b.ts';\n${ALLOWED}`;
    expect(lint(code, rules)).toEqual([]);
  });

  it('names the port that replaces timers, the clock and randomness', () => {
    const messages = (code: string): string[] => lint(code, rules).map(({ message }) => message);
    expect(messages('setTimeout(() => 0, 10);')).toEqual([
      expect.stringContaining('Scheduler port'),
    ]);
    expect(messages('Date.now();')).toEqual([expect.stringContaining('Clock port')]);
    expect(messages('Math.random();')).toEqual([expect.stringContaining('IdSource port')]);
    expect(messages('window;')).toEqual([expect.stringContaining('ADR 0004')]);
  });

  it('says why an ambient declaration is forbidden', () => {
    expect(lint('declare const window: object;', rules).map(({ message }) => message)).toEqual([
      expect.stringContaining('ambient declaration'),
    ]);
  });
});

describe('the engine test boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/engine/tests/unit/vector.test.ts');
  }, CONFIG_LOAD_MS);

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it.each(ESCAPES)('rejects the escape %s', (code, rule) => {
    expect(ruleIds(code, rules)).toEqual([rule]);
  });

  it('lets tests import their runner', () => {
    expect(lint('import { it } from "vitest";', rules)).toEqual([]);
  });
});

describe('the boundary outside the engine', () => {
  it.each(['apps/web/src/App.tsx', 'apps/collab/src/server.ts', 'packages/protocol/src/index.ts'])(
    'does not apply to %s',
    async (path) => {
      const rules = await boundaryRulesFor(path);
      // Only typescript-eslint's shared directive rule, whose options allow libraries and types.
      expect(Object.keys(rules)).toEqual([TRIPLE_SLASH]);
      const code =
        '/// <reference lib="dom" />\n/// <reference types="node" />\ndeclare const a: 1;';
      expect(lint(code, rules)).toEqual([]);
    },
  );
});
