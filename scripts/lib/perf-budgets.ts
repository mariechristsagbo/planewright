/**
 * The performance budgets of docs/architecture/engine/quality.md#performance-budgets, one per
 * target of its table, with the statistic each is read by, and the statistics themselves. The
 * report (`scripts/perf-report.ts`) compares every measurement with these; a test checks that they
 * say what the table says.
 */

export type PerfUnit = 'ms' | 's' | 'KB' | 'frames' | 'tasks' | 'MB';

/** How a budget reads its samples: their 95th percentile, the largest, or the one value. */
export type PerfStatistic = 'p95' | 'max' | 'value';

/** Where a measurement comes from: Vitest benchmarks, Playwright, the bundle check, or by hand. */
export type PerfSource = 'bench' | 'browser' | 'bundle' | 'manual';

export interface PerfBudget {
  readonly id: string;
  /** The table's Budget cell, which several targets of one row share. */
  readonly label: string;
  /** The words of the table's Target cell that state this target. */
  readonly targetText: string;
  readonly target: number;
  readonly unit: PerfUnit;
  readonly statistic: PerfStatistic;
  readonly source: PerfSource;
  readonly requirement: string;
}

const budget = (
  id: string,
  label: string,
  [targetText, target, unit]: readonly [string, number, PerfUnit],
  [statistic, source, requirement]: readonly [PerfStatistic, PerfSource, string],
): PerfBudget => ({ id, label, targetText, target, unit, statistic, source, requirement });

const AUTOSAVE = 'Autosave of a 50-element change, main-thread time';
const BUNDLE = 'Bundle size, minified and gzip-compressed';

export const PERF_BUDGETS: readonly PerfBudget[] = [
  budget(
    'B1',
    'Scene layer redraw, 5,000 elements all visible',
    ['≤ 8 ms, 95th percentile', 8, 'ms'],
    ['p95', 'browser', 'REQ-F01'],
  ),
  budget(
    'B2',
    'Scene layer redraw while panning, 5,000 elements, a tenth visible',
    ['≤ 4 ms, 95th percentile', 4, 'ms'],
    ['p95', 'browser', 'REQ-F01'],
  ),
  budget(
    'B3',
    'Overlay layer redraw',
    ['≤ 1 ms, 95th percentile', 1, 'ms'],
    ['p95', 'browser', 'REQ-F02'],
  ),
  budget(
    'B4',
    'From a pointer event to the frame that shows it',
    ['the next animation frame', 1, 'frames'],
    ['max', 'browser', 'REQ-F02'],
  ),
  budget(
    'B5',
    'Hit test at a point, 10,000 elements',
    ['≤ 0.2 ms', 0.2, 'ms'],
    ['p95', 'bench', 'REQ-F01'],
  ),
  budget('B6', 'Marquee query, 10,000 elements', ['≤ 2 ms', 2, 'ms'], ['p95', 'bench', 'REQ-F01']),
  budget(
    'B7',
    'Apply a change set moving 1,000 elements, indexes included',
    ['≤ 4 ms', 4, 'ms'],
    ['p95', 'bench', 'REQ-F01'],
  ),
  budget('B8', AUTOSAVE, ['≤ 4 ms', 4, 'ms'], ['p95', 'bench', 'REQ-F03']),
  budget('B9', AUTOSAVE, ['no task over 50 ms', 0, 'tasks'], ['max', 'browser', 'REQ-F03']),
  budget(
    'B10',
    'Cached load to the first editor frame, 1,000 elements',
    ['≤ 1.5 s', 1.5, 's'],
    ['p95', 'browser', 'REQ-F04'],
  ),
  budget('B11', BUNDLE, ['engine ≤ 60 KB', 60, 'KB'], ['value', 'bundle', 'REQ-F04']),
  budget('B12', BUNDLE, ['renderer ≤ 15 KB', 15, 'KB'], ['value', 'bundle', 'REQ-F04']),
  budget(
    'B13',
    BUNDLE,
    ["web app's initial JavaScript ≤ 200 KB", 200, 'KB'],
    ['value', 'bundle', 'REQ-F04'],
  ),
  budget(
    'B14',
    'JavaScript heap, 10,000 elements and a full history',
    ['≤ 150 MB', 150, 'MB'],
    ['max', 'manual', 'REQ-F01'],
  ),
];

/** A measurement that is no budget, reported beside them with what it is read against. */
export interface PerfInfo {
  readonly id: string;
  readonly label: string;
  readonly unit: PerfUnit;
  readonly statistic: PerfStatistic;
  readonly source: PerfSource;
  readonly reference: string;
}

export const PERF_INFO: readonly PerfInfo[] = [
  {
    id: 'I1',
    label: 'Main-thread time of a pan step, 5,000 elements, 101 options listed',
    unit: 'ms',
    statistic: 'p95',
    source: 'browser',
    reference: 'one frame at 60 Hz, 16.7 ms (REQ-F01); the element list renders again on each pan',
  },
  {
    id: 'I2',
    label: 'Main-thread time of a pan step, the 101 listed options 100,000-character texts',
    unit: 'ms',
    statistic: 'p95',
    source: 'browser',
    reference: 'one frame at 60 Hz, 16.7 ms (REQ-F01); the names of long texts',
  },
  {
    id: 'I3',
    label: 'Naming the 101 listed options, each a 100,000-character text',
    unit: 'ms',
    statistic: 'p95',
    source: 'bench',
    reference: 'the part of a pan step that the element list spends on names',
  },
  {
    id: 'I4',
    label: 'First whole-scene marquee query after one of 10,000 elements moved',
    unit: 'ms',
    statistic: 'p95',
    source: 'bench',
    reference:
      "B6's 2 ms, which times queries of an unchanged scene only; a marquee's release follows a change",
  },
  {
    id: 'I5',
    label: 'First whole-scene marquee query after 1,000 of 10,000 elements moved',
    unit: 'ms',
    statistic: 'p95',
    source: 'bench',
    reference: "B6's 2 ms, as I4; the rows of the moved elements are made again",
  },
  {
    id: 'I6',
    label: 'First whole-scene marquee query of 10,000 elements just loaded',
    unit: 'ms',
    statistic: 'p95',
    source: 'bench',
    reference: "B6's 2 ms, as I4; every row is made",
  },
];

/** The value at share `p` of the sorted samples, interpolated linearly between the closest ranks. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) throw new RangeError('A percentile of no samples is undefined.');
  if (!samples.every(Number.isFinite)) throw new RangeError('Every sample must be finite.');
  if (!(p >= 0 && p <= 1)) throw new RangeError(`A share must be in [0, 1], not ${String(p)}.`);
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const below = sorted[Math.floor(rank)] ?? Number.NaN;
  const above = sorted[Math.ceil(rank)] ?? Number.NaN;
  return below + (above - below) * (rank - Math.floor(rank));
}

export function statisticOf(statistic: PerfStatistic, samples: readonly number[]): number {
  if (statistic === 'p95') return percentile(samples, 0.95);
  if (statistic === 'max') return percentile(samples, 1);
  const [value] = samples;
  if (samples.length !== 1 || value === undefined) {
    throw new RangeError(`A value budget reads one value, not ${String(samples.length)}.`);
  }
  return value;
}

export interface BudgetRow {
  readonly label: string;
  readonly target: string;
  readonly measuredBy: string;
  readonly requirements: string;
}

/** The rows of the "Performance budgets" table in quality.md. */
export function budgetTable(markdown: string): BudgetRow[] {
  const start = markdown.indexOf('\n## Performance budgets\n');
  if (start < 0) throw new Error('quality.md has no "## Performance budgets" section.');
  const section = markdown.slice(start + 1).split('\n## ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !/^\| (?:Budget|-+) /u.test(line))
    .map((line) => {
      const [label = '', target = '', measuredBy = '', requirements = ''] = line
        .slice(2, -2)
        .split(' | ')
        .map((cell) => cell.trim());
      return { label, target, measuredBy, requirements };
    });
}

/** Samples of one budget or other measurement, in its unit, and what the run recorded about it. */
export interface Measurement {
  readonly id: string;
  readonly samples: readonly number[];
  readonly details?: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const listOf = (value: unknown, what: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(`The Vitest JSON report has no ${what} list.`);
  return value;
};

/** The samples of a test's one benchmark task, in milliseconds. */
function samplesOf(test: Readonly<Record<string, unknown>>, id: string): number[] {
  const [benchmark] = listOf(test['benchmarks'], 'benchmarks');
  const [task] = isRecord(benchmark) ? listOf(benchmark['tasks'], 'tasks') : [];
  const latency = isRecord(task) ? task['latency'] : undefined;
  const samples = isRecord(latency) ? latency['samples'] : undefined;
  if (!Array.isArray(samples) || !samples.every((sample) => typeof sample === 'number')) {
    throw new Error(`The benchmark of ${id} has no samples of numbers; retain them.`);
  }
  return samples;
}

/**
 * The measurements in Vitest's JSON report of `npm run perf:bench`: every benchmark test whose
 * meta holds a `perf` record naming its budget gives that budget its samples and the record.
 */
export function benchMeasurements(report: unknown): Measurement[] {
  return listOf(isRecord(report) ? report['testResults'] : undefined, 'testResults')
    .flatMap((file) => (isRecord(file) ? listOf(file['assertionResults'], 'assertionResults') : []))
    .filter(isRecord)
    .flatMap((test) => {
      const perf = isRecord(test['meta']) ? test['meta']['perf'] : undefined;
      if (!isRecord(perf) || typeof perf['budget'] !== 'string') return [];
      if (test['status'] !== 'passed') throw new Error(`${String(test['title'])} failed.`);
      return [{ id: perf['budget'], samples: samplesOf(test, perf['budget']), details: perf }];
    });
}
