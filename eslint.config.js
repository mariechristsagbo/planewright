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
    name: 'planewright/tests',
    files: ['**/tests/**/*.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': ['error', 4],
    },
  },
  prettier,
);
