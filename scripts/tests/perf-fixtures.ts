import { REPOSITORY } from '../lib/perf-baseline.ts';
import type { PerfRun } from '../lib/perf-baseline.ts';
import type { Measurement } from '../lib/perf-budgets.ts';

// What the performance report's tests share: one measurement of every budget at a multiple of
// its target, and runs recorded in the baseline, on a processor.

const TARGETS: Readonly<Record<string, number>> = {
  B1: 8,
  B2: 4,
  B3: 1,
  B4: 1,
  B5: 0.2,
  B6: 2,
  B7: 4,
  B8: 4,
  B10: 1.5,
};

/** One sample of every measured budget at `scale` times its target, and the bundle sizes. */
export function measured(scale: number, overrides: Record<string, number[]> = {}): Measurement[] {
  const statistical = Object.entries(TARGETS).map(([id, target]) => ({
    id,
    samples: overrides[id] ?? [target * scale],
  }));
  return [
    ...statistical,
    { id: 'B9', samples: overrides['B9'] ?? [0] },
    { id: 'B11', samples: overrides['B11'] ?? [40] },
    { id: 'B12', samples: overrides['B12'] ?? [10] },
    { id: 'B13', samples: overrides['B13'] ?? [110] },
  ];
}

export const PROCESSOR = 'Test CPU A';

/**
 * Recorded CI run number `at` on `branch`, a push on main and a pull request elsewhere, on
 * `processor`.
 */
export function recordedRun(
  branch: string,
  values: Record<string, number>,
  { at = 1, processor = PROCESSOR }: { readonly at?: number; readonly processor?: string } = {},
): PerfRun {
  return {
    label: `${branch} run ${String(at)}`,
    branch,
    event: branch === 'main' ? 'push' : 'pull_request',
    commit: String(at % 10).repeat(40),
    run: `https://github.com/${REPOSITORY}/actions/runs/${String(at)}/attempts/1`,
    date: `2026-11-${String(10 + at)}T00:00:00Z`,
    machine: {
      Processor: processor,
      Cores: '4',
      Memory: '15.6 GiB',
      System: 'linux',
      'Runner image': 'ubuntu24 1',
      'Node.js': 'v24.22.1',
      Browser: 'Chromium 156',
    },
    values,
  };
}
