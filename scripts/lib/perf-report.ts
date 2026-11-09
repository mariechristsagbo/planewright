import { PERF_BUDGETS, PERF_INFO, statisticOf } from './perf-budgets.ts';
import type { Measurement, PerfBudget, PerfUnit } from './perf-budgets.ts';

/**
 * The performance report's rules (docs/architecture/engine/quality.md#performance-budgets): every
 * budget is reported with its value; a budget measured in CI that was not measured, or a bundle
 * over its budget, fails at once; statistical budgets only report until three runs on `main` are
 * recorded in the baseline, and from then on a budget that those runs measured fails when its
 * value is more than 20 % worse than its budget or, when the baseline misses the budget, than the
 * baseline.
 */

/** How many runs on `main` the baseline needs before statistical budgets can fail CI. */
export const GATE_RUNS = 3;

/** How much worse than its reference a value may be once gated. */
export const TOLERANCE = 0.2;

/** One CI run's values, as the baseline file keeps them. */
export interface PerfRun {
  readonly label: string;
  readonly branch: string;
  readonly event: string;
  readonly commit: string;
  /** The CI run's address. */
  readonly run: string;
  readonly date: string;
  readonly values: Readonly<Record<string, number>>;
}

export interface PerfBaseline {
  readonly runs: readonly PerfRun[];
  /** The issue that will fix each missed budget, by budget. */
  readonly followUps: Readonly<Record<string, string>>;
}

export type BudgetStatus = 'met' | 'missed' | 'by hand' | 'not measured';

export interface BudgetResult {
  readonly budget: PerfBudget;
  readonly value: number | null;
  readonly samples: number;
  readonly status: BudgetStatus;
  /** The slowest of the last three runs on `main`, once they all measured the budget. */
  readonly baseline: number | null;
  /** The value above which the budget fails CI, once gated. */
  readonly limit: number | null;
  readonly followUp: string | null;
}

export interface PerfEvaluation {
  readonly gating: boolean;
  readonly mainRuns: number;
  readonly results: readonly BudgetResult[];
  /** Why CI fails, if it does. */
  readonly failures: readonly string[];
}

/** A value rounded to three decimals, as the report writes it. */
export const formatValue = (value: number): string => String(Math.round(value * 1000) / 1000);

const UNIT_WORDS: Readonly<Partial<Record<PerfUnit, readonly [string, string]>>> = {
  frames: ['frame', 'frames'],
  tasks: ['task', 'tasks'],
};

export function withUnit(value: number, unit: PerfUnit): string {
  const words = UNIT_WORDS[unit];
  const name = words === undefined ? unit : words[value === 1 ? 0 : 1];
  return `${formatValue(value)} ${name}`;
}

/** The slowest value of a budget over the last three runs on main, if all three measured it. */
function baselineOf(mainRuns: readonly PerfRun[], id: string): number | null {
  const values = mainRuns.slice(-GATE_RUNS).map((run) => run.values[id]);
  const measured = values.filter((value) => value !== undefined);
  return mainRuns.length >= GATE_RUNS && measured.length === GATE_RUNS
    ? Math.max(...measured)
    : null;
}

function resultOf(budget: PerfBudget, found: Measurement | undefined, context: Context) {
  const followUp = context.baseline.followUps[budget.id] ?? null;
  const unmeasured = { budget, value: null, samples: 0, baseline: null, limit: null, followUp };
  if (budget.source === 'manual') return { ...unmeasured, status: 'by hand' as const };
  if (found === undefined) return { ...unmeasured, status: 'not measured' as const };
  const value = statisticOf(budget.statistic, found.samples);
  const baseline = budget.source === 'bundle' ? null : baselineOf(context.mainRuns, budget.id);
  return {
    ...unmeasured,
    value,
    samples: found.samples.length,
    status: value <= budget.target ? ('met' as const) : ('missed' as const),
    baseline,
    limit: baseline === null ? null : Math.max(budget.target, baseline) * (1 + TOLERANCE),
  };
}

interface Context {
  readonly baseline: PerfBaseline;
  readonly mainRuns: readonly PerfRun[];
}

function failureOf({ budget, value, status, limit }: BudgetResult, gating: boolean) {
  const name = `${budget.id} ${budget.label}`;
  if (status === 'not measured') return [`${name} was not measured.`];
  if (value === null) return [];
  const shown = withUnit(value, budget.unit);
  if (budget.source === 'bundle' && status === 'missed') {
    return [`${name} is ${shown}, over its budget of ${withUnit(budget.target, budget.unit)}.`];
  }
  // A relative margin of 1e-9 keeps a value exactly at the limit from failing by rounding.
  if (!gating || limit === null || value <= limit * (1 + 1e-9)) return [];
  const reference = withUnit(limit / (1 + TOLERANCE), budget.unit);
  return [`${name} is ${shown}, more than 20 % worse than ${reference}.`];
}

export function evaluate(measurements: readonly Measurement[], baseline: PerfBaseline) {
  const mainRuns = baseline.runs.filter(({ branch }) => branch === 'main');
  const gating = mainRuns.length >= GATE_RUNS;
  const byId = new Map(measurements.map((measurement) => [measurement.id, measurement]));
  const results: BudgetResult[] = PERF_BUDGETS.map((budget) =>
    resultOf(budget, byId.get(budget.id), { baseline, mainRuns }),
  );
  const failures = results.flatMap((result) => failureOf(result, gating));
  return { gating, mainRuns: mainRuns.length, results, failures } satisfies PerfEvaluation;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length > 0 && value.every(Number.isFinite);

/** A browser or bundle measurement file's content, checked. */
export function readMeasurement(value: unknown, file: string): Measurement {
  if (!isRecord(value) || typeof value['id'] !== 'string' || !isFiniteList(value['samples'])) {
    throw new Error(`${file} is not a measurement: it needs an id and finite samples.`);
  }
  const { details } = value;
  return {
    id: value['id'],
    samples: value['samples'],
    ...(isRecord(details) ? { details } : {}),
  };
}

const RUN_FIELDS = ['label', 'branch', 'event', 'commit', 'run', 'date'] as const;

function readRun(value: unknown): PerfRun {
  const valid =
    isRecord(value) &&
    RUN_FIELDS.every((field) => typeof value[field] === 'string') &&
    isRecord(value['values']) &&
    Object.values(value['values']).every(Number.isFinite);
  if (!valid) throw new Error('The performance baseline holds a run that is not well formed.');
  return value as unknown as PerfRun;
}

export function readBaseline(value: unknown): PerfBaseline {
  const runs = isRecord(value) ? value['runs'] : undefined;
  const followUps = isRecord(value) ? value['followUps'] : undefined;
  const validFollowUps =
    isRecord(followUps) && Object.values(followUps).every((ref) => typeof ref === 'string');
  if (!Array.isArray(runs) || !validFollowUps) {
    throw new Error('The performance baseline needs a runs list and a followUps map.');
  }
  return { runs: runs.map(readRun), followUps: followUps as Readonly<Record<string, string>> };
}

/** What a report says about its CI run, which a baseline run records. */
export interface ReportedRun {
  readonly run: {
    readonly branch: string;
    readonly event: string;
    readonly commit: string;
    readonly url: string;
  };
  readonly date: string;
  readonly values: Readonly<Record<string, number>>;
}

/** The baseline with a report's run added: a run on main, or on any branch when asked to. */
export function appendRun(
  baseline: PerfBaseline,
  report: ReportedRun,
  options: { readonly label: string; readonly anyBranch?: boolean },
): PerfBaseline {
  const { branch, event, commit, url } = report.run;
  if (branch !== 'main' && options.anyBranch !== true) {
    throw new Error(`Only runs on main make the baseline; this run is on ${branch}.`);
  }
  if (baseline.runs.some(({ run }) => run === url)) {
    throw new Error(`The baseline already holds ${url}.`);
  }
  const added: PerfRun = {
    ...{ label: options.label, branch, event, commit, run: url },
    ...{ date: report.date, values: report.values },
  };
  return { ...baseline, runs: [...baseline.runs, added] };
}

const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

function budgetRow({ budget, value, samples, status, baseline, limit, followUp }: BudgetResult) {
  const shown = value === null ? status : withUnit(value, budget.unit);
  const said = status === 'missed' && followUp !== null ? `missed, follow-up ${followUp}` : status;
  const optional = (number: number | null) =>
    number === null ? '–' : withUnit(number, budget.unit);
  return row([
    budget.id,
    budget.label,
    budget.targetText,
    shown,
    String(samples),
    said,
    optional(baseline),
    optional(limit),
  ]);
}

function infoRows(infos: readonly Measurement[]): string[] {
  return PERF_INFO.map((info) => {
    const found = infos.find(({ id }) => id === info.id);
    const value =
      found === undefined
        ? 'not measured'
        : withUnit(statisticOf(info.statistic, found.samples), info.unit);
    return row([info.id, info.label, value, String(found?.samples.length ?? 0), info.reference]);
  });
}

/** The report as Markdown: the mode, the budgets, the other measurements, the machine, notes. */
export function reportMarkdown(
  evaluation: PerfEvaluation,
  infos: readonly Measurement[],
  context: {
    readonly machine: Readonly<Record<string, string>>;
    readonly notes: readonly string[];
  },
): string {
  const mode = evaluation.gating
    ? `Gated: ${String(evaluation.mainRuns)} runs on \`main\` are recorded, so a budget more than 20 % worse than its budget or than a baseline that misses it fails CI.`
    : `Report only: ${String(evaluation.mainRuns)} of ${String(GATE_RUNS)} consecutive runs on \`main\` are recorded, so no statistical budget fails CI yet; a measurement that is missing or a bundle over its budget does.`;
  return [
    '## Performance report',
    '',
    mode,
    '',
    row(['Budget', 'What', 'Target', 'Measured', 'Samples', 'Status', 'Baseline', 'Gate limit']),
    row(Array.from({ length: 8 }, () => '---')),
    ...evaluation.results.map(budgetRow),
    '',
    '### Other measurements, no budget',
    '',
    row(['Id', 'What', 'Measured', 'Samples', 'Read against']),
    row(Array.from({ length: 5 }, () => '---')),
    ...infoRows(infos),
    '',
    '### Machine',
    '',
    ...Object.entries(context.machine).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '### Notes',
    '',
    ...context.notes.map((note) => `- ${note}`),
    ...evaluation.failures.map((failure) => `- **Fails CI:** ${failure}`),
    '',
  ].join('\n');
}
