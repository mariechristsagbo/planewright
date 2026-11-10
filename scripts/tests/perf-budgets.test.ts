import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  PERF_BUDGETS,
  PERF_INFO,
  benchMeasurements,
  budgetTable,
  percentile,
  statisticOf,
} from '../lib/perf-budgets.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUALITY = readFileSync(join(ROOT, 'docs/architecture/engine/quality.md'), 'utf8');

describe('percentile', () => {
  it('interpolates linearly between the closest ranks', () => {
    expect(percentile([5, 1, 4, 2, 3], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([0, 10], 0.95)).toBe(9.5);
    expect(
      percentile(
        Array.from({ length: 101 }, (_, at) => at),
        0.95,
      ),
    ).toBe(95);
    expect(percentile([7], 0.95)).toBe(7);
  });

  it('refuses no samples, a sample that is not a finite number and a share outside [0, 1]', () => {
    expect(() => percentile([], 0.5)).toThrow('no samples');
    expect(() => percentile([1, Number.NaN], 0.5)).toThrow('finite');
    expect(() => percentile([1], 1.5)).toThrow('[0, 1]');
  });
});

describe('statisticOf', () => {
  it('gives the 95th percentile, the largest sample or the one value', () => {
    const samples = Array.from({ length: 21 }, (_, at) => at);
    expect(statisticOf('p95', samples)).toBe(19);
    expect(statisticOf('max', [3, 9, 4])).toBe(9);
    expect(statisticOf('value', [42])).toBe(42);
    expect(() => statisticOf('value', [1, 2])).toThrow('one value');
  });
});

describe('the performance budgets', () => {
  it('are B1 to B14, one per target of the budget table in quality.md', () => {
    expect(PERF_BUDGETS.map(({ id }) => id)).toEqual(
      Array.from({ length: 14 }, (_, at) => `B${String(at + 1)}`),
    );
    const rows = budgetTable(QUALITY);
    expect(rows).toHaveLength(11);
    expect([...new Set(PERF_BUDGETS.map(({ label }) => label))]).toEqual(
      rows.map(({ label }) => label),
    );
  });

  it('say each target and requirement as the table does', () => {
    const rows = new Map(budgetTable(QUALITY).map((row) => [row.label, row]));
    const mismatches = PERF_BUDGETS.filter((budget) => {
      const row = rows.get(budget.label);
      return (
        row === undefined ||
        !row.target.includes(budget.targetText) ||
        !row.requirements.includes(budget.requirement)
      );
    });
    expect(mismatches).toEqual([]);
  });

  it('measure B14, the heap, by hand only, and every other budget in CI', () => {
    expect(PERF_BUDGETS.filter(({ source }) => source === 'manual').map(({ id }) => id)).toEqual([
      'B14',
    ]);
    expect(PERF_BUDGETS.find(({ id }) => id === 'B4')).toMatchObject({
      target: 1,
      unit: 'frames',
      statistic: 'max',
    });
  });

  it('keep the measurements that are no budget apart, each with what it is read against', () => {
    expect(PERF_INFO.map(({ id }) => id)).toEqual(['I1', 'I2', 'I3', 'I4', 'I5', 'I6']);
    expect(PERF_INFO.every(({ reference }) => reference.length > 0)).toBe(true);
  });

  it('record each measurement that Vitest takes in one of the benchmarks', () => {
    const benchmarks = ['packages/engine/tests/bench', 'apps/web/tests/bench'].flatMap((dir) =>
      readdirSync(join(ROOT, dir)).map((name) => readFileSync(join(ROOT, dir, name), 'utf8')),
    );
    const recorded = (id: string) => benchmarks.some((text) => text.includes(`budget: '${id}'`));
    const measured = [...PERF_BUDGETS, ...PERF_INFO].filter(({ source }) => source === 'bench');
    expect(measured.map(({ id }) => id)).toEqual(['B5', 'B6', 'B7', 'B8', 'I3', 'I4', 'I5', 'I6']);
    expect(measured.filter(({ id }) => !recorded(id)).map(({ id }) => id)).toEqual([]);
  });
});

describe('budgetTable', () => {
  it('refuses a document without the budget table', () => {
    expect(() => budgetTable('# Quality\n')).toThrow('Performance budgets');
  });
});

/** A Vitest JSON report holding one benchmark test, as `vitest bench --reporter=json` writes it. */
function vitestReport(meta: object, samples: unknown, status = 'passed') {
  return {
    testResults: [
      {
        name: '/repo/packages/engine/tests/bench/hit-test.bench.ts',
        assertionResults: [
          {
            title: 'B5 REQ-F01 a hit test at a point among 10,000 elements',
            status,
            meta,
            benchmarks: [{ name: 'B5', tasks: [{ name: 'B5 hit test', latency: { samples } }] }],
          },
        ],
      },
    ],
  };
}

describe('benchMeasurements', () => {
  const perf = {
    budget: 'B5',
    seed: 15,
    elements: 10_000,
    checked: 'hits',
    clock: 'c',
    runtime: 'r',
  };

  it('reads the samples and the record of each benchmark test', () => {
    expect(benchMeasurements(vitestReport({ perf }, [0.1, 0.3, 0.2]))).toEqual([
      { id: 'B5', samples: [0.1, 0.3, 0.2], details: perf },
    ]);
  });

  it('skips a test without a record, and refuses a failed benchmark test', () => {
    expect(benchMeasurements(vitestReport({}, [0.1]))).toEqual([]);
    expect(() => benchMeasurements(vitestReport({ perf }, [0.1], 'failed'))).toThrow(
      'B5 REQ-F01 a hit test at a point among 10,000 elements failed',
    );
  });

  it('refuses a report other than Vitest JSON report, or samples that are not numbers', () => {
    expect(() => benchMeasurements({})).toThrow('testResults');
    expect(() => benchMeasurements(vitestReport({ perf }, undefined))).toThrow('samples');
    expect(() => benchMeasurements(vitestReport({ perf }, ['1']))).toThrow('samples');
  });
});
