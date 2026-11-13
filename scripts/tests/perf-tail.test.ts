import { describe, expect, it } from 'vitest';

import { REPOSITORY } from '../lib/perf-baseline.ts';
import { evaluate } from '../lib/perf-report.ts';
import {
  SLOW_FRAME,
  frameTail,
  missRates,
  parseTailReport,
  processorName,
  readTailReport,
  readTailReports,
  tailMarkdown,
  tailRows,
} from '../lib/perf-tail.ts';

// B1's tail across CI performance reports
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-41-decided): each report's B1
// and B2 at the median and at their budgets' 95th percentile, its frames of 9 ms or more, and
// how often each processor model missed.

const EPYC = 'AMD EPYC 7763 64-Core Processor';
const OTHER = 'AMD EPYC 9V74 80-Core Processor';

interface Options {
  readonly attempt?: number;
  readonly branch?: string;
  readonly event?: string;
}

/** A report.json of CI run `id` on `processor`, with the B1 and B2 samples given. */
function report(id: number, processor: string, [b1, b2]: number[][], options: Options = {}) {
  const { attempt = 1, branch = 'main', event = 'push' } = options;
  return {
    run: {
      branch,
      event,
      commit: String(id % 10).repeat(40),
      url: `https://github.com/${REPOSITORY}/actions/runs/${String(id)}/attempts/${String(attempt)}`,
    },
    machine: { Processor: processor },
    measurements: [
      { id: 'B5', samples: [0.05] },
      { id: 'B1', samples: b1 },
      { id: 'B2', samples: b2 },
    ],
  };
}

describe('frameTail', () => {
  it('reads the median, the 95th percentile and the frames of 9 ms or more, as the report does', () => {
    const tail = frameTail([7, 10, 7, 9, 7], 8);
    expect(tail).toMatchObject({ median: 7, slow: 2, samples: 5, met: false });
    expect(tail.p95).toBeCloseTo(9.8, 9);
    expect(SLOW_FRAME).toBe(9);
    expect(frameTail([8.99, 6, 7], 8)).toMatchObject({ slow: 0, met: false });
    expect(frameTail([6, 7, 8], 8).met).toBe(true);
    expect(frameTail([8, 8], 8).met).toBe(true);
  });
});

describe('readTailReport', () => {
  it("reads a report's run, processor and B1 and B2 samples", () => {
    const read = readTailReport(report(42, EPYC, [[7, 8], [1.5]]), 'report.json');
    expect(read.run.url).toBe(`https://github.com/${REPOSITORY}/actions/runs/42/attempts/1`);
    expect([read.processor, read.b1, read.b2]).toEqual([EPYC, [7, 8], [1.5]]);
  });

  it('reads the last of two measurements with one id, as the performance report does', () => {
    const measurements = [
      { id: 'B1', samples: [20, 20] },
      { id: 'B2', samples: [1] },
      { id: 'B1', samples: [7, 8] },
    ];
    const read = readTailReport({ ...report(42, EPYC, [[], []]), measurements }, 'report.json');
    expect(read.b1).toEqual([7, 8]);
    const evaluation = evaluate(measurements, { runs: [], followUps: {} }, EPYC);
    const b1 = evaluation.results.find(({ budget }) => budget.id === 'B1');
    expect(frameTail(read.b1, 8).p95).toBe(b1?.value);
  });

  it('refuses a report without a run, a processor or the B1 and B2 samples, naming the file', () => {
    const good = report(42, EPYC, [[7], [1]]);
    const refused = [
      null,
      { ...good, run: { ...good.run, url: 4 } },
      { ...good, machine: {} },
      { ...good, measurements: good.measurements.filter(({ id }) => id !== 'B2') },
      { ...good, measurements: [{ id: 'B1', samples: [] }, good.measurements[2]] },
    ];
    for (const value of refused) {
      expect(() => readTailReport(value, 'r7.json')).toThrow(/^r7\.json /u);
    }
  });
});

describe('parseTailReport', () => {
  it("reads a report.json's text, and refuses text that is not JSON, naming the file", () => {
    const read = parseTailReport(JSON.stringify(report(42, EPYC, [[7], [1]])), 'r1.json');
    expect([read.processor, read.b1, read.b2]).toEqual([EPYC, [7], [1]]);
    expect(() => parseTailReport('{"run":', 'r1.json')).toThrow(/^r1\.json is not JSON: /u);
    expect(() => parseTailReport('[]', 'r2.json')).toThrow(/^r2\.json is not a performance /u);
  });
});

describe('readTailReports', () => {
  const ci = JSON.stringify(report(42, EPYC, [[7], [1]]));
  const local = report(1, EPYC, [[7], [1]]);
  const atHome = (branch: string) =>
    JSON.stringify({ ...local, run: { ...local.run, url: 'local', event: 'local', branch } });

  it('reads every input, each once', () => {
    const inputs = [
      { file: 'a/r42.json', text: ci },
      { file: 'r42-2.json', text: JSON.stringify(report(42, EPYC, [[7], [1]], { attempt: 2 })) },
      { file: 'home-1.json', text: atHome('main') },
      { file: 'home-2.json', text: atHome('perf/49-x') },
    ];
    expect(readTailReports(inputs).map(({ run }) => run.url)).toEqual([
      `https://github.com/${REPOSITORY}/actions/runs/42/attempts/1`,
      `https://github.com/${REPOSITORY}/actions/runs/42/attempts/2`,
      'local',
      'local',
    ]);
  });

  it('refuses a report passed twice: the same file, CI run and attempt, or content', () => {
    const twice = (first: [string, string], second: [string, string]) => () =>
      readTailReports([first, second].map(([file, text]) => ({ file, text })));
    expect(twice(['home-1.json', atHome('main')], ['./home-1.json', atHome('main')])).toThrow(
      './home-1.json is the same report as home-1.json: the same file.',
    );
    expect(twice(['a/r42.json', ci], ['b/r42.json', `${ci}\n`])).toThrow(
      `b/r42.json is the same report as a/r42.json: CI run 42, attempt 1, of ${REPOSITORY}.`,
    );
    expect(twice(['home-1.json', atHome('main')], ['copy.json', atHome('main')])).toThrow(
      'copy.json is the same report as home-1.json: the same content.',
    );
  });
});

describe('processorName', () => {
  it("shortens Node.js's names of the CI runners' processors, keeping any other name", () => {
    expect(processorName(EPYC)).toBe('EPYC 7763');
    expect(processorName('INTEL(R) XEON(R) PLATINUM 8573C')).toBe('Xeon Platinum 8573C');
    expect(processorName('Intel(R) Xeon(R) Platinum 8370C CPU @ 2.80GHz')).toBe(
      'Xeon Platinum 8370C',
    );
    expect(processorName('Test CPU A')).toBe('Test CPU A');
    expect(processorName('AMD EPYC Processor (with IBPB)')).toBe('AMD EPYC Processor (with IBPB)');
  });
});

describe('tailRows and missRates', () => {
  const reports = [
    report(9, OTHER, [
      [6, 6, 6],
      [1, 1, 5],
    ]),
    report(7, EPYC, [
      [7, 10, 10],
      [1.5, 1.6],
    ]),
    report(
      7,
      EPYC,
      [
        [7, 7, 7],
        [1.5, 1.6],
      ],
      { attempt: 2 },
    ),
    report(8, OTHER, [[6, 7], [1.4]], { branch: 'perf/41-x', event: 'workflow_dispatch' }),
  ].map((value) => readTailReport(value, 'report.json'));

  it('orders the reports by run and attempt, each with its B1 and B2 against their budgets', () => {
    const rows = tailRows(reports);
    expect(rows.map(({ id, attempt }) => [id, attempt])).toEqual([
      [7, 1],
      [7, 2],
      [8, 1],
      [9, 1],
    ]);
    expect(rows[0]?.b1).toEqual({ median: 10, p95: 10, slow: 2, samples: 3, met: false });
    expect(rows[3]?.b2.met).toBe(false);
  });

  it('counts the reports and the misses of B1 and of B2 per processor model, then in all', () => {
    expect(missRates(tailRows(reports))).toEqual([
      { processor: EPYC, reports: 2, b1Missed: 1, b2Missed: 0 },
      { processor: OTHER, reports: 2, b1Missed: 0, b2Missed: 1 },
      { processor: 'All', reports: 4, b1Missed: 1, b2Missed: 1 },
    ]);
  });

  it('renders the reports and the miss rates as Markdown tables', () => {
    const markdown = tailMarkdown(tailRows(reports));
    expect(markdown).toContain(
      '| CI run (attempt) | Event | Branch | Commit | Processor | B1 median | B1 95th | B1 frames ≥ 9 ms | B2 median | B2 95th | Result |',
    );
    expect(markdown).toContain(
      '| 7 (1) | push | main | `7777777` | EPYC 7763 | 10 ms | 10 ms | 2 of 3 | 1.55 ms | 1.595 ms | B1 missed |',
    );
    expect(markdown).toContain(
      '| 8 (1) | workflow_dispatch | perf/41-x | `8888888` | EPYC 9V74 | 6.5 ms | 6.95 ms | 0 of 2 | 1.4 ms | 1.4 ms | met |',
    );
    expect(markdown).toContain('| 9 (1) | push | main | `9999999` | EPYC 9V74 | 6 ms | 6 ms |');
    expect(markdown).toContain('| 4.6 ms | B2 missed |');
    expect(markdown).toContain('| Processor | Reports | B1 missed | B2 missed |');
    expect(markdown).toContain('| EPYC 7763 | 2 | 1 | 0 |');
    expect(markdown).toContain('| All | 4 | 1 | 1 |');
  });

  it("puts another repository's CI run after this repository's, named by its whole address", () => {
    const fork = report(3, EPYC, [[7], [1]]);
    const url = 'https://github.com/fork/planewright/actions/runs/3/attempts/1';
    const value = { ...fork, run: { ...fork.run, url } };
    const rows = tailRows([readTailReport(value, 'fork.json'), ...reports]);
    expect(rows.map(({ id }) => id)).toEqual([7, 7, 8, 9, Number.POSITIVE_INFINITY]);
    expect(tailMarkdown(rows)).toContain(`| ${url} | push | main | \`3333333\` | EPYC 7763 |`);
  });

  it("puts a local report after the CI runs, named by its run's address", () => {
    const local = report(1, 'INTEL(R) XEON(R) PLATINUM 8573C', [[7], [1]]);
    const value = { ...local, run: { ...local.run, url: 'local', event: 'local' } };
    const rows = tailRows([readTailReport(value, 'local.json'), ...reports]);
    expect(rows.map(({ id }) => id)).toEqual([7, 7, 8, 9, Number.POSITIVE_INFINITY]);
    expect(tailMarkdown(rows)).toContain(
      '| local | local | main | `1111111` | Xeon Platinum 8573C | 7 ms | 7 ms | 0 of 1 |',
    );
  });
});
