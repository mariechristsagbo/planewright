import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { measured } from './perf-fixtures.ts';
import { EVENTS, F1, RECORD, traceOf, traced } from './trace-fixtures.ts';

// The performance report and B1's trace
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): `npm run
// perf:report` checks the traced pass's record and trace in perf-results/browser/traces, keeps the
// trace's size and SHA-256 in report.json and report.md, and fails when the trace is missing or
// does not hold its frames; the CI job then uploads perf-results/, the traces in it, as the
// performance-report artifact.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TRACE = Buffer.from(JSON.stringify(traceOf(EVENTS)));
const FAILED = "B1's trace failed its check: ";

const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

interface Report {
  readonly traces: readonly Readonly<Record<string, unknown>>[];
  readonly evaluation: { readonly failures: readonly string[] };
}

/**
 * Runs the report in a folder of its own, every budget measured within its target as a browser
 * measurement, with the trace files given, and gives its exit status, report.json and report.md.
 */
function runReport(traces: Readonly<Record<string, string | Buffer>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'planewright-report-'));
  folders.push(cwd);
  mkdirSync(join(cwd, 'docs', 'performance'), { recursive: true });
  const baseline = join('docs', 'performance', 'baseline.json');
  copyFileSync(join(ROOT, baseline), join(cwd, baseline));
  const browser = join(cwd, 'perf-results', 'browser');
  mkdirSync(join(browser, 'traces'), { recursive: true });
  for (const measurement of measured(0.5)) {
    writeFileSync(join(browser, `${measurement.id}.json`), JSON.stringify(measurement));
  }
  for (const [name, content] of Object.entries(traces)) {
    writeFileSync(join(browser, 'traces', name), content);
  }
  const env = {
    PATH: process.env['PATH'] ?? '',
    GITHUB_HEAD_REF: 'perf/49-x',
    GITHUB_SHA: 'a'.repeat(40),
  };
  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', 'perf-report.ts')], {
    ...{ cwd, env, encoding: 'utf8' },
  });
  const read = (name: string) => readFileSync(join(cwd, 'perf-results', name), 'utf8');
  return {
    status: run.status,
    report: JSON.parse(read('report.json')) as Report,
    markdown: read('report.md'),
  };
}

describe("the performance report's check of B1's trace", () => {
  it("keeps the trace's path, size, digest and frames in report.json and report.md", () => {
    const { status, report, markdown } = runReport({
      'B1.frames.json': JSON.stringify(RECORD),
      'B1.trace.json': TRACE,
    });
    const sha256 = createHash('sha256').update(TRACE).digest('hex');
    expect(status).toBe(0);
    expect(report.evaluation.failures).toEqual([]);
    expect(report.traces).toHaveLength(1);
    expect(report.traces[0]).toMatchObject({
      ...{
        id: 'B1',
        trace: 'browser/traces/B1.trace.json',
        record: 'browser/traces/B1.frames.json',
      },
      ...{ bytes: TRACE.length, sha256, frames: 3, warmUp: 2 },
    });
    expect(markdown).toContain(
      `| \`browser/traces/B1.trace.json\` | ${String(TRACE.length)} | \`${sha256}\` |`,
    );
  });

  it('fails, naming the file, when the traced pass kept no record', () => {
    const { status, report, markdown } = runReport({ 'B1.trace.json': TRACE });
    const failure = `${FAILED}browser/traces/B1.frames.json is missing.`;
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([failure]);
    expect(report.traces).toEqual([]);
    expect(markdown).toContain(`- **Fails CI:** ${failure}`);
  });

  it('fails when the trace does not hold the frames of its record', () => {
    const record = { ...RECORD, frames: traced([F1, { start: 290.5, duration: 7 }]) };
    const { status, report } = runReport({
      'B1.frames.json': JSON.stringify(record),
      'B1.trace.json': TRACE,
    });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}browser/traces/B1.trace.json holds no window of frame 2 (measured from 290.5 ms) after the frame before it.`,
    ]);
  });
});

describe('the performance job of CI', () => {
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  const job = workflow.split('\n  performance:\n')[1]?.split(/\n {2}\S/u)[0] ?? '';

  it('uploads every result, the traces among them, after the browser measurements and the report', () => {
    const steps = [
      'run: npm run perf:browser',
      'run: npm run perf:report',
      'name: performance-report',
      'path: perf-results/',
      'if-no-files-found: error',
    ].map((step) => job.indexOf(step));
    expect(steps.every((index) => index > 0)).toBe(true);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});
