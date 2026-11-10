import { PERF_BUDGETS, percentile, statisticOf } from './perf-budgets.ts';
import { runAddress } from './perf-baseline.ts';
import type { ReportedRun } from './perf-baseline.ts';
import { formatValue, readMeasurement } from './perf-report.ts';

/**
 * B1's tail across CI performance reports
 * (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-41-decided): for each
 * report.json, B1 and B2 at the median and at their budgets' 95th percentile, B1's frames of
 * 9 ms or more, which make a missing run's second group of frames, and per processor model how
 * many reports missed each budget. It reads the reports only; what B1 measures, its budget and
 * the gate are the performance report's.
 */

/** The frame duration, in ms, from which a frame of B1 counts as slow. */
export const SLOW_FRAME = 9;

export interface TailReport {
  readonly run: ReportedRun['run'];
  /** The processor model, as Node.js names it. */
  readonly processor: string;
  readonly b1: readonly number[];
  readonly b2: readonly number[];
}

export interface FrameTail {
  readonly median: number;
  /** The budget's statistic, the 95th percentile. */
  readonly p95: number;
  /** How many frames took SLOW_FRAME ms or more. */
  readonly slow: number;
  readonly samples: number;
  readonly met: boolean;
}

export interface TailRow {
  readonly id: number;
  readonly attempt: number;
  readonly report: TailReport;
  readonly b1: FrameTail;
  readonly b2: FrameTail;
}

/** What a miss rate reads of a report: its processor model and whether it met B1 and B2. */
export interface MissRow {
  readonly report: Pick<TailReport, 'processor'>;
  readonly b1: Pick<FrameTail, 'met'>;
  readonly b2: Pick<FrameTail, 'met'>;
}

export interface MissRate {
  readonly processor: string;
  readonly reports: number;
  readonly b1Missed: number;
  readonly b2Missed: number;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RUN_FIELDS = ['branch', 'event', 'commit', 'url'] as const;

function samplesOf(measurements: readonly unknown[], id: string, file: string): number[] {
  const found = measurements.find((each) => isRecord(each) && each['id'] === id);
  if (found === undefined) throw new Error(`${file} has no ${id} measurement.`);
  return [...readMeasurement(found, file).samples];
}

/** A report.json's run, processor and B1 and B2 samples, refusing anything else. */
export function readTailReport(value: unknown, file: string): TailReport {
  const { run, machine, measurements } = isRecord(value) ? value : {};
  const validRun = isRecord(run) && RUN_FIELDS.every((field) => typeof run[field] === 'string');
  const processor = isRecord(machine) ? machine['Processor'] : undefined;
  if (!validRun || typeof processor !== 'string' || !Array.isArray(measurements)) {
    throw new Error(`${file} is not a performance report with its run and processor.`);
  }
  return {
    run: run as unknown as ReportedRun['run'],
    processor,
    b1: samplesOf(measurements, 'B1', file),
    b2: samplesOf(measurements, 'B2', file),
  };
}

/** The samples' median, 95th percentile and slow frames, and whether they meet `target`. */
export function frameTail(samples: readonly number[], target: number): FrameTail {
  const p95 = statisticOf('p95', samples);
  return {
    median: percentile(samples, 0.5),
    p95,
    slow: samples.filter((sample) => sample >= SLOW_FRAME).length,
    samples: samples.length,
    met: p95 <= target,
  };
}

const targetOf = (id: string): number => {
  const budget = PERF_BUDGETS.find((each) => each.id === id);
  if (budget === undefined) throw new Error(`No budget is named ${id}.`);
  return budget.target;
};

/** Each report with its B1 and B2, in the order of the CI runs and their attempts. */
export function tailRows(reports: readonly TailReport[]): TailRow[] {
  return reports
    .map((report) => {
      const address = runAddress(report.run.url);
      return {
        id: address?.id ?? Number.POSITIVE_INFINITY,
        attempt: address?.attempt ?? 0,
        report,
        b1: frameTail(report.b1, targetOf('B1')),
        b2: frameTail(report.b2, targetOf('B2')),
      };
    })
    .sort((a, b) => a.id - b.id || a.attempt - b.attempt);
}

/** The reports and misses per processor model, in the order of their first report, then all. */
export function missRates(rows: readonly MissRow[]): MissRate[] {
  const count = (processor: string, of: readonly MissRow[]): MissRate => ({
    processor,
    reports: of.length,
    b1Missed: of.filter(({ b1 }) => !b1.met).length,
    b2Missed: of.filter(({ b2 }) => !b2.met).length,
  });
  const processors = [...new Set(rows.map(({ report }) => report.processor))];
  return [
    ...processors.map((processor) =>
      count(
        processor,
        rows.filter(({ report }) => report.processor === processor),
      ),
    ),
    count('All', rows),
  ];
}

/** A numbered processor model without its vendor's marks: "EPYC 7763", "Xeon Platinum 8370C". */
export function processorName(name: string): string {
  const epyc = /\bEPYC (\w*\d\w*)/u.exec(name);
  if (epyc !== null) return `EPYC ${epyc[1] ?? ''}`;
  const xeon = /\bXEON\(R\) PLATINUM (\w*\d\w*)/iu.exec(name);
  return xeon === null ? name : `Xeon Platinum ${(xeon[1] ?? '').toUpperCase()}`;
}

const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
const ms = (value: number): string => `${formatValue(value)} ms`;

function resultOf({ b1, b2 }: TailRow): string {
  const missed = [...(b1.met ? [] : ['B1']), ...(b2.met ? [] : ['B2'])];
  return missed.length === 0 ? 'met' : `${missed.join(' and ')} missed`;
}

function reportRow(tail: TailRow): string {
  const { id, attempt, report, b1, b2 } = tail;
  const run = Number.isFinite(id) ? `${String(id)} (${String(attempt)})` : report.run.url;
  return row([
    ...[run, report.run.event, report.run.branch, `\`${report.run.commit.slice(0, 7)}\``],
    ...[processorName(report.processor), ms(b1.median), ms(b1.p95)],
    ...[`${String(b1.slow)} of ${String(b1.samples)}`, ms(b2.median), ms(b2.p95), resultOf(tail)],
  ]);
}

const REPORT_HEADER = [
  ...['CI run (attempt)', 'Event', 'Branch', 'Commit', 'Processor', 'B1 median', 'B1 95th'],
  ...[`B1 frames ≥ ${String(SLOW_FRAME)} ms`, 'B2 median', 'B2 95th', 'Result'],
];
const RATE_HEADER = ['Processor', 'Reports', 'B1 missed', 'B2 missed'];

/** The reports, then the misses per processor model, as Markdown tables. */
export function tailMarkdown(rows: readonly TailRow[]): string {
  const rates = missRates(rows).map(({ processor, reports, b1Missed, b2Missed }) =>
    row([processorName(processor), ...[reports, b1Missed, b2Missed].map(String)]),
  );
  return [
    row(REPORT_HEADER),
    row(REPORT_HEADER.map(() => '---')),
    ...rows.map(reportRow),
    '',
    row(RATE_HEADER),
    row(RATE_HEADER.map(() => '---')),
    ...rates,
    '',
  ].join('\n');
}
