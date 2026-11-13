import { PERF_BUDGETS, PERF_INFO, statisticOf } from './perf-budgets.ts';
import type { Measurement, PerfBudget, PerfUnit } from './perf-budgets.ts';
import { isMainRun } from './perf-baseline.ts';
import type { PerfBaseline, PerfRun } from './perf-baseline.ts';

/**
 * The performance report's rules (docs/architecture/engine/quality.md#what-issue-38-decided):
 * every budget is reported with its value; a budget measured in CI that was not measured, or a
 * bundle over its budget, fails at once. Statistical budgets are compared only with the runs on
 * `main` recorded on the run's own processor model, since runners on different processors measure
 * the same code up to 2.6 times apart: they only report until three such runs are recorded, and
 * from then on a budget that the last three measured fails when its value is more than 20 % worse
 * than its budget or, when the slowest of the three misses the budget, than that slowest run.
 * Which runs count as runs on `main` is perf-baseline.ts's rule.
 */

/** How many runs on `main` on a processor the baseline needs before its budgets can fail CI. */
export const GATE_RUNS = 3;

/** How much worse than its reference a value may be once gated. */
export const TOLERANCE = 0.2;

export type BudgetStatus = 'met' | 'missed' | 'by hand' | 'not measured';

export interface BudgetResult {
  readonly budget: PerfBudget;
  readonly value: number | null;
  readonly samples: number;
  readonly status: BudgetStatus;
  /** The slowest of the last three runs on `main` on this processor, once all measured it. */
  readonly baseline: number | null;
  /** The value above which the budget fails CI, once gated. */
  readonly limit: number | null;
  readonly followUp: string | null;
}

export interface PerfEvaluation {
  readonly gating: boolean;
  /** The processor model of the run, as Node.js names it. */
  readonly processor: string;
  /** The runs on `main` recorded on that processor. */
  readonly processorRuns: number;
  /** The runs on `main` recorded on any processor. */
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

/** The slowest value of a budget over the last three of the runs, if all three measured it. */
function baselineOf(runs: readonly PerfRun[], id: string): number | null {
  const values = runs.slice(-GATE_RUNS).map((run) => run.values[id]);
  const measured = values.filter((value) => value !== undefined);
  return runs.length >= GATE_RUNS && measured.length === GATE_RUNS ? Math.max(...measured) : null;
}

function resultOf(budget: PerfBudget, found: Measurement | undefined, context: Context) {
  const followUp = context.baseline.followUps[budget.id] ?? null;
  const unmeasured = { budget, value: null, samples: 0, baseline: null, limit: null, followUp };
  if (budget.source === 'manual') return { ...unmeasured, status: 'by hand' as const };
  if (found === undefined) return { ...unmeasured, status: 'not measured' as const };
  const value = statisticOf(budget.statistic, found.samples);
  const baseline = budget.source === 'bundle' ? null : baselineOf(context.processorRuns, budget.id);
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
  /** The runs on `main` on the run's processor, oldest first. */
  readonly processorRuns: readonly PerfRun[];
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

/** The run's measurements against the baseline's runs on `main` on the run's processor model. */
export function evaluate(
  measurements: readonly Measurement[],
  baseline: PerfBaseline,
  processor: string,
): PerfEvaluation {
  const mainRuns = baseline.runs.filter(isMainRun);
  const processorRuns = mainRuns.filter(({ machine }) => machine.Processor === processor);
  const gating = processorRuns.length >= GATE_RUNS;
  const byId = new Map(measurements.map((measurement) => [measurement.id, measurement]));
  const results: BudgetResult[] = PERF_BUDGETS.map((budget) =>
    resultOf(budget, byId.get(budget.id), { baseline, processorRuns }),
  );
  const failures = results.flatMap((result) => failureOf(result, gating));
  return {
    ...{ gating, processor, processorRuns: processorRuns.length, mainRuns: mainRuns.length },
    ...{ results, failures },
  };
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

const gatedMode = ({ processor, processorRuns }: PerfEvaluation): string =>
  `Gated: ${String(processorRuns)} runs on \`main\` are recorded on this run's processor, ${processor}, so a budget more than 20 % worse than its budget, or than the slowest of the last three of them when that misses the budget, fails CI.`;

const reportOnlyMode = ({ processor, processorRuns, mainRuns }: PerfEvaluation): string =>
  `Report only: ${String(processorRuns)} of ${String(GATE_RUNS)} runs on \`main\` are recorded on this run's processor, ${processor} (${String(mainRuns)} on \`main\` on any processor), so no statistical budget fails CI yet; a measurement that is missing or a bundle over its budget does.`;

/**
 * The report as Markdown: the mode, the budgets, the other measurements, any further sections,
 * such as the traces, the machine and the notes.
 */
export function reportMarkdown(
  evaluation: PerfEvaluation,
  infos: readonly Measurement[],
  context: {
    readonly machine: Readonly<Record<string, string>>;
    readonly notes: readonly string[];
    readonly sections?: readonly string[];
  },
): string {
  const mode = evaluation.gating ? gatedMode(evaluation) : reportOnlyMode(evaluation);
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
    ...(context.sections ?? []),
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
