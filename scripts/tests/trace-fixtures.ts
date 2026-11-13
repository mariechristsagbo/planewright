import { SCENE_RENDER, TRACE_CATEGORIES } from '../lib/perf-trace.ts';
import type { TraceEvent } from '../lib/perf-trace.ts';

// What the trace tests share: Chromium trace events of measured scene renders, each a user-timing
// window inside an animation frame's timeline task on the page's main thread, warm-up frames
// before three measured ones, the record of those three, the record of a paired control that
// measured three frames untraced, and the budget pass's three samples.

const MAIN = { pid: 7, tid: 7 };
/** The page's time origin on the trace's clock, in µs, as Chromium's monotonic clock gives it. */
const ORIGIN = 980_000_000_000.4;

export interface Frame {
  readonly start: number;
  readonly duration: number;
}

export const at = (time: number): number => Math.round(ORIGIN + time * 1000);

/** The user-timing window's end of a measured render. */
export const endOf = ({ start, duration }: Frame, thread = MAIN): TraceEvent => ({
  ...{ cat: 'blink.user_timing', name: SCENE_RENDER, ph: 'e', ...thread },
  ...{ ts: at(start + duration), id2: { local: '0x2e' }, args: {} },
});

/** The events of one measured render: its user-timing window inside the animation frame's task. */
export function frameEvents(frame: Frame, thread = MAIN): TraceEvent[] {
  const begin = at(frame.start);
  const end = at(frame.start + frame.duration);
  return [
    {
      ...{ cat: 'devtools.timeline', name: 'FireAnimationFrame', ph: 'X', ...thread },
      ...{ ts: begin - 40, dur: end - begin + 80 },
    },
    {
      ...{ cat: 'blink.user_timing', name: SCENE_RENDER, ph: 'b', ...thread, ts: begin },
      ...{ id2: { local: '0x2e' }, args: { startTime: frame.start, detail: '{"elements":5000}' } },
    },
    endOf(frame, thread),
  ];
}

export const W1 = { start: 100.1, duration: 9.2 };
export const W2 = { start: 140.3, duration: 8.7 };
export const F1 = { start: 200.30000001192093, duration: 7.099999994039536 };
export const F2 = { start: 230.1, duration: 10.4 };
export const F3 = { start: 260.4, duration: 7.2 };
const WARM_UP = [W1, W2];
export const FRAMES = [F1, F2, F3];

export const METADATA: TraceEvent = {
  ...{ cat: '__metadata', name: 'thread_name', ph: 'M', ...MAIN, ts: 0 },
  args: { name: 'CrRendererMain' },
};

/** A trace whose events are those given, after a metadata event, in another order. */
export const traceOf = (events: readonly TraceEvent[]) => ({
  traceEvents: [METADATA, ...[...events].reverse()],
  metadata: { 'clock-domain': 'LINUX_CLOCK_MONOTONIC' },
});

export const EVENTS = [...WARM_UP, ...FRAMES].flatMap((frame) => frameEvents(frame));
export const traced = (frames: readonly Frame[]) =>
  frames.map((frame) => ({ ...frame, ts: at(frame.start) }));

export const RECORD = {
  id: 'B1',
  pass: 'traced',
  trace: 'B1.trace.json',
  categories: [...TRACE_CATEGORIES],
  warmUp: 2,
  frames: traced(FRAMES),
  details: {
    seed: 21,
    count: 5000,
    inView: 5000,
    browser: 'Chromium 156.0.8078.4',
    cpuSlowdown: 1,
  },
};

export const CONTROL = {
  id: 'B1',
  pass: 'control',
  warmUp: 2,
  frames: [
    { start: 120.5, duration: 6.9 },
    { start: 150.2, duration: 7.4 },
    { start: 181.7, duration: 9.6 },
  ],
  details: {
    seed: 21,
    count: 5000,
    inView: 5000,
    browser: 'Chromium 156.0.8078.4',
    cpuSlowdown: 1,
  },
};

/** B1's measurement of the budget pass, as its browser measurement file holds it. */
export const BUDGET = {
  id: 'B1',
  samples: [7.5, 6.8, 7.1],
  details: {
    ...{ seed: 21, count: 5000, inView: 5000, warmUp: 2, by: 'wheel pans of 2 px back and forth' },
    ...{ browser: 'Chromium 156.0.8078.4', cpuSlowdown: 1 },
  },
};

/** The files of a traced pass and its control, by name, as the report reads them from their folder. */
export const filesOf =
  (files: Readonly<Record<string, unknown>>) =>
  (name: string): Buffer | undefined => {
    const content = files[name];
    if (content === undefined || Buffer.isBuffer(content)) return content;
    return Buffer.from(typeof content === 'string' ? content : JSON.stringify(content));
  };
