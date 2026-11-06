import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint, Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The rules that draw the engine's boundary; every other rule is irrelevant to these snippets.
const BOUNDARY_RULES = new Set([
  'no-restricted-globals',
  'no-restricted-imports',
  'no-restricted-properties',
  'no-restricted-syntax',
]);

/** The boundary rules, with their configured options, that the repository's config gives a file. */
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
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
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

// ECMAScript that the engine may use freely.
const ALLOWED = [
  'Math.max(1, 2) + Math.hypot(3, 4) + Number.EPSILON;',
  'new Date(0).getTime() + Date.UTC(2026, 10, 6);',
  'Object.freeze(new Map([[1, new Set([2])]]));',
  'export const twice = (value) => value * 2;',
].join('\n');

describe('the engine source boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/engine/src/math/vector.ts');
  });

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
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
});

describe('the engine test boundary in ESLint', () => {
  let rules: Linter.RulesRecord;
  beforeAll(async () => {
    rules = await boundaryRulesFor('packages/engine/tests/unit/vector.test.ts');
  });

  it.each(FORBIDDEN_EVERYWHERE)('rejects %s', (code, rule) => {
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
      expect(await boundaryRulesFor(path)).toEqual({});
    },
  );
});
