import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  TRACE_CATEGORIES,
  readTraceRecord,
  refusedTrace,
  traceEventsOf,
  traceFiles,
  traceFrames,
  traceResult,
} from '../lib/perf-trace.ts';
import type { PassFrames, TraceEvent } from '../lib/perf-trace.ts';
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
  filesOf,
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
    expect(traceFiles('B1')).toEqual({
      trace: 'B1.trace.json',
      record: 'B1.frames.json',
      control: 'B1.control.json',
      refusedTrace: 'B1.trace.refused.json',
      refused: 'B1.refused.json',
    });
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
  const pass = (frames: readonly Frame[], warmUp = 2) => ({ warmUp, frames });

  it("gives each measured frame its window's start in the trace, after the warm-up's", () => {
    const traced = traceFrames(events, pass(FRAMES), FILE);
    expect(traced).toEqual(FRAMES.map((frame) => ({ ...frame, ts: at(frame.start) })));
  });

  it("accepts a window that the page's 0.1 ms clock puts up to 0.1 ms outside its task", () => {
    const late = frameEvents(F1).map((event) =>
      event.ph === 'X' ? { ...event, ts: event.ts + 140, dur: (event.dur ?? 0) - 240 } : event,
    );
    expect(traceFrames(late, pass([F1], 0), FILE)).toHaveLength(1);
  });

  it("accepts a window whose recorded start differs from the page's by the number's rounding", () => {
    const printed = frameEvents(F1).map((event) =>
      event.ph === 'b' ? { ...event, args: { startTime: F1.start + 4e-12 } } : event,
    );
    expect(traceFrames(printed, pass([F1], 0), FILE)).toEqual([{ ...F1, ts: at(F1.start) }]);
  });

  const renders = (count: number, frames: number, warmUp = 2) =>
    `holds ${String(count)} scene renders, not the ${String(warmUp)} of the warm-up and the ${String(frames)} measured frames of the pass.`;
  const OUTSIDE = 'has frame 1 (measured from 200.30000001192093 ms) outside every task';
  const refusals: [string, TraceEvent[], PassFrames, string][] = [
    [
      'no window of a frame',
      [W1, W2, F1, F3].flatMap((frame) => frameEvents(frame)),
      pass(FRAMES),
      renders(4, 3),
    ],
    ['a measured render that the pass leaves out', EVENTS, pass([F1, F3]), renders(5, 2)],
    ['a render after the last measured frame', EVENTS, pass([F1, F2]), renders(5, 2)],
    ['a warm-up longer than the record says', EVENTS, pass(FRAMES, 1), renders(5, 3, 1)],
    [
      'frames out of order',
      EVENTS,
      pass([F2, F1, F3]),
      'holds no window of frame 1 (measured from 230.1 ms): its scene render 3 starts at 200.30000001192093 ms.',
    ],
    [
      'a frame measured twice',
      EVENTS,
      pass([F1, F1, F3]),
      'holds no window of frame 2 (measured from 200.30000001192093 ms): its scene render 4 starts at 230.1 ms.',
    ],
    [
      'a warm-up render given as a measured frame',
      EVENTS,
      pass([W2, F1, F2]),
      'holds no window of frame 1 (measured from 140.3 ms): its scene render 3 starts at',
    ],
    [
      'a window of another length',
      EVENTS,
      pass([{ start: 260.4, duration: 7.203 }], 4),
      'gives frame 1 (measured from 260.4 ms) a window of another length.',
    ],
    [
      'a window outside every timeline task',
      EVENTS.map((event) => (event.cat === 'devtools.timeline' ? { ...event, dur: 100 } : event)),
      pass(FRAMES),
      OUTSIDE,
    ],
    [
      'timeline tasks on another thread only',
      EVENTS.map((event) => (event.ph === 'X' ? { ...event, tid: 8 } : event)),
      pass(FRAMES),
      OUTSIDE,
    ],
    [
      'a window 0.2 ms before its task, more than the clock gives',
      frameEvents(F1).map((event) =>
        event.ph === 'X' ? { ...event, ts: event.ts + 240, dur: (event.dur ?? 0) - 240 } : event,
      ),
      pass([F1], 0),
      OUTSIDE,
    ],
    [
      'tasks of another category only',
      EVENTS.map((event) => (event.ph === 'X' ? { ...event, cat: 'toplevel' } : event)),
      pass(FRAMES),
      OUTSIDE,
    ],
    [
      'windows on two threads',
      [...frameEvents(W1), ...frameEvents(F1, { pid: 7, tid: 9 })],
      pass([W1, F1], 0),
      'has frame 2 (measured from 200.30000001192093 ms) on another thread than the first frame.',
    ],
    ['a window that never ends', EVENTS.slice(0, -1), pass(FRAMES), 'window that never ends.'],
    [
      'a window that ends twice',
      [...EVENTS, endOf(F3)],
      pass(FRAMES),
      'window that is not closed once.',
    ],
    ['no frame', EVENTS, pass([]), 'was given no frame to find.'],
  ];

  it.each(refusals)('refuses %s, naming the file', (_, found, given, message) => {
    expect(() => traceFrames(found, given, FILE)).toThrow(`${FILE} `);
    expect(() => traceFrames(found, given, FILE)).toThrow(message);
  });
});

describe('refusedTrace', () => {
  it('says why the check refused a trace, beside the frames the pass measured', () => {
    const error = new Error(
      'B1.trace.json has frame 5 (measured from 1569.4 ms) outside every task',
    );
    expect(refusedTrace('B1', { warmUp: 2, frames: FRAMES }, error)).toEqual({
      ...{ id: 'B1', pass: 'traced', refused: error.message, trace: 'B1.trace.refused.json' },
      ...{ categories: TRACE_CATEGORIES, warmUp: 2, frames: FRAMES },
    });
    expect(refusedTrace('B1', { warmUp: 2, frames: [F1] }, 'no trace').refused).toBe('no trace');
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
      { ...RECORD, pass: 'control' },
      { ...RECORD, pass: undefined },
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

const GOOD = { 'B1.frames.json': RECORD, 'B1.trace.json': TRACE };

describe('traceResult', () => {
  it('checks the trace against its record and gives its size, digest and events, and the record', () => {
    expect(traceResult('B1', FOLDER, filesOf(GOOD))).toEqual({
      result: {
        id: 'B1',
        trace: 'browser/traces/B1.trace.json',
        record: 'browser/traces/B1.frames.json',
        bytes: TRACE.length,
        sha256: createHash('sha256').update(TRACE).digest('hex'),
        events: EVENTS.length + 1,
      },
      pass: RECORD,
    });
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
        'B1.frames.json': record({ frames: traced([F1, F2, { start: 290.5, duration: 7 }]) }),
      },
      /^browser\/traces\/B1\.trace\.json holds no window of frame 3 /u,
    ],
    [
      'a record that leaves out a measured frame of the trace',
      { ...GOOD, 'B1.frames.json': record({ frames: traced([F1, F3]) }) },
      /^browser\/traces\/B1\.trace\.json holds 5 scene renders, not the 2 of the warm-up and the 2 /u,
    ],
    [
      "a record whose warm-up is not the trace's",
      { ...GOOD, 'B1.frames.json': record({ warmUp: 3 }) },
      /^browser\/traces\/B1\.trace\.json holds 5 scene renders, not the 3 of the warm-up /u,
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
