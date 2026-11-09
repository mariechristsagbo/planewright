/**
 * The performance baseline's runs (docs/architecture/engine/quality.md#what-issue-38-decided):
 * a run counts towards the gate only when it is a run of this repository's CI on `main`, from a
 * push or a manual dispatch, at its first attempt, with a report that does not fail. Such runs
 * are recorded once each, in the order of their run ids, at commits that `main` reached in that
 * order, so that the recorded addresses show whether runs were left out. Any other run is kept
 * only as information, when asked to, and never counts. Each run keeps the machine it ran on,
 * since the gate compares a run only with runs on the same processor model.
 */

/** The repository whose CI runs on `main` make the baseline. */
export const REPOSITORY = 'mariechristsagbo/planewright';

/** The events of a CI run on `main` that count: a push and a manual dispatch. */
export const MAIN_EVENTS: readonly string[] = ['push', 'workflow_dispatch'];

/** What a baseline run keeps of its report's machine. */
export const MACHINE_FIELDS = [
  'Processor',
  'Cores',
  'Memory',
  'System',
  'Runner image',
  'Node.js',
  'Browser',
] as const;

export type Machine = Readonly<Record<(typeof MACHINE_FIELDS)[number], string>>;

/** One CI run's values, as the baseline file keeps them. */
export interface PerfRun {
  readonly label: string;
  readonly branch: string;
  readonly event: string;
  readonly commit: string;
  /** The CI run's address, with its id and attempt. */
  readonly run: string;
  readonly date: string;
  readonly machine: Machine;
  readonly values: Readonly<Record<string, number>>;
}

export interface PerfBaseline {
  readonly runs: readonly PerfRun[];
  /** The issue that will fix each missed budget, by budget. */
  readonly followUps: Readonly<Record<string, string>>;
}

/** What a report.json says about its CI run, which a baseline run records. */
export interface ReportedRun {
  readonly run: {
    readonly branch: string;
    readonly event: string;
    readonly commit: string;
    readonly url: string;
  };
  readonly date: string;
  readonly machine: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, number>>;
  readonly evaluation: { readonly failures: readonly string[] };
}

/** Main's history as the recorder fetched it. */
export interface MainHistory {
  /** Whether the commit is on `main`. */
  readonly onMain: (commit: string) => boolean;
  /** Whether `earlier` is `later` or one of its ancestors. */
  readonly precedes: (earlier: string, later: string) => boolean;
}

const ADDRESS =
  /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/actions\/runs\/(\d+)\/attempts\/(\d+)$/;

/** A CI run's repository, run id and attempt, from its address; null for any other address. */
export function runAddress(url: string) {
  const [, repository, id, attempt] = ADDRESS.exec(url) ?? [];
  if (repository === undefined || id === undefined || attempt === undefined) return null;
  return { repository, id: Number(id), attempt: Number(attempt) };
}

/** Why a run does not count towards the gate, or null when it does. */
export function notMainRun({ branch, event, commit, url }: ReportedRun['run']): string | null {
  const address = runAddress(url);
  if (address?.repository !== REPOSITORY) return `it is not a CI run of ${REPOSITORY}`;
  if (branch !== 'main') return `it ran on ${branch}, not on main`;
  if (!MAIN_EVENTS.includes(event)) return `it is a ${event} run, not a push or a manual dispatch`;
  if (address.attempt !== 1) {
    return `it is attempt ${String(address.attempt)} of its CI run, not the first`;
  }
  if (!/^[0-9a-f]{40}$/.test(commit)) return `its commit ${commit} is not a full commit id`;
  return null;
}

/** Whether a recorded run counts towards the gate. */
export const isMainRun = (run: PerfRun): boolean => notMainRun({ ...run, url: run.run }) === null;

/** A recorded run's id; every recorded run is a CI run. */
const idOf = (run: PerfRun): number => runAddress(run.run)?.id ?? Number.NaN;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const RUN_FIELDS = ['label', 'branch', 'event', 'commit', 'run', 'date'] as const;

function readRun(value: unknown): PerfRun {
  const { machine, values } = isRecord(value) ? value : {};
  const valid =
    isRecord(value) &&
    RUN_FIELDS.every((field) => typeof value[field] === 'string') &&
    runAddress(String(value['run'])) !== null &&
    isRecord(machine) &&
    MACHINE_FIELDS.every((field) => typeof machine[field] === 'string') &&
    isRecord(values) &&
    Object.values(values).every(Number.isFinite);
  if (!valid) throw new Error('The performance baseline holds a run that is not well formed.');
  return value as unknown as PerfRun;
}

/** Refuses a baseline that holds a run twice, or its runs on main out of order. */
function checkOrder(runs: readonly PerfRun[]): void {
  const seen = new Set<number>();
  for (const id of runs.map(idOf)) {
    if (seen.has(id)) throw new Error(`The performance baseline holds run ${String(id)} twice.`);
    seen.add(id);
  }
  const main = runs.filter(isMainRun).map(idOf);
  main.forEach((id, index) => {
    const next = main[index + 1];
    if (next !== undefined && next <= id) {
      const pair = `run ${String(id)} before run ${String(next)}`;
      throw new Error(`The runs on main of the performance baseline are out of order: ${pair}.`);
    }
  });
}

export function readBaseline(value: unknown): PerfBaseline {
  const runs = isRecord(value) ? value['runs'] : undefined;
  const followUps = isRecord(value) ? value['followUps'] : undefined;
  const validFollowUps =
    isRecord(followUps) && Object.values(followUps).every((ref) => typeof ref === 'string');
  if (!Array.isArray(runs) || !validFollowUps) {
    throw new Error('The performance baseline needs a runs list and a followUps map.');
  }
  const read = runs.map(readRun);
  checkOrder(read);
  return { runs: read, followUps: followUps as Readonly<Record<string, string>> };
}

const REPORT_RUN_FIELDS = ['branch', 'event', 'commit', 'url'] as const;

/** A report.json's content, checked as far as a baseline run reads it. */
export function readReport(value: unknown, file: string): ReportedRun {
  const { run, date, machine, values, evaluation } = isRecord(value) ? value : {};
  const failures = isRecord(evaluation) ? evaluation['failures'] : undefined;
  const valid =
    isRecord(run) &&
    REPORT_RUN_FIELDS.every((field) => typeof run[field] === 'string') &&
    typeof date === 'string' &&
    isRecord(machine) &&
    isRecord(values) &&
    Object.values(values).every(Number.isFinite) &&
    Array.isArray(failures);
  if (!valid) throw new Error(`${file} is not a performance report.`);
  return value as ReportedRun;
}

/** The machine fields a baseline run keeps, refusing a report that lacks one or its processor. */
function machineOf(report: ReportedRun): Machine {
  const missing = MACHINE_FIELDS.filter((field) => typeof report.machine[field] !== 'string');
  if (missing.length > 0) throw new Error(`The report's machine lacks ${missing.join(', ')}.`);
  if (report.machine['Processor'] === 'unknown') {
    throw new Error("The report's machine names no processor, so no run can be compared with it.");
  }
  return Object.fromEntries(
    MACHINE_FIELDS.map((field) => [field, report.machine[field]]),
  ) as unknown as Machine;
}

/** Refuses a run on main that is not later, on main and in its history, than the last one. */
function checkMainOrder(baseline: PerfBaseline, report: ReportedRun, history: MainHistory) {
  const { commit, url } = report.run;
  const id = runAddress(url)?.id ?? Number.NaN;
  if (!history.onMain(commit)) throw new Error(`This run's commit ${commit} is not on main.`);
  const last = baseline.runs.filter(isMainRun).at(-1);
  if (last === undefined) return;
  const after = `run ${String(idOf(last))}, the last run on main recorded`;
  if (id <= idOf(last)) throw new Error(`Run ${String(id)} is older than ${after}.`);
  if (!history.precedes(last.commit, commit)) {
    throw new Error(
      `Run ${String(id)} cannot follow ${after}: its commit ${commit} is older than ${last.commit}.`,
    );
  }
}

/** The run that a report adds to the baseline, checked as a run on main or as information. */
function checkedRun(baseline: PerfBaseline, report: ReportedRun, options: RecordOptions) {
  const address = runAddress(report.run.url);
  if (address === null) {
    throw new Error(`Only CI runs make the baseline; this one is ${report.run.url}.`);
  }
  if (baseline.runs.some((run) => idOf(run) === address.id)) {
    throw new Error(`The baseline already holds run ${String(address.id)}.`);
  }
  const [failure] = report.evaluation.failures;
  if (failure !== undefined) {
    throw new Error(`This run cannot be recorded: its report fails: ${failure}`);
  }
  const reason = notMainRun(report.run);
  if (reason === null) {
    checkMainOrder(baseline, report, options.history);
  } else if (options.information !== true) {
    throw new Error(
      `This run does not count towards the gate: ${reason}. Record it with --information to keep it as information.`,
    );
  }
}

export interface RecordOptions {
  readonly label: string;
  /** Keep a run that does not count, such as a pull request's, as information. */
  readonly information?: boolean;
  readonly history: MainHistory;
}

/** The baseline with a report's run added: a run on main, or information when asked to. */
export function appendRun(
  baseline: PerfBaseline,
  report: ReportedRun,
  options: RecordOptions,
): PerfBaseline {
  checkedRun(baseline, report, options);
  const { branch, event, commit, url } = report.run;
  const added: PerfRun = {
    ...{ label: options.label, branch, event, commit, run: url },
    ...{ date: report.date, machine: machineOf(report), values: report.values },
  };
  return { ...baseline, runs: [...baseline.runs, added] };
}
