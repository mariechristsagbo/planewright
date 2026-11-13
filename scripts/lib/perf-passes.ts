import { PERF_BUDGETS } from './perf-budgets.ts';
import type { Measurement } from './perf-budgets.ts';
import { formatValue } from './perf-report.ts';
import { SLOW_FRAME, frameTail } from './perf-tail.ts';
import { readJson, traceFiles, traceResult } from './perf-trace.ts';
import type { MeasuredFrame, PassReader, TraceRecord, TraceResult } from './perf-trace.ts';

/**
 * B1's passes (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
 * browser measurements pan B1's scene three times in one job, each pass on a page of its own with
 * the same warm-up and measured pans. The budget pass, which no trace slows, gives B1's samples;
 * the traced pass runs while Chromium traces the browser, and its trace holds exactly its frames;
 * its paired control runs untraced right after it. Only the budget pass is B1's measurement: the
 * trace explains the traced pass's own frames, and the control sets tracing's effect beside the
 * spread of untraced passes. This module reads the control's record, refuses passes that are not
 * one procedure, and gives each pass's tail and their differences.
 */

export type PassName = 'budget' | 'traced' | 'control';

/** One pass as the report gives it, its file relative to perf-results/. */
export interface PassResult {
  readonly pass: PassName;
  readonly traced: boolean;
  readonly file: string;
  readonly warmUp: number;
  readonly frames: number;
  readonly median: number;
  /** The budget's statistic, the 95th percentile. */
  readonly p95: number;
  /** How many frames took SLOW_FRAME ms or more. */
  readonly slow: number;
  /** Whether the pass's 95th percentile is within the budget's target; only the budget pass's is the budget's status. */
  readonly withinTarget: boolean;
}

/** One pass's median, 95th percentile and slow frames less another's. */
export interface PassDifference {
  readonly pass: PassName;
  readonly from: PassName;
  readonly median: number;
  readonly p95: number;
  readonly slow: number;
}

/** What the performance report keeps of a budget's passes and trace. */
export interface PassesResult extends TraceResult {
  /** The paired control's record, relative to perf-results/. */
  readonly control: string;
  readonly passes: readonly PassResult[];
  readonly differences: readonly PassDifference[];
}

/** The record of the traced pass's paired control, beside the trace. */
export interface ControlRecord {
  /** The budget whose pans the control ran again. */
  readonly id: string;
  readonly pass: 'control';
  readonly warmUp: number;
  readonly frames: readonly MeasuredFrame[];
  readonly details?: Readonly<Record<string, unknown>>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFrame = (value: unknown): value is MeasuredFrame =>
  isRecord(value) && ['start', 'duration'].every((field) => Number.isFinite(value[field]));

const isCount = (value: unknown): boolean => Number.isInteger(value) && Number(value) >= 0;

const isFrameList = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(isFrame);

/** A paired control's record, refusing a malformed one or one that names a trace. */
export function readControlRecord(value: unknown, file: string): ControlRecord {
  const { id, pass, trace, warmUp, frames, details } = isRecord(value) ? value : {};
  const valid =
    typeof id === 'string' &&
    pass === 'control' &&
    trace === undefined &&
    isCount(warmUp) &&
    isFrameList(frames) &&
    (details === undefined || isRecord(details));
  if (!valid) {
    throw new Error(
      `${file} is not the record of a paired control: it needs an id, the control pass, a warm-up and frames, and no trace.`,
    );
  }
  return value as ControlRecord;
}

/** The budget pass: the budget's measurement and its file, relative to perf-results/. */
export interface BudgetPass {
  readonly file: string;
  readonly measurement: Measurement | undefined;
}

/** What the passes are compared by: each one's warm-up, frames and details, from its file. */
interface PassInput {
  readonly pass: PassName;
  readonly file: string;
  readonly warmUp: unknown;
  readonly durations: readonly number[];
  readonly details: Readonly<Record<string, unknown>>;
}

const PASS_NAMES: Readonly<Record<PassName, string>> = {
  budget: 'budget pass',
  traced: 'traced pass',
  control: 'paired control',
};

/** What makes passes one procedure: their warm-up, frame count, scene, browser and CPU slowdown. */
const PAIRED = ['warmUp', 'frames', 'seed', 'count', 'inView', 'browser', 'cpuSlowdown'] as const;

function fieldOf(input: PassInput, field: (typeof PAIRED)[number]): unknown {
  if (field === 'warmUp') return input.warmUp;
  if (field === 'frames') return input.durations.length;
  return input.details[field];
}

/** Refuses passes that lack a field of the procedure or differ in one, naming the field. */
function checkPaired(id: string, inputs: readonly PassInput[]): void {
  for (const field of PAIRED) {
    const values = inputs.map((input) => fieldOf(input, field));
    const lacking = inputs.find((_, index) => values[index] === undefined);
    if (lacking !== undefined) {
      const name = `${id}'s ${PASS_NAMES[lacking.pass]}`;
      throw new Error(`${lacking.file}, ${name}, gives no \`${field}\`.`);
    }
    if (values.some((value) => value !== values[0])) {
      const listed = inputs.map(
        ({ pass }, at) => `${PASS_NAMES[pass]} ${JSON.stringify(values[at])}`,
      );
      throw new Error(
        `${id}'s passes are not paired: their \`${field}\` differs (${listed.join(', ')}).`,
      );
    }
  }
}

function budgetInput(id: string, { file, measurement }: BudgetPass): PassInput {
  if (measurement === undefined) {
    throw new Error(`${file} is missing, so ${id}'s traced pass has no budget pass beside it.`);
  }
  const details = measurement.details ?? {};
  return {
    pass: 'budget',
    file,
    warmUp: details['warmUp'],
    durations: measurement.samples,
    details,
  };
}

const recordInput = (
  pass: PassName,
  file: string,
  record: TraceRecord | ControlRecord,
): PassInput => ({
  ...{ pass, file, warmUp: record.warmUp, details: record.details ?? {} },
  durations: record.frames.map(({ duration }) => duration),
});

function targetOf(id: string): number {
  const budget = PERF_BUDGETS.find((each) => each.id === id);
  if (budget === undefined) throw new Error(`No budget is named ${id}.`);
  return budget.target;
}

function passResult(input: PassInput, target: number): PassResult {
  const { median, p95, slow, samples, met } = frameTail(input.durations, target);
  return {
    ...{ pass: input.pass, traced: input.pass === 'traced', file: input.file },
    ...{ warmUp: Number(input.warmUp), frames: samples, median, p95, slow, withinTarget: met },
  };
}

/** Which differences the report gives: tracing's, beside the two untraced passes' own. */
const DIFFERENCES: readonly (readonly [PassName, PassName])[] = [
  ['traced', 'budget'],
  ['traced', 'control'],
  ['control', 'budget'],
];

/** The paired control's record of budget `id`, refusing one of another budget. */
function controlOf(id: string, folder: string, read: PassReader) {
  const name = traceFiles(id).control;
  const path = `${folder}/${name}`;
  const record = readControlRecord(readJson(read, name, path).value, path);
  if (record.id !== id) throw new Error(`${path} is the record of ${record.id}, not of ${id}.`);
  return { path, record };
}

/**
 * Budget `id`'s passes: its trace and traced pass in `folder`, read through `read` and checked
 * against each other, its paired control there, and its budget pass, refusing any that is missing
 * or not paired with the others; with each pass's tail against the budget's target and the
 * differences between them.
 */
export function passesResult(
  id: string,
  folder: string,
  read: PassReader,
  budget: BudgetPass,
): PassesResult {
  const checked = traceResult(id, folder, read);
  const control = controlOf(id, folder, read);
  const inputs: Readonly<Record<PassName, PassInput>> = {
    budget: budgetInput(id, budget),
    traced: recordInput('traced', checked.result.record, checked.pass),
    control: recordInput('control', control.path, control.record),
  };
  checkPaired(id, Object.values(inputs));
  const target = targetOf(id);
  const byName: Readonly<Record<PassName, PassResult>> = {
    budget: passResult(inputs.budget, target),
    traced: passResult(inputs.traced, target),
    control: passResult(inputs.control, target),
  };
  const passes = [byName.budget, byName.traced, byName.control];
  const differences = DIFFERENCES.map(([pass, from]) => ({
    ...{ pass, from, median: byName[pass].median - byName[from].median },
    ...{ p95: byName[pass].p95 - byName[from].p95, slow: byName[pass].slow - byName[from].slow },
  }));
  return { ...checked.result, control: control.path, passes, differences };
}

const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
const rule = (count: number): string => row(Array.from({ length: count }, () => '---'));
const ms = (value: number): string => `${formatValue(value)} ms`;

/** A difference with its sign, rounded as the report rounds values. */
function signed(value: number, unit = ''): string {
  const shown = formatValue(value);
  return `${shown.startsWith('-') || shown === '0' ? '' : '+'}${shown}${unit}`;
}

const LABELS = (id: string): Readonly<Record<PassName, string>> => ({
  budget: `Budget pass, ${id}'s samples`,
  traced: 'Traced pass',
  control: 'Paired control',
});

const passRow = (labels: Readonly<Record<PassName, string>>) => (each: PassResult) =>
  row([
    ...[
      labels[each.pass],
      each.traced ? 'yes' : 'no',
      `${String(each.frames)} after ${String(each.warmUp)}`,
    ],
    ...[ms(each.median), ms(each.p95), String(each.slow), each.withinTarget ? 'yes' : 'no'],
    `\`${each.file}\``,
  ]);

const differenceRow = ({ pass, from, median, p95, slow }: PassDifference): string => {
  const name = `${PASS_NAMES[pass].replace(/^./u, (first) => first.toUpperCase())} minus ${PASS_NAMES[from]}`;
  return row([name, signed(median, ' ms'), signed(p95, ' ms'), signed(slow)]);
};

function introduction({ id, passes }: PassesResult): string {
  const [first] = passes;
  const pans = `${String(first?.frames)} measured pans after ${String(first?.warmUp)} warm-up ones`;
  return `${id}'s pans ran three times in this job, each on a page of its own with the same scene and ${pans}: the budget pass, which no trace slows and whose samples are ${id}'s value above; the traced pass, while Chromium traced the browser, whose frames its trace holds exactly; and the paired control, untraced, right after it. The trace explains the traced pass's own frames, not the budget pass's. In one run, tracing's effect, the traced pass's difference from the untraced passes, cannot be told from the untraced passes' own difference, the last row; only many runs can measure it.`;
}

function resultMarkdown(result: PassesResult): string[] {
  const target = targetOf(result.id);
  const slow = `Frames ≥ ${String(SLOW_FRAME)} ms`;
  const passHeader = ['Pass', 'Traced', 'Frames', 'Median', '95th percentile', slow];
  return [
    `### ${result.id}'s passes and trace`,
    '',
    introduction(result),
    '',
    row([...passHeader, `95th percentile ≤ ${String(target)} ms`, 'File']),
    rule(passHeader.length + 2),
    ...result.passes.map(passRow(LABELS(result.id))),
    '',
    row(['Difference', 'Median', '95th percentile', slow]),
    rule(4),
    ...result.differences.map(differenceRow),
    '',
    row(['Trace', 'Bytes', 'Events', 'SHA-256']),
    rule(4),
    row([
      `\`${result.trace}\``,
      String(result.bytes),
      String(result.events),
      `\`${result.sha256}\``,
    ]),
    '',
  ];
}

/** The report's section on each budget's passes and trace, none when none was checked. */
export const passesMarkdown = (results: readonly PassesResult[]): string[] =>
  results.flatMap(resultMarkdown);
