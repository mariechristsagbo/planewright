import { describe, expect, it } from 'vitest';

import type { PerfBaseline } from '../lib/perf-baseline.ts';
import { TOLERANCE, evaluate, reportMarkdown } from '../lib/perf-report.ts';
import type { PerfEvaluation } from '../lib/perf-report.ts';
import { PROCESSOR, measured, recordedRun } from './perf-fixtures.ts';

// The gate of the statistical budgets (docs/architecture/engine/quality.md#what-issue-38-decided):
// a run is compared only with the runs on main recorded on its own processor model, once there are
// three of them, and a budget that all three measured fails when its value is more than 20 % worse
// than its budget or, when the slowest of the three misses the budget, than that slowest run. A run
// on a processor with fewer runs reports only, and says so; runs on other processors never move
// its limit.

/** A run on main numbered `at` on `processor`, with B6 at `b6` ms and B1, B7 within budget. */
const onMain = (at: number, b6: number, processor = PROCESSOR) =>
  recordedRun('main', { B1: 4, B6: b6, B7: 3 }, { at, processor });

const result = (evaluation: PerfEvaluation, id: string) =>
  evaluation.results.find(({ budget }) => budget.id === id);

describe('the gate on a processor with three runs on main', () => {
  const gated: PerfBaseline = {
    runs: [onMain(1, 30), onMain(2, 19), onMain(3, 20), onMain(4, 21)],
    followUps: { B6: '#90' },
  };

  it("takes the slowest of the processor's last three runs on main as the baseline", () => {
    const evaluation = evaluate(measured(0.5), gated, PROCESSOR);
    const b6 = result(evaluation, 'B6');
    expect([evaluation.gating, evaluation.processorRuns, evaluation.mainRuns]).toEqual([
      true,
      4,
      4,
    ]);
    expect([b6?.baseline, b6?.limit, b6?.followUp]).toEqual([21, 25.2, '#90']);
    expect(result(evaluation, 'B1')?.limit).toBeCloseTo(9.6, 12);
  });

  it('passes a value exactly 20 % worse than its budget, or than a baseline that misses it', () => {
    expect(TOLERANCE).toBe(0.2);
    const evaluation = evaluate(measured(1.2, { B6: [25.2] }), gated, PROCESSOR);
    expect(evaluation.failures).toEqual([]);
  });

  it('fails a value more than 20 % worse than its budget, or than a baseline that misses it', () => {
    const evaluation = evaluate(measured(1.2, { B1: [9.61], B6: [25.21] }), gated, PROCESSOR);
    expect(evaluation.failures).toEqual([
      'B1 Scene layer redraw, 5,000 elements all visible is 9.61 ms, more than 20 % worse than 8 ms.',
      'B6 Marquee query, 10,000 elements is 25.21 ms, more than 20 % worse than 21 ms.',
    ]);
  });

  it('fails no budget that the baseline did not hold', () => {
    const evaluation = evaluate(measured(1.1, { B9: [1] }), gated, PROCESSOR);
    expect(result(evaluation, 'B9')?.status).toBe('missed');
    expect(evaluation.failures).toEqual([]);
  });

  it('says in the report that the run is gated, and on which processor', () => {
    const evaluation = evaluate(measured(0.5), gated, PROCESSOR);
    const markdown = reportMarkdown(evaluation, [], { machine: {}, notes: [] });
    expect(markdown).toContain(
      "Gated: 4 runs on `main` are recorded on this run's processor, Test CPU A, so a budget more than 20 % worse than its budget, or than the slowest of the last three of them when that misses the budget, fails CI.",
    );
  });
});

describe('runs on other processors', () => {
  const fast = [1, 2, 3].map((at) => onMain(at, 5, 'Fast CPU'));
  const slow = [4, 5, 6].map((at) => onMain(at, 9, 'Slow CPU'));
  const both: PerfBaseline = { runs: [...fast, ...slow], followUps: {} };

  it("never widen a processor's limit, so a regression on a faster one still fails", () => {
    const onFast = evaluate(measured(0.5, { B6: [6.01] }), both, 'Fast CPU');
    expect(onFast.failures).toEqual([
      'B6 Marquee query, 10,000 elements is 6.01 ms, more than 20 % worse than 5 ms.',
    ]);
    const onSlow = evaluate(measured(0.5, { B6: [10.8] }), both, 'Slow CPU');
    expect([onSlow.failures, result(onSlow, 'B6')?.baseline]).toEqual([[], 9]);
    const over = evaluate(measured(0.5, { B6: [10.81] }), both, 'Slow CPU');
    expect(over.failures).toHaveLength(1);
  });

  it('report only on a processor with fewer than three runs on main, and say how many', () => {
    const oneEach: PerfBaseline = {
      runs: [onMain(1, 9, 'Xeon'), onMain(2, 6, 'EPYC 9V74'), onMain(3, 4, 'EPYC 9V45')],
      followUps: {},
    };
    const evaluation = evaluate(measured(0.5, { B6: [40] }), oneEach, 'EPYC 9V45');
    expect([evaluation.gating, evaluation.processorRuns, evaluation.mainRuns]).toEqual([
      false,
      1,
      3,
    ]);
    expect(evaluation.failures).toEqual([]);
    const b6 = result(evaluation, 'B6');
    expect([b6?.status, b6?.baseline, b6?.limit]).toEqual(['missed', null, null]);
    const markdown = reportMarkdown(evaluation, [], { machine: {}, notes: [] });
    expect(markdown).toContain(
      "Report only: 1 of 3 runs on `main` are recorded on this run's processor, EPYC 9V45 (3 on `main` on any processor)",
    );
    expect(evaluate(measured(0.5), oneEach, 'Unseen CPU').processorRuns).toBe(0);
  });

  it('count no run kept as information, even on the same processor', () => {
    const pullRequest = recordedRun('perf/33-x', { B6: 5 }, { at: 3 });
    const baseline = { runs: [onMain(1, 5), onMain(2, 5), pullRequest], followUps: {} };
    const evaluation = evaluate(measured(0.5, { B6: [40] }), baseline, PROCESSOR);
    expect([evaluation.gating, evaluation.processorRuns, evaluation.failures]).toEqual([
      false,
      2,
      [],
    ]);
  });
});
