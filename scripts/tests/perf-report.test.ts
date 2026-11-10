import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readBaseline } from '../lib/perf-baseline.ts';
import type { PerfBaseline } from '../lib/perf-baseline.ts';
import { GATE_RUNS, evaluate, readMeasurement, reportMarkdown } from '../lib/perf-report.ts';
import { PROCESSOR, measured, recordedRun } from './perf-fixtures.ts';

// The performance report (docs/architecture/engine/quality.md#performance-budgets): every budget
// reported with its value, structural failures failing at once, and statistical budgets reported
// only while the run's processor has fewer than three runs on main recorded; perf-gate.test.ts
// tests the gate once it has them.

const NONE: PerfBaseline = { runs: [], followUps: {} };

describe('evaluate before three runs on main on the processor', () => {
  it('reports every budget as met, missed, by hand, or not measured, and fails on none of them', () => {
    const evaluation = evaluate(measured(0.5, { B6: [1, 30], B7: [10] }), NONE, PROCESSOR);
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
      PROCESSOR,
    );
    expect(evaluation.failures).toEqual(['B3 Overlay layer redraw was not measured.']);
  });

  it('fails at once when a bundle exceeds its budget, since the guardrail is no statistic', () => {
    const evaluation = evaluate(measured(0.5, { B12: [15.001] }), NONE, PROCESSOR);
    expect(evaluation.failures).toEqual([
      'B12 Bundle size, minified and gzip-compressed is 15.001 KB, over its budget of 15 KB.',
    ]);
  });

  it('counts only pushes and manual dispatches on main of this repository towards the gate', () => {
    const fork = `https://github.com/fork/planewright/actions/runs/4/attempts/1`;
    const runs = [
      recordedRun('perf/33-x', {}),
      recordedRun('main', {}, { at: 2 }),
      { ...recordedRun('main', {}, { at: 3 }), event: 'pull_request' },
      { ...recordedRun('main', {}, { at: 4 }), run: fork },
      { ...recordedRun('main', {}, { at: 5 }), event: 'workflow_dispatch' },
    ];
    const evaluation = evaluate(measured(0.5), { runs, followUps: {} }, PROCESSOR);
    expect([evaluation.gating, evaluation.mainRuns]).toEqual([false, 2]);
    expect(GATE_RUNS).toBe(3);
  });
});

describe('readMeasurement', () => {
  it('reads a browser measurement, refusing a malformed one', () => {
    const measurement = { id: 'B1', samples: [1, 2], details: { elements: 5_000 } };
    expect(readMeasurement(measurement, 'b1.json')).toEqual(measurement);
    expect(() => readMeasurement({ id: 'B1', samples: [] }, 'b1.json')).toThrow('b1.json');
    expect(() => readMeasurement({ samples: [1] }, 'x.json')).toThrow('x.json');
  });
});

describe('reportMarkdown', () => {
  it('lists every budget with its value, the mode, the machine and the notes', () => {
    const runs = [recordedRun('perf/33-x', {}), recordedRun('main', {}, { at: 2, processor: 'B' })];
    const evaluation = evaluate(
      measured(0.5, { B6: [3] }),
      { runs, followUps: { B6: '#90' } },
      PROCESSOR,
    );
    const markdown = reportMarkdown(evaluation, [{ id: 'I1', samples: [5, 6] }], {
      machine: { Processor: 'Test CPU', Cores: '4' },
      notes: ['The element list renders at most 101 options.'],
    });
    expect(markdown).toContain(
      "Report only: 0 of 3 runs on `main` are recorded on this run's processor, Test CPU A (1 on `main` on any processor), so no statistical budget fails CI yet;",
    );
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

describe('reportMarkdown with the committed baseline', () => {
  const file = new URL('../../docs/performance/baseline.json', import.meta.url);
  const committed = readBaseline(JSON.parse(readFileSync(file, 'utf8')));

  it('names the open issue of a missed B1, and no issue for a missed B2', () => {
    const evaluation = evaluate(measured(0.5, { B1: [10], B2: [5] }), committed, PROCESSOR);
    const markdown = reportMarkdown(evaluation, [], { machine: {}, notes: [] });
    expect(markdown).toContain(
      '| B1 | Scene layer redraw, 5,000 elements all visible | ≤ 8 ms, 95th percentile | 10 ms | 1 | missed, follow-up #49 |',
    );
    expect(markdown).toContain(
      '| B2 | Scene layer redraw while panning, 5,000 elements, a tenth visible | ≤ 4 ms, 95th percentile | 5 ms | 1 | missed | – | – |',
    );
    expect(markdown).not.toContain('#34');
  });
});
