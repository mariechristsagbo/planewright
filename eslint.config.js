// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Complexity guardrails. Thresholds are deliberately strict for a young codebase; raising one
 * requires an ADR or an explicit justification in the pull request.
 */
const guardrails = {
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
  'max-nested-callbacks': ['error', 3],
  'max-params': ['error', 4],
};

const PLATFORM_MESSAGE =
  'The engine is ECMAScript only (ADR 0004): it reaches the platform through its ports.';
const TIMER_MESSAGE =
  'Engine code never uses timers directly: it schedules through the Scheduler port.';
const CLOCK_MESSAGE = 'Engine code never reads the time directly: it asks the Clock port.';
const RANDOM_MESSAGE =
  'Engine code is deterministic: identifiers come from the IdSource port and test values from a seeded random source.';
const AMBIENT_MESSAGE =
  'The engine is ECMAScript only (ADR 0004): an ambient declaration could hide a platform global from these rules.';
const TIMERS = [
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'queueMicrotask',
];
// Every browser, worker and Node.js global; none of them is part of ECMAScript.
const PLATFORM_GLOBALS = [
  ...new Set(
    [globals.browser, globals.worker, globals.serviceworker, globals.node].flatMap(Object.keys),
  ),
].filter((name) => !TIMERS.includes(name));

/**
 * The engine's boundary (ADR 0004 and docs/architecture/engine/quality.md): no platform global,
 * not even through `globalThis`, and no clock, randomness or timer except through its ports. No
 * triple-slash directive may add a library, ambient types or a file to its ECMAScript-only build,
 * and no ambient declaration may stand in for a platform global.
 */
const engineBoundary = {
  '@typescript-eslint/triple-slash-reference': [
    'error',
    { lib: 'never', path: 'never', types: 'never' },
  ],
  'no-restricted-globals': [
    'error',
    ...TIMERS.map((name) => ({ name, message: TIMER_MESSAGE })),
    ...['globalThis', ...PLATFORM_GLOBALS].map((name) => ({ name, message: PLATFORM_MESSAGE })),
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Math', property: 'random', message: RANDOM_MESSAGE },
    { object: 'Date', property: 'now', message: CLOCK_MESSAGE },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: CLOCK_MESSAGE },
    { selector: "CallExpression[callee.name='Date']", message: CLOCK_MESSAGE },
    { selector: '[declare=true]', message: AMBIENT_MESSAGE },
  ],
};

export default defineConfig(
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '**/playwright-report/',
    '**/test-results/',
    '**/blob-report/',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    name: 'planewright/typescript',
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...guardrails,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },
  {
    name: 'planewright/javascript',
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    name: 'planewright/node',
    files: ['apps/collab/**/*.ts', 'scripts/**/*.ts', '*.config.ts', 'apps/web/*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Research drivers run in Node but pass functions to page.evaluate, which execute in the
    // observed browser page.
    name: 'planewright/research',
    files: ['research/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    name: 'planewright/web',
    files: ['apps/web/src/**/*.{ts,tsx}', 'apps/web/tests/unit/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    name: 'planewright/engine',
    files: ['packages/engine/**/*.ts'],
    rules: engineBoundary,
  },
  {
    // The engine has no run-time dependency: its sources import only one another.
    name: 'planewright/engine-source',
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.\\.?/)',
              message:
                'The engine has no dependencies and no Node.js APIs (ADR 0004): import only its own modules, by relative path.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'planewright/tests',
    files: ['**/tests/**/*.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': ['error', 4],
    },
  },
  prettier,
);
