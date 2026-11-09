import { describe, expect, it } from 'vitest';

import type { Measurement } from '../lib/perf-budgets.ts';
import {
  GATE_RUNS,
  TOLERANCE,
  appendRun,
  evaluate,
  readBaseline,
  readMeasurement,
  reportMarkdown,
} from '../lib/perf-report.ts';
import type { PerfBaseline, PerfRun } from '../lib/perf-report.ts';

// The performance report (docs/architecture/engine/quality.md#performance-budgets): every budget
// reported with its value, structural failures failing at once, and statistical budgets failing
// only once three consecutive runs on main are recorded, and then only when more than 20 % worse
// than their budget or, for a budget the baseline misses, than that baseline.

/** One sample of every measured budget at `value` times its target, and the bundle sizes. */
function measured(scale: number, overrides: Record<string, number[]> = {}): Measurement[] {
  const targets: Record<string, number> = {
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
  const statistical = Object.entries(targets).map(([id, target]) => ({
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

const run = (branch: string, values: Record<string, number>, at = 1): PerfRun => ({
  label: `${branch} run ${String(at)}`,
  branch,
  event: branch === 'main' ? 'push' : 'pull_request',
  commit: `c${String(at)}`,
  run: `https://example.invalid/runs/${String(at)}`,
  date: `2026-11-${String(10 + at)}T00:00:00Z`,
  values,
});

const NONE: PerfBaseline = { runs: [], followUps: {} };

describe('evaluate before three main runs', () => {
  it('reports every budget as met, missed, by hand, or not measured, and fails on none of them', () => {
    const evaluation = evaluate(measured(0.5, { B6: [1, 30], B7: [10] }), NONE);
    expect(evaluation.gating).toBe(false);
    expect(evaluation.failures).toEqual([]);
    const status = Object.fromEntries(evaluation.results.map((r) => [r.budget.id, r.status]));
    expect(status).toMatchObject({ B1: 'met', B5: 'met', B6: 'missed', B7: 'missed' });
    expect(status['B14']).toBe('by hand');
    expect(evaluation.results.find((r) => r.budget.id === 'B6')?.value).toBeCloseTo(28.55, 9);
  });

  it('fails when a budget measured in CI was not measured, whatever the mode', () => {
    const evaluation = evaluate(
      measured(0.5).filter(({ id }) => id !== 'B3'),
      NONE,
    );
    expect(evaluation.failures).toEqual(['B3 Overlay layer redraw was not measured.']);
  });

  it('fails at once when a bundle exceeds its budget, since the guardrail is no statistic', () => {
    const evaluation = evaluate(measured(0.5, { B12: [15.001] }), NONE);
    expect(evaluation.failures).toEqual([
      'B12 Bundle size, minified and gzip-compressed is 15.001 KB, over its budget of 15 KB.',
    ]);
  });

  it('counts only runs on main towards the gate', () => {
    const baseline = { runs: [run('perf/33-x', {}), run('main', {}, 2)], followUps: {} };
    const evaluation = evaluate(measured(0.5), baseline);
    expect([evaluation.gating, evaluation.mainRuns]).toEqual([false, 1]);
    expect(GATE_RUNS).toBe(3);
  });
});

describe('evaluate after three main runs', () => {
  const values = { B1: 4, B6: 20, B7: 3 };
  const gated: PerfBaseline = {
    runs: [1, 2, 3].map((at) => run('main', { ...values, B6: 18 + at }, at)),
    followUps: { B6: '#90' },
  };

  it('takes the slowest of the last three main runs as the baseline', () => {
    const evaluation = evaluate(measured(0.5), gated);
    const b6 = evaluation.results.find(({ budget }) => budget.id === 'B6');
    expect([evaluation.gating, b6?.baseline, b6?.followUp]).toEqual([true, 21, '#90']);
  });

  it('fails a budget more than 20 % worse than its budget, or than a baseline that misses it', () => {
    expect(TOLERANCE).toBe(0.2);
    const within = evaluate(measured(1.2, { B6: [25.2] }), gated);
    expect(within.failures).toEqual([]);
    const over = evaluate(measured(1.2, { B1: [9.61], B6: [25.21] }), gated);
    expect(over.failures).toEqual([
      'B1 Scene layer redraw, 5,000 elements all visible is 9.61 ms, more than 20 % worse than 8 ms.',
      'B6 Marquee query, 10,000 elements is 25.21 ms, more than 20 % worse than 21 ms.',
    ]);
  });

  it('fails no budget that the baseline did not hold', () => {
    const evaluation = evaluate(measured(1.1, { B9: [1] }), gated);
    expect(evaluation.results.find(({ budget }) => budget.id === 'B9')?.status).toBe('missed');
    expect(evaluation.failures).toEqual([]);
  });
});

describe('readMeasurement and readBaseline', () => {
  it('read a browser measurement and a baseline, refusing malformed ones', () => {
    const measurement = { id: 'B1', samples: [1, 2], details: { elements: 5_000 } };
    expect(readMeasurement(measurement, 'b1.json')).toEqual(measurement);
    expect(() => readMeasurement({ id: 'B1', samples: [] }, 'b1.json')).toThrow('b1.json');
    expect(() => readMeasurement({ samples: [1] }, 'x.json')).toThrow('x.json');
    expect(readBaseline({ runs: [], followUps: {} })).toEqual(NONE);
    expect(() => readBaseline({ runs: [{ branch: 'main' }] })).toThrow('baseline');
  });
});

describe('appendRun', () => {
  const report = {
    run: { branch: 'main', event: 'push', commit: 'abc', url: 'https://example.invalid/r/9' },
    date: '2026-11-20T00:00:00Z',
    values: { B1: 3 },
  };

  it('records a run on main with its values', () => {
    const next = appendRun(NONE, report, { label: 'main run 1/3' });
    expect(next.runs).toEqual([
      {
        label: 'main run 1/3',
        branch: 'main',
        event: 'push',
        commit: 'abc',
        run: 'https://example.invalid/r/9',
        date: '2026-11-20T00:00:00Z',
        values: { B1: 3 },
      },
    ]);
  });

  it('records a run on another branch only when asked to, and never the same run twice', () => {
    const elsewhere = { ...report, run: { ...report.run, branch: 'perf/33-x' } };
    expect(() => appendRun(NONE, elsewhere, { label: 'x' })).toThrow('main');
    expect(appendRun(NONE, elsewhere, { label: 'x', anyBranch: true }).runs).toHaveLength(1);
    const once = appendRun(NONE, report, { label: 'a' });
    expect(() => appendRun(once, report, { label: 'b' })).toThrow('already');
  });
});

describe('reportMarkdown', () => {
  it('lists every budget with its value, the mode, the machine and the notes', () => {
    const evaluation = evaluate(measured(0.5, { B6: [3] }), {
      runs: [run('perf/33-x', {})],
      followUps: { B6: '#90' },
    });
    const markdown = reportMarkdown(evaluation, [{ id: 'I1', samples: [5, 6] }], {
      machine: { Processor: 'Test CPU', Cores: '4' },
      notes: ['The element list renders at most 101 options.'],
    });
    expect(markdown).toContain('Report only: 0 of 3 consecutive runs on `main` are recorded');
    expect(markdown).toContain(
      '| B1 | Scene layer redraw, 5,000 elements all visible | ≤ 8 ms, 95th percentile | 4 ms |',
    );
    expect(markdown).toContain(
      '| B6 | Marquee query, 10,000 elements | ≤ 2 ms | 3 ms | 1 | missed, follow-up #90 |',
    );
    expect(markdown).toContain(
      '| B14 | JavaScript heap, 10,000 elements and a full history | ≤ 150 MB | by hand |',
    );
    expect(markdown).toContain(
      '| I1 | Main-thread time of a pan step, 5,000 elements, 101 options listed | 5.95 ms | 2 |',
    );
    expect(markdown).toContain('- Processor: Test CPU');
    expect(markdown).toContain('- The element list renders at most 101 options.');
  });
});
