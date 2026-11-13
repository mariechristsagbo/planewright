import { describe, expect, it } from 'vitest';

import { createHash } from 'node:crypto';

import { passesMarkdown, passesResult, readControlRecord } from '../lib/perf-passes.ts';
import { BUDGET, CONTROL, EVENTS, RECORD, filesOf, traceOf } from './trace-fixtures.ts';

// B1's passes (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
// budget pass, untraced, whose samples are B1's; the traced pass, whose frames the trace holds;
// and the traced pass's paired control, B1's pans once more untraced right after it.

const FILE = 'B1.control.json';

describe('readControlRecord', () => {
  it("reads the record of the traced pass's paired control", () => {
    expect(readControlRecord(CONTROL, FILE)).toEqual(CONTROL);
  });

  it("refuses a malformed record, or a traced pass's, naming the file", () => {
    const refused = [
      null,
      [],
      { ...CONTROL, id: 1 },
      { ...CONTROL, pass: 'traced' },
      { ...CONTROL, pass: undefined },
      { ...CONTROL, trace: 'B1.trace.json' },
      { ...CONTROL, warmUp: -1 },
      { ...CONTROL, warmUp: 1.5 },
      { ...CONTROL, frames: [] },
      { ...CONTROL, frames: [{ start: 1 }] },
      { ...CONTROL, frames: [{ start: 1, duration: Number.POSITIVE_INFINITY }] },
      { ...CONTROL, details: [] },
    ];
    for (const value of refused) {
      expect(() => readControlRecord(value, FILE)).toThrow(
        /^B1\.control\.json is not the record of a paired control: /u,
      );
    }
  });
});

const FOLDER = 'browser/traces';
const TRACE = Buffer.from(JSON.stringify(traceOf(EVENTS)));
const GOOD = { 'B1.frames.json': RECORD, 'B1.trace.json': TRACE, 'B1.control.json': CONTROL };
const BUDGET_PASS = { file: 'browser/B1.json', measurement: BUDGET };

describe('passesResult', () => {
  it('gives the trace, each pass with its tail, and their differences', () => {
    const result = passesResult('B1', FOLDER, filesOf(GOOD), BUDGET_PASS);
    expect(result).toMatchObject({
      ...{ id: 'B1', trace: 'browser/traces/B1.trace.json' },
      ...{ record: 'browser/traces/B1.frames.json', control: 'browser/traces/B1.control.json' },
      ...{ bytes: TRACE.length, sha256: createHash('sha256').update(TRACE).digest('hex') },
      events: EVENTS.length + 1,
    });
    const passes = result.passes.map(({ p95, ...rest }) => ({
      ...rest,
      p95: Math.round(p95 * 1e6),
    }));
    expect(passes).toEqual([
      {
        ...{ pass: 'budget', traced: false, file: 'browser/B1.json', warmUp: 2, frames: 3 },
        ...{ median: 7.1, p95: 7_460_000, slow: 0, withinTarget: true },
      },
      {
        ...{ pass: 'traced', traced: true, file: 'browser/traces/B1.frames.json', warmUp: 2 },
        ...{ frames: 3, median: 7.2, p95: 10_080_000, slow: 1, withinTarget: false },
      },
      {
        ...{ pass: 'control', traced: false, file: 'browser/traces/B1.control.json', warmUp: 2 },
        ...{ frames: 3, median: 7.4, p95: 9_380_000, slow: 1, withinTarget: false },
      },
    ]);
    const differences = result.differences.map(({ pass, from, median, p95, slow }) => [
      ...[pass, from, Math.round(median * 1e6), Math.round(p95 * 1e6), slow],
    ]);
    expect(differences).toEqual([
      ['traced', 'budget', 100_000, 2_620_000, 1],
      ['traced', 'control', -200_000, 700_000, 0],
      ['control', 'budget', 300_000, 1_920_000, 1],
    ]);
  });

  const control = (change: Readonly<Record<string, unknown>>) => ({
    ...GOOD,
    'B1.control.json': { ...CONTROL, ...change },
  });
  const controlDetails = (change: Readonly<Record<string, unknown>>) =>
    control({ details: { ...CONTROL.details, ...change } });
  const budget = (change: Readonly<Record<string, unknown>>) => ({
    ...BUDGET_PASS,
    measurement: { ...BUDGET, details: { ...BUDGET.details, ...change } },
  });
  const UNPAIRED = "B1's passes are not paired: their ";
  const refusals: [string, Readonly<Record<string, unknown>>, typeof BUDGET_PASS, string][] = [
    [
      'a trace that fails its check',
      { ...GOOD, 'B1.trace.json': undefined },
      BUDGET_PASS,
      'browser/traces/B1.trace.json is missing.',
    ],
    [
      'no paired control',
      { ...GOOD, 'B1.control.json': undefined },
      BUDGET_PASS,
      'browser/traces/B1.control.json is missing.',
    ],
    [
      'a paired control that is no JSON',
      { ...GOOD, 'B1.control.json': '{' },
      BUDGET_PASS,
      'browser/traces/B1.control.json is not JSON',
    ],
    [
      "a traced pass's record as the control",
      { ...GOOD, 'B1.control.json': RECORD },
      BUDGET_PASS,
      'browser/traces/B1.control.json is not the record of a paired control',
    ],
    [
      "another budget's control",
      control({ id: 'B2' }),
      BUDGET_PASS,
      'browser/traces/B1.control.json is the record of B2, not of B1.',
    ],
    [
      'no budget pass',
      GOOD,
      { ...BUDGET_PASS, measurement: undefined } as never,
      "browser/B1.json is missing, so B1's traced pass has no budget pass beside it.",
    ],
    [
      'a budget pass without its warm-up',
      GOOD,
      budget({ warmUp: undefined }),
      "browser/B1.json, B1's budget pass, gives no `warmUp`.",
    ],
    [
      'a control without its elements in view',
      controlDetails({ inView: undefined }),
      BUDGET_PASS,
      "browser/traces/B1.control.json, B1's paired control, gives no `inView`.",
    ],
    [
      'a control with another warm-up',
      control({ warmUp: 3 }),
      BUDGET_PASS,
      `${UNPAIRED}\`warmUp\` differs (budget pass 2, traced pass 2, paired control 3).`,
    ],
    [
      'a control with fewer frames',
      control({ frames: CONTROL.frames.slice(1) }),
      BUDGET_PASS,
      `${UNPAIRED}\`frames\` differs (budget pass 3, traced pass 3, paired control 2).`,
    ],
    [
      'a budget pass of another scene',
      GOOD,
      budget({ seed: 22 }),
      `${UNPAIRED}\`seed\` differs (budget pass 22, traced pass 21, paired control 21).`,
    ],
    [
      'a budget pass with another element count',
      GOOD,
      budget({ count: 4000 }),
      `${UNPAIRED}\`count\` differs (budget pass 4000, traced pass 5000, paired control 5000).`,
    ],
    [
      'a control in another browser',
      controlDetails({ browser: 'Chromium 157' }),
      BUDGET_PASS,
      `${UNPAIRED}\`browser\` differs (budget pass "Chromium 156.0.8078.4", traced pass "Chromium 156.0.8078.4", paired control "Chromium 157").`,
    ],
    [
      'a control at another CPU slowdown',
      controlDetails({ cpuSlowdown: 4 }),
      BUDGET_PASS,
      `${UNPAIRED}\`cpuSlowdown\` differs (budget pass 1, traced pass 1, paired control 4).`,
    ],
  ];

  it.each(refusals)('refuses %s, naming why', (_, files, given, message) => {
    expect(() => passesResult('B1', FOLDER, filesOf(files), given)).toThrow(message);
  });
});

describe('passesMarkdown', () => {
  it('renders the passes, their differences and the trace, and nothing when none was checked', () => {
    const result = passesResult('B1', FOLDER, filesOf(GOOD), BUDGET_PASS);
    const markdown = passesMarkdown([result]).join('\n');
    expect(markdown).toContain("### B1's passes and trace");
    expect(markdown).toContain('3 measured pans after 2 warm-up ones');
    expect(markdown).toContain(
      '| Pass | Traced | Frames | Median | 95th percentile | Frames ≥ 9 ms | 95th percentile ≤ 8 ms | File |',
    );
    expect(markdown).toContain(
      "| Budget pass, B1's samples | no | 3 after 2 | 7.1 ms | 7.46 ms | 0 | yes | `browser/B1.json` |",
    );
    expect(markdown).toContain(
      '| Traced pass | yes | 3 after 2 | 7.2 ms | 10.08 ms | 1 | no | `browser/traces/B1.frames.json` |',
    );
    expect(markdown).toContain(
      '| Paired control | no | 3 after 2 | 7.4 ms | 9.38 ms | 1 | no | `browser/traces/B1.control.json` |',
    );
    expect(markdown).toContain('| Difference | Median | 95th percentile | Frames ≥ 9 ms |');
    expect(markdown).toContain('| Traced pass minus budget pass | +0.1 ms | +2.62 ms | +1 |');
    expect(markdown).toContain('| Traced pass minus paired control | -0.2 ms | +0.7 ms | 0 |');
    expect(markdown).toContain('| Paired control minus budget pass | +0.3 ms | +1.92 ms | +1 |');
    expect(markdown).toContain('| Trace | Bytes | Events | SHA-256 |');
    expect(markdown).toContain(
      `| \`browser/traces/B1.trace.json\` | ${String(TRACE.length)} | ${String(EVENTS.length + 1)} | \`${result.sha256}\` |`,
    );
    expect(passesMarkdown([])).toEqual([]);
  });
});
