import { describe, expect, it } from 'vitest';

import { TRACE_CATEGORIES, traceEventsOf, traceFiles, traceFrames } from '../lib/perf-trace.ts';
import type { TraceEvent } from '../lib/perf-trace.ts';
import {
  EVENTS,
  F1,
  F2,
  F3,
  FRAMES,
  METADATA,
  W1,
  W2,
  at,
  endOf,
  frameEvents,
  traceOf,
} from './trace-fixtures.ts';
import type { Frame } from './trace-fixtures.ts';

// B1's trace (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): the
// browser measurements pan B1's scene again while Chromium traces the browser, and keep the trace
// with each traced frame's start on the page's clock and in the trace, once the trace holds
// every frame inside a task that the timeline recorded.

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
