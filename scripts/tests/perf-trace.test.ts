import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  TRACE_CATEGORIES,
  readTraceRecord,
  traceEventsOf,
  traceFiles,
  traceFrames,
  traceMarkdown,
  traceResult,
} from '../lib/perf-trace.ts';
import type { TraceEvent } from '../lib/perf-trace.ts';
import {
  EVENTS,
  F1,
  F2,
  F3,
  FRAMES,
  METADATA,
  RECORD,
  W1,
  W2,
  at,
  endOf,
  frameEvents,
  traceOf,
  traced,
} from './trace-fixtures.ts';
import type { Frame } from './trace-fixtures.ts';

// B1's trace (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
// browser measurements pan B1's scene again while Chromium traces the browser, and keep the trace
// with each traced frame's start on the page's clock and in the trace; the performance report
// checks that the trace holds every frame inside a task that the timeline recorded, and gives its
// digest.

const FILE = 'B1.trace.json';

describe('the trace categories and files', () => {
  it("record the issue's timeline, V8 and garbage-collection events, the frames and every task", () => {
    expect(TRACE_CATEGORIES).toEqual([
      '-*',
      'devtools.timeline',
      'v8',
      'disabled-by-default-v8.gc',
      'blink.user_timing',
      'toplevel',
    ]);
    expect(traceFiles('B1')).toEqual({ trace: 'B1.trace.json', record: 'B1.frames.json' });
  });
});

describe('traceEventsOf', () => {
  it("reads a Chromium trace's events", () => {
    expect(traceEventsOf(traceOf(EVENTS), FILE)).toHaveLength(EVENTS.length + 1);
  });

  it('refuses anything else, naming the file', () => {
    const refused = [
      null,
      [],
      { traceEvents: {} },
      { traceEvents: [] },
      { traceEvents: [{ ...METADATA, ts: '0' }] },
      { traceEvents: [{ ...METADATA, pid: undefined }] },
      { traceEvents: [{ ...METADATA, name: 3 }] },
      { traceEvents: [{ ...METADATA, cat: undefined }] },
      { traceEvents: [METADATA, 4] },
    ];
    for (const value of refused) {
      expect(() => traceEventsOf(value, FILE)).toThrow(/^B1\.trace\.json is not /u);
    }
  });
});

describe('traceFrames', () => {
  const events = traceEventsOf(traceOf(EVENTS), FILE);

  it("gives each measured frame its window's start in the trace, after the warm-up's", () => {
    const traced = traceFrames(events, FRAMES, FILE);
    expect(traced).toEqual(FRAMES.map((frame) => ({ ...frame, ts: at(frame.start) })));
  });

  it("accepts a window that the page's 0.1 ms clock puts up to 0.1 ms outside its task", () => {
    const late = frameEvents(F1).map((event) =>
      event.ph === 'X' ? { ...event, ts: event.ts + 140, dur: (event.dur ?? 0) - 240 } : event,
    );
    expect(traceFrames(late, [F1], FILE)).toHaveLength(1);
  });

  const NO_WINDOW = 'holds no window of frame 2';
  const OUTSIDE = 'has frame 1 (measured from 200.30000001192093 ms) outside every task';
  const refusals: [string, TraceEvent[], Frame[], string][] = [
    [
      'no window of a frame',
      [W1, W2, F1, F3].flatMap((frame) => frameEvents(frame)),
      FRAMES,
      `${NO_WINDOW} (measured from 230.1 ms) after the frame before it.`,
    ],
    ['frames out of order', EVENTS, [F2, F1], NO_WINDOW],
    ['a frame measured twice', EVENTS, [F1, F1], NO_WINDOW],
    [
      'a window of another length',
      EVENTS,
      [{ start: 230.1, duration: 10.403 }],
      'gives frame 1 (measured from 230.1 ms) a window of another length.',
    ],
    [
      'a window outside every timeline task',
      EVENTS.map((event) => (event.cat === 'devtools.timeline' ? { ...event, dur: 100 } : event)),
      FRAMES,
      OUTSIDE,
    ],
    [
      'timeline tasks on another thread only',
      EVENTS.map((event) => (event.ph === 'X' ? { ...event, tid: 8 } : event)),
      FRAMES,
      OUTSIDE,
    ],
    [
      'windows on two threads',
      [...frameEvents(W1), ...frameEvents(F1, { pid: 7, tid: 9 })],
      [W1, F1],
      'has frame 2 (measured from 200.30000001192093 ms) on another thread than the first frame.',
    ],
    ['a window that never ends', EVENTS.slice(0, -1), FRAMES, 'window that never ends.'],
    ['a window that ends twice', [...EVENTS, endOf(F3)], FRAMES, 'window that is not closed once.'],
    ['no frame', EVENTS, [], 'was given no frame to find.'],
  ];

  it.each(refusals)('refuses %s, naming the file', (_, found, frames, message) => {
    expect(() => traceFrames(found, frames, FILE)).toThrow(`${FILE} `);
    expect(() => traceFrames(found, frames, FILE)).toThrow(message);
  });
});

describe('readTraceRecord', () => {
  it("reads a traced pass's record", () => {
    expect(readTraceRecord(RECORD, 'B1.frames.json')).toEqual(RECORD);
  });

  it('refuses a malformed record, or a trace outside its folder, naming the file', () => {
    const refused = [
      null,
      { ...RECORD, id: 1 },
      { ...RECORD, trace: '../report.json' },
      { ...RECORD, trace: 'B1.trace' },
      { ...RECORD, categories: 'v8' },
      { ...RECORD, categories: [1] },
      { ...RECORD, warmUp: -1 },
      { ...RECORD, warmUp: 1.5 },
      { ...RECORD, frames: [] },
      { ...RECORD, frames: [{ start: 1, duration: 2 }] },
      { ...RECORD, frames: [{ start: 1, duration: Number.NaN, ts: 3 }] },
      { ...RECORD, details: [] },
    ];
    for (const value of refused) {
      expect(() => readTraceRecord(value, 'B1.frames.json')).toThrow(/^B1\.frames\.json is not /u);
    }
  });
});

const FOLDER = 'browser/traces';
const TRACE = Buffer.from(JSON.stringify(traceOf(EVENTS)));

/** The files of a traced pass, by name, as the report reads them from their folder. */
const filesOf =
  (files: Readonly<Record<string, unknown>>) =>
  (name: string): Buffer | undefined => {
    const content = files[name];
    if (content === undefined || Buffer.isBuffer(content)) return content;
    return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
  };

const GOOD = { 'B1.frames.json': RECORD, 'B1.trace.json': TRACE };

describe('traceResult', () => {
  it('checks the trace against its record and gives its size, digest and frames', () => {
    const { p95, ...result } = traceResult('B1', FOLDER, filesOf(GOOD));
    expect(result).toEqual({
      id: 'B1',
      trace: 'browser/traces/B1.trace.json',
      record: 'browser/traces/B1.frames.json',
      bytes: TRACE.length,
      sha256: createHash('sha256').update(TRACE).digest('hex'),
      events: EVENTS.length + 1,
      frames: 3,
      warmUp: 2,
      median: 7.2,
    });
    expect(p95).toBeCloseTo(10.08, 9);
  });

  const record = (change: Readonly<Record<string, unknown>>) => ({ ...RECORD, ...change });
  const refusals: [string, Readonly<Record<string, unknown>>, RegExp][] = [
    ['no record', { 'B1.trace.json': TRACE }, /^browser\/traces\/B1\.frames\.json is missing/u],
    [
      'a record that is no JSON',
      { ...GOOD, 'B1.frames.json': '{' },
      /^browser\/traces\/B1\.frames\.json is not JSON/u,
    ],
    ['no trace', { 'B1.frames.json': RECORD }, /^browser\/traces\/B1\.trace\.json is missing/u],
    [
      'a trace that is no JSON',
      { ...GOOD, 'B1.trace.json': '[' },
      /^browser\/traces\/B1\.trace\.json is not JSON/u,
    ],
    [
      "another pass's frames",
      {
        ...GOOD,
        'B1.frames.json': record({ frames: traced([F1, { start: 290.5, duration: 7 }]) }),
      },
      /^browser\/traces\/B1\.trace\.json /u,
    ],
    [
      'a start in the trace that is not its window',
      {
        ...GOOD,
        'B1.frames.json': record({ frames: traced(FRAMES).map((f) => ({ ...f, ts: f.ts + 1 })) }),
      },
      /^browser\/traces\/B1\.frames\.json gives frame 1 the start 980000200301 in the trace/u,
    ],
    [
      'other categories',
      { ...GOOD, 'B1.frames.json': record({ categories: ['-*', 'v8'] }) },
      /^browser\/traces\/B1\.frames\.json was traced with other categories/u,
    ],
    [
      "another measurement's record",
      { ...GOOD, 'B1.frames.json': record({ id: 'B2' }) },
      /^browser\/traces\/B1\.frames\.json is the record of B2, not of B1/u,
    ],
  ];

  it.each(refusals)('refuses %s, naming the file', (_, files, message) => {
    expect(() => traceResult('B1', FOLDER, filesOf(files))).toThrow(message);
  });
});

describe('traceMarkdown', () => {
  it('renders each trace with its frames, their median and 95th percentile, size and digest', () => {
    const result = traceResult('B1', FOLDER, filesOf(GOOD));
    const markdown = traceMarkdown([result]).join('\n');
    expect(markdown).toContain('### Traces');
    expect(markdown).toContain(
      '| Id | Frames | Median | 95th percentile | Trace | Bytes | SHA-256 |',
    );
    expect(markdown).toContain(
      `| B1 | 3 after 2 | 7.2 ms | 10.08 ms | \`browser/traces/B1.trace.json\` | ${String(TRACE.length)} | \`${result.sha256}\` |`,
    );
    expect(traceMarkdown([])).toEqual([]);
  });
});
