import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';

import { PERF_BUDGETS, benchMeasurements } from './lib/perf-budgets.ts';
import type { Measurement } from './lib/perf-budgets.ts';
import { readBaseline } from './lib/perf-baseline.ts';
import { evaluate, readMeasurement, reportMarkdown } from './lib/perf-report.ts';

// The performance report (docs/architecture/engine/quality.md#what-eng-15-decided): it reads what
// `npm run perf:bench`, `npm run perf:browser` and `npm run check:bundle-size` wrote to
// perf-results/, compares it with the budgets and the committed baseline, writes report.json and
// report.md there and to the CI job's summary, and fails when a rule says so.

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
  'The element list renders at most 101 options, the 50 on each side of the active one: a screen reader reaches only those in the page, Up, Down, Home and End move the window, and every view change, a pan included, renders them again (I1, I2, I3).',
  'B14, the heap of 10,000 elements and a full history, is measured by hand with a heap snapshot before each release.',
];

const measurements = [
  ...benchMeasurements(readJson(join(RESULTS, 'bench.json')) ?? { testResults: [] }),
  ...browserMeasurements(),
  ...bundleMeasurements(),
];
const budgets = new Set(PERF_BUDGETS.map(({ id }) => id));
const evaluation = evaluate(
  measurements.filter(({ id }) => budgets.has(id)),
  readBaseline(readJson(BASELINE)),
);
const run = runOf();
const machine = machineOf(run, measurements);
const infos = measurements.filter(({ id }) => !budgets.has(id));
const markdown = reportMarkdown(evaluation, infos, { machine, notes: NOTES });
const values = Object.fromEntries(
  evaluation.results.flatMap(({ budget, value }) => (value === null ? [] : [[budget.id, value]])),
);
const report = { run, date: new Date().toISOString(), machine, values, evaluation, measurements };

mkdirSync(RESULTS, { recursive: true });
writeFileSync(join(RESULTS, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(RESULTS, 'report.md'), markdown);
if (env['GITHUB_STEP_SUMMARY'] !== undefined) appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
console.log(markdown);
if (evaluation.failures.length > 0) process.exitCode = 1;
