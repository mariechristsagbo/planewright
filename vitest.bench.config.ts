import { defineConfig } from 'vitest/config';

/**
 * The performance benchmarks (docs/architecture/engine/quality.md#performance-budgets), apart from
 * the test and coverage runs: `npm run perf:bench` runs every `tests/bench/*.bench.ts` in Vitest's
 * benchmark mode, one file at a time, and writes Vitest's JSON report for the performance report.
 */
export default defineConfig({
  test: {
    // Native imports, which Node.js runs through its type stripping, so that no module runner's
    // export getters add their cost to every call between modules.
    experimental: { viteModuleRunner: false },
    projects: [
      {
        test: {
          name: 'engine',
          root: './packages/engine',
          include: [],
          environment: 'node',
          benchmark: { include: ['tests/bench/**/*.bench.ts'], retainSamples: true },
        },
      },
    ],
  },
});
