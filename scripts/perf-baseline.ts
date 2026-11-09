import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { appendRun, readBaseline } from './lib/perf-report.ts';
import type { ReportedRun } from './lib/perf-report.ts';

// Records a CI run's performance report in the committed baseline
// (docs/architecture/engine/quality.md#what-eng-15-decided):
// `npm run perf:baseline -- --label "main run 1/3" <report.json>` with the report.json of the
// run's performance-report artifact. Only runs on main count towards the gate; `--any-branch`
// records another run, such as a pull request's, as information.

const BASELINE = 'docs/performance/baseline.json';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { label: { type: 'string' }, 'any-branch': { type: 'boolean', default: false } },
});
const [path] = positionals;
if (path === undefined || values.label === undefined) {
  throw new Error('Usage: npm run perf:baseline -- --label "<label>" [--any-branch] <report.json>');
}
const report = JSON.parse(readFileSync(path, 'utf8')) as ReportedRun;
const baseline = readBaseline(JSON.parse(readFileSync(BASELINE, 'utf8')));
const next = appendRun(baseline, report, {
  label: values.label,
  anyBranch: values['any-branch'],
});
writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
console.log(`${BASELINE} now holds ${String(next.runs.length)} runs.`);
