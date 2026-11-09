import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { appendRun, readBaseline, readReport } from './lib/perf-baseline.ts';
import type { MainHistory } from './lib/perf-baseline.ts';

// Records a CI run's performance report in the committed baseline
// (docs/architecture/engine/quality.md#what-issue-38-decided):
// `npm run perf:baseline -- --label "main run 1/3" <report.json>` with the report.json of the
// run's performance-report artifact, after `git fetch origin main`. Only a push or a manual
// dispatch on main counts towards the gate, recorded after the last one; `--information` keeps
// another run, such as a pull request's, as information.

const BASELINE = 'docs/performance/baseline.json';
const MAIN = 'origin/main';

/** Whether `earlier` is `later` or one of its ancestors, failing on a commit Git does not know. */
function isAncestor(earlier: string, later: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', earlier, later], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if ((error as { status?: unknown }).status === 1) return false;
    throw new Error(`Git does not know ${earlier} or ${later}: run git fetch origin main first.`, {
      cause: error,
    });
  }
}

const history: MainHistory = {
  onMain: (commit) => isAncestor(commit, MAIN),
  precedes: isAncestor,
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { label: { type: 'string' }, information: { type: 'boolean', default: false } },
});
const [path] = positionals;
if (path === undefined || values.label === undefined) {
  throw new Error(
    'Usage: npm run perf:baseline -- --label "<label>" [--information] <report.json>',
  );
}
const report = readReport(JSON.parse(readFileSync(path, 'utf8')), path);
const baseline = readBaseline(JSON.parse(readFileSync(BASELINE, 'utf8')));
const next = appendRun(baseline, report, {
  label: values.label,
  information: values.information,
  history,
});
writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
console.log(`${BASELINE} now holds ${String(next.runs.length)} runs.`);
