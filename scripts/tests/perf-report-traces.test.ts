import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { measured } from './perf-fixtures.ts';
import { BUDGET, CONTROL, EVENTS, F1, F2, F3, RECORD, traceOf, traced } from './trace-fixtures.ts';

// The performance report and B1's passes and trace
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): `npm run
// perf:report` checks the traced pass's record and trace and its paired control's record in
// perf-results/browser/traces against B1's own measurement, keeps the trace's size and SHA-256 and
// each pass's tail in report.json and report.md, and fails when any of them is missing, the trace
// does not hold exactly its frames or the passes are not paired; the CI job then uploads
// perf-results/, the traces in it, as the performance-report artifact.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TRACE = Buffer.from(JSON.stringify(traceOf(EVENTS)));
const FAILED = "B1's passes and trace failed their check: ";
const GOOD = {
  'B1.frames.json': JSON.stringify(RECORD),
  'B1.trace.json': TRACE,
  'B1.control.json': JSON.stringify(CONTROL),
};

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
 * measurement, B1 as its budget pass measured it, with the trace files given, and gives its exit
 * status, report.json and report.md.
 */
function runReport(traces: Readonly<Record<string, string | Buffer | undefined>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'planewright-report-'));
  folders.push(cwd);
  mkdirSync(join(cwd, 'docs', 'performance'), { recursive: true });
  const baseline = join('docs', 'performance', 'baseline.json');
  copyFileSync(join(ROOT, baseline), join(cwd, baseline));
  const browser = join(cwd, 'perf-results', 'browser');
  mkdirSync(join(browser, 'traces'), { recursive: true });
  for (const measurement of measured(0.5, { B1: BUDGET.samples })) {
    const written = measurement.id === 'B1' ? BUDGET : measurement;
    writeFileSync(join(browser, `${measurement.id}.json`), JSON.stringify(written));
  }
  for (const [name, content] of Object.entries(traces)) {
    if (content !== undefined) writeFileSync(join(browser, 'traces', name), content);
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
  it("keeps the trace's path, size and digest and each pass's tail in report.json and report.md", () => {
    const { status, report, markdown } = runReport(GOOD);
    const sha256 = createHash('sha256').update(TRACE).digest('hex');
    expect(status).toBe(0);
    expect(report.evaluation.failures).toEqual([]);
    expect(report.traces).toHaveLength(1);
    expect(report.traces[0]).toMatchObject({
      ...{
        id: 'B1',
        trace: 'browser/traces/B1.trace.json',
        record: 'browser/traces/B1.frames.json',
        control: 'browser/traces/B1.control.json',
      },
      ...{ bytes: TRACE.length, sha256, events: EVENTS.length + 1 },
    });
    const passes = report.traces[0]?.['passes'] as readonly Readonly<Record<string, unknown>>[];
    expect(
      passes.map(({ pass, traced, file, frames, warmUp }) => [pass, traced, file, frames, warmUp]),
    ).toEqual([
      ['budget', false, 'browser/B1.json', 3, 2],
      ['traced', true, 'browser/traces/B1.frames.json', 3, 2],
      ['control', false, 'browser/traces/B1.control.json', 3, 2],
    ]);
    expect(report.traces[0]?.['differences']).toHaveLength(3);
    expect(markdown).toContain("### B1's passes and trace");
    expect(markdown).toContain('| Traced pass minus paired control | -0.2 ms | +0.7 ms | 0 |');
    expect(markdown).toContain(
      `| \`browser/traces/B1.trace.json\` | ${String(TRACE.length)} | ${String(EVENTS.length + 1)} | \`${sha256}\` |`,
    );
  });

  it('fails, naming the file, when the traced pass kept no record', () => {
    const { status, report, markdown } = runReport({ ...GOOD, 'B1.frames.json': undefined });
    const failure = `${FAILED}browser/traces/B1.frames.json is missing.`;
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([failure]);
    expect(report.traces).toEqual([]);
    expect(markdown).toContain(`- **Fails CI:** ${failure}`);
  });

  it('fails when the trace does not hold the frames of its record', () => {
    const record = { ...RECORD, frames: traced([F1, F2, { start: 290.5, duration: 7 }]) };
    const { status, report } = runReport({ ...GOOD, 'B1.frames.json': JSON.stringify(record) });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}browser/traces/B1.trace.json holds no window of frame 3 (measured from 290.5 ms): its scene render 5 starts at 260.4 ms.`,
    ]);
  });

  it('fails when the record leaves out a frame that the trace holds', () => {
    const record = { ...RECORD, frames: traced([F1, F3]) };
    const { status, report } = runReport({ ...GOOD, 'B1.frames.json': JSON.stringify(record) });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}browser/traces/B1.trace.json holds 5 scene renders, not the 2 of the warm-up and the 2 measured frames of the pass.`,
    ]);
  });

  it('never reads a trace that the traced pass refused, or the record of why', () => {
    const refused = {
      'B1.trace.refused.json': TRACE,
      'B1.refused.json': JSON.stringify({ ...RECORD, refused: 'outside every task' }),
    };
    expect(runReport({ ...GOOD, ...refused }).status).toBe(0);
    const { status, report } = runReport({
      ...refused,
      'B1.control.json': GOOD['B1.control.json'],
    });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}browser/traces/B1.frames.json is missing.`,
    ]);
  });

  it('fails, naming the file, when the paired control kept no record', () => {
    const { status, report } = runReport({ ...GOOD, 'B1.control.json': undefined });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}browser/traces/B1.control.json is missing.`,
    ]);
    expect(report.traces).toEqual([]);
  });

  it('fails when the paired control is not a pass like the others', () => {
    const control = JSON.stringify({ ...CONTROL, warmUp: 3 });
    const { status, report } = runReport({ ...GOOD, 'B1.control.json': control });
    expect(status).toBe(1);
    expect(report.evaluation.failures).toEqual([
      `${FAILED}B1's passes are not paired: their \`warmUp\` differs (budget pass 2, traced pass 2, paired control 3).`,
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
