import { defineConfig } from 'vitest/config';

/**
 * One Vitest run covers every workspace. Project names follow `<area>:<kind>` so that
 * `npm run test:unit` and `npm run test:integration` can select them with a glob.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'tooling:unit',
          root: '.',
          include: ['scripts/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'research:unit',
          root: '.',
          include: ['research/**/tests/unit/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'research:integration',
          root: '.',
          include: ['research/**/tests/integration/**/*.test.mjs'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'protocol:unit',
          root: './packages/protocol',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'collab:unit',
          root: './apps/collab',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'collab:integration',
          root: './apps/collab',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: './apps/web/vite.config.ts',
        test: {
          name: 'web:unit',
          root: './apps/web',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Research drivers that need a live browser stay outside; their pure boundary modules are in.
      include: [
        'apps/*/src/**',
        'packages/*/src/**',
        'scripts/lib/**',
        'research/excalidraw/lib/{capture,files,guard,metrics,navwatch,placement,png,sanitise,server,session-state,windows}.mjs',
      ],
      // Process entry points only wire dependencies together; behaviour lives in tested modules.
      exclude: ['apps/collab/src/main.ts', 'apps/web/src/main.tsx'],
      reporter: ['text', 'json-summary', 'lcov'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
