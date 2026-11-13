import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';

import { PERF_BUDGETS, benchMeasurements } from './lib/perf-budgets.ts';
import type { Measurement } from './lib/perf-budgets.ts';
import { readBaseline } from './lib/perf-baseline.ts';
import { evaluate, readMeasurement, reportMarkdown } from './lib/perf-report.ts';
import { traceMarkdown, traceResult } from './lib/perf-trace.ts';
import type { TraceResult } from './lib/perf-trace.ts';

// The performance report (docs/architecture/engine/quality.md#what-eng-15-decided): it reads what
// `npm run perf:bench`, `npm run perf:browser` and `npm run check:bundle-size` wrote to
// perf-results/, compares it with the budgets and the committed baseline, writes report.json and
// report.md there and to the CI job's summary, and fails when a rule says so. It also checks the
// trace that the browser measurements keep of B1's pans and gives its digest, failing when the
// trace is missing or does not hold its frames
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided).

const RESULTS = 'perf-results';
const BASELINE = 'docs/performance/baseline.json';
const env = process.env;

/** A JSON file's content, or undefined when it is missing. */
function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error(`${path} could not be read: ${String(error)}`, { cause: error });
  }
}

function browserMeasurements(): Measurement[] {
  const directory = join(RESULTS, 'browser');
  let files: string[];
  try {
    files = readdirSync(directory).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  return files.sort().map((name) => {
    const path = join(directory, name);
    return readMeasurement(readJson(path), path);
  });
}

const TRACES = 'browser/traces';

/** A file of the traces' folder, or undefined when it is missing. */
function traceFile(name: string): Buffer | undefined {
  try {
    return readFileSync(join(RESULTS, TRACES, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/** B1's trace, checked against its record, or why it fails the report. */
function traces(): { results: TraceResult[]; failures: string[] } {
  try {
    return { results: [traceResult('B1', TRACES, traceFile)], failures: [] };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { results: [], failures: [`B1's trace failed its check: ${reason}`] };
  }
}

function bundleMeasurements(): Measurement[] {
  const path = join(RESULTS, 'bundle.json');
  const found = readJson(path);
  if (found === undefined) return [];
  if (!Array.isArray(found)) throw new Error(`${path} is not a list of measurements.`);
  return found.map((each) => readMeasurement(each, path));
}

/** An environment variable's value, unless it is unset or empty, as GITHUB_HEAD_REF is on a push. */
const filled = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value;

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8' }).trim();

function runOf() {
  const url =
    env['GITHUB_RUN_ID'] === undefined
      ? 'local'
      : `${env['GITHUB_SERVER_URL'] ?? ''}/${env['GITHUB_REPOSITORY'] ?? ''}/actions/runs/${env['GITHUB_RUN_ID']}/attempts/${env['GITHUB_RUN_ATTEMPT'] ?? '1'}`;
  return {
    branch:
      filled(env['GITHUB_HEAD_REF']) ??
      filled(env['GITHUB_REF_NAME']) ??
      git('branch', '--show-current'),
    event: env['GITHUB_EVENT_NAME'] ?? 'local',
    commit: env['GITHUB_SHA'] ?? git('rev-parse', 'HEAD'),
    url,
  };
}

function machineOf(run: ReturnType<typeof runOf>, measurements: readonly Measurement[]) {
  const [cpu] = cpus();
  const browser = measurements.map(({ details }) => details?.['browser']).find(Boolean);
  return {
    Processor: cpu?.model ?? 'unknown',
    Cores: String(cpus().length),
    Memory: `${(totalmem() / 2 ** 30).toFixed(1)} GiB`,
    System: `${platform()} ${release()} ${arch()}`,
    'Runner image': `${env['ImageOS'] ?? 'not a CI runner'} ${env['ImageVersion'] ?? ''}`.trim(),
    'Node.js': process.version,
    Browser: typeof browser === 'string' ? browser : 'not measured',
    Commit: run.commit,
    Branch: run.branch,
    Event: run.event,
    Run: run.url,
  };
}

const NOTES = [
  'Each value is the statistic its budget names over the samples kept after warm-up: the 95th percentile, interpolated linearly between the closest ranks, the largest sample, or the one value of a bundle size, in KB of 1,000 bytes.',
  'The element list renders at most 101 options, the 50 on each side of the active one: a screen reader reaches only those in the page, and Up, Down, Home and End move the window. Since S5 the closed Elements drawer mounts no list (I1), and the open one renders its options again only when the elements, the selection or the active option change, never at a pan step (I2); I3 times the names that such a change makes again.',
  "I4 to I6 each time the first whole-scene marquee query after an untimed change or load of the benchmarks' 10,000 elements, whose ordered elements are read first, as the editor's view reads them; B6 times queries of an unchanged scene whose rows its check has made. No budget covers I4 to I6.",
  'B14, the heap of 10,000 elements and a full history, is measured by hand with a heap snapshot before each release.',
];

const measurements = [
  ...benchMeasurements(readJson(join(RESULTS, 'bench.json')) ?? { testResults: [] }),
  ...browserMeasurements(),
  ...bundleMeasurements(),
];
const budgets = new Set(PERF_BUDGETS.map(({ id }) => id));
const run = runOf();
const machine = machineOf(run, measurements);
const traced = traces();
const evaluated = evaluate(
  measurements.filter(({ id }) => budgets.has(id)),
  readBaseline(readJson(BASELINE)),
  machine.Processor,
);
const evaluation = { ...evaluated, failures: [...evaluated.failures, ...traced.failures] };
const infos = measurements.filter(({ id }) => !budgets.has(id));
const sections = traceMarkdown(traced.results);
const markdown = reportMarkdown(evaluation, infos, { machine, notes: NOTES, sections });
const values = Object.fromEntries(
  evaluation.results.flatMap(({ budget, value }) => (value === null ? [] : [[budget.id, value]])),
);
const report = {
  ...{ run, date: new Date().toISOString(), machine, values, evaluation, measurements },
  traces: traced.results,
};

mkdirSync(RESULTS, { recursive: true });
writeFileSync(join(RESULTS, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(RESULTS, 'report.md'), markdown);
if (env['GITHUB_STEP_SUMMARY'] !== undefined) appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
console.log(markdown);
if (evaluation.failures.length > 0) process.exitCode = 1;
