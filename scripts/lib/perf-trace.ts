import { createHash } from 'node:crypto';

import { percentile, statisticOf } from './perf-budgets.ts';
import { formatValue } from './perf-report.ts';

/**
 * B1's trace (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided): after
 * B1's own frames, which no trace slows, the browser measurements pan B1's scene again while
 * Chromium traces the whole browser, and keep the trace beside a record of that pass's frames,
 * each with its start on the page's clock and in the trace. This module checks that the trace
 * holds every frame of the pass: its user-timing window, as long as the page measured it, inside a
 * task that the timeline recorded on the window's thread. The performance report checks the record
 * and the trace again, gives the trace's size and digest, and fails when either is missing or the
 * trace does not hold the record's frames.
 */

/** What Chromium traces: the timeline, V8 and its garbage collection, the frames and every task. */
export const TRACE_CATEGORIES: readonly string[] = [
  '-*',
  'devtools.timeline',
  'v8',
  'disabled-by-default-v8.gc',
  'blink.user_timing',
  'toplevel',
];

/** The user-timing name of a render that redraws the scene layer. */
export const SCENE_RENDER = 'planewright:render-scene';

/** Chromium's grain of `performance.now()` on a page that is not cross-origin isolated, in µs. */
const CLOCK_GRAIN = 100;

/** How far a window's length in whole µs may be from the page's measured duration, in ms. */
const LENGTH_TOLERANCE = 0.002;

/** How far a window's recorded start may be from the page's, in ms: rounding of the number only. */
const START_TOLERANCE = 1e-6;

export interface TraceEvent {
  readonly name: string;
  readonly cat: string;
  readonly ph: string;
  readonly pid: number;
  readonly tid: number;
  /** On the trace's clock, in µs. */
  readonly ts: number;
  readonly dur?: number;
  readonly id2?: unknown;
  readonly args?: Readonly<Record<string, unknown>>;
}

/** A frame as the page measured it, on its clock in ms. */
export interface MeasuredFrame {
  readonly start: number;
  readonly duration: number;
}

/** A measured frame with the start of its window in the trace, in µs. */
export interface TracedFrame extends MeasuredFrame {
  readonly ts: number;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEvent = (value: unknown): value is TraceEvent =>
  isRecord(value) &&
  ['name', 'cat', 'ph'].every((field) => typeof value[field] === 'string') &&
  ['pid', 'tid', 'ts'].every((field) => Number.isFinite(value[field]));

/** A Chromium trace's events, refusing anything else. */
export function traceEventsOf(value: unknown, file: string): TraceEvent[] {
  const events = isRecord(value) ? value['traceEvents'] : undefined;
  if (!Array.isArray(events) || events.length === 0 || !events.every(isEvent)) {
    throw new Error(`${file} is not a Chromium trace: it needs a list of trace events.`);
  }
  return events;
}

interface Window {
  readonly pid: number;
  readonly tid: number;
  /** The page's start of the measure, in ms. */
  readonly start: number;
  readonly begin: number;
  readonly end: number;
}

/** The scene renders' user-timing windows, in the order of the trace's clock. */
function sceneWindows(events: readonly TraceEvent[], file: string): Window[] {
  const marks = events
    .filter(({ cat, name }) => cat === 'blink.user_timing' && name === SCENE_RENDER)
    .filter(({ ph }) => ph === 'b' || ph === 'e')
    .sort((a, b) => a.ts - b.ts);
  const windows: Window[] = [];
  let open: TraceEvent | undefined;
  for (const mark of marks) {
    if ((mark.ph === 'b') === (open !== undefined)) {
      throw new Error(`${file} has a scene render's window that is not closed once.`);
    }
    if (open === undefined) open = mark;
    else {
      const start = Number(open.args?.['startTime']);
      windows.push({ pid: open.pid, tid: open.tid, start, begin: open.ts, end: mark.ts });
      open = undefined;
    }
  }
  if (open !== undefined) throw new Error(`${file} has a scene render's window that never ends.`);
  return windows;
}

/** Whether a timeline task holds the window, give or take the page's clock grain. */
const inTask = (window: Window, tasks: readonly TraceEvent[]): boolean =>
  tasks.some(
    ({ pid, tid, ts, dur = 0 }) =>
      pid === window.pid &&
      tid === window.tid &&
      ts <= window.begin + CLOCK_GRAIN &&
      ts + dur >= window.end - CLOCK_GRAIN,
  );

const frameName = (index: number, { start }: MeasuredFrame): string =>
  `frame ${String(index + 1)} (measured from ${String(start)} ms)`;

/** Refuses a window that is not the frame's measure, on the frames' thread, in a timeline task. */
function checkWindow(window: Window, frame: MeasuredFrame, context: FrameContext): void {
  const { file, first, tasks } = context;
  const name = frameName(context.index, frame);
  if (Math.abs((window.end - window.begin) / 1000 - frame.duration) > LENGTH_TOLERANCE) {
    throw new Error(`${file} gives ${name} a window of another length.`);
  }
  if (window.pid !== first.pid || window.tid !== first.tid) {
    throw new Error(`${file} has ${name} on another thread than the first frame.`);
  }
  if (!inTask(window, tasks)) {
    throw new Error(`${file} has ${name} outside every task that the timeline recorded.`);
  }
}

interface FrameContext {
  readonly file: string;
  readonly index: number;
  readonly first: Window;
  readonly tasks: readonly TraceEvent[];
}

/** A pass's frames as the trace must hold them: its warm-up's renders, then each measured one. */
export interface PassFrames {
  /** How many scene renders of the pass came before its measured frames. */
  readonly warmUp: number;
  readonly frames: readonly MeasuredFrame[];
}

/**
 * Each measured frame with the start of its window in the trace. The trace must hold exactly the
 * pass's scene renders, the warm-up's and then one window per measured frame, in order, so that
 * the frames whose tail is read are all the trace holds after the warm-up, refusing any other.
 */
export function traceFrames(
  events: readonly TraceEvent[],
  { warmUp, frames }: PassFrames,
  file: string,
): TracedFrame[] {
  if (frames.length === 0) throw new Error(`${file} was given no frame to find.`);
  const windows = sceneWindows(events, file);
  if (windows.length !== warmUp + frames.length) {
    const [count, measured] = [String(windows.length), String(frames.length)];
    throw new Error(
      `${file} holds ${count} scene renders, not the ${String(warmUp)} of the warm-up and the ${measured} measured frames of the pass.`,
    );
  }
  const tasks = events.filter(
    ({ cat, ph }) => ph === 'X' && cat.split(',').includes('devtools.timeline'),
  );
  const measured = windows.slice(warmUp);
  let first: Window | undefined;
  return frames.map((frame, index) => {
    const window = measured[index];
    if (window === undefined || Math.abs(window.start - frame.start) > START_TOLERANCE) {
      const render = `scene render ${String(warmUp + index + 1)}`;
      throw new Error(
        `${file} holds no window of ${frameName(index, frame)}: its ${render} starts at ${String(window?.start)} ms.`,
      );
    }
    first ??= window;
    checkWindow(window, frame, { file, index, first, tasks });
    return { start: frame.start, duration: frame.duration, ts: window.begin };
  });
}

/** The record of a traced pass, beside its trace. */
export interface TraceRecord {
  /** The budget whose frames were traced again. */
  readonly id: string;
  /** The trace's file name, in the record's folder. */
  readonly trace: string;
  readonly categories: readonly string[];
  readonly warmUp: number;
  readonly frames: readonly TracedFrame[];
  readonly details?: Readonly<Record<string, unknown>>;
}

/** The names of a traced pass's files, in their folder. */
export const traceFiles = (id: string) => ({
  trace: `${id}.trace.json`,
  record: `${id}.frames.json`,
});

const isTracedFrame = (value: unknown): value is TracedFrame =>
  isRecord(value) && ['start', 'duration', 'ts'].every((field) => Number.isFinite(value[field]));

/** A bare file name, so that a record can name no file outside its own folder. */
const isFileName = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]+(?:\.[\w-]+)*\.json$/u.test(value);

const isTextList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((each) => typeof each === 'string');

const isCount = (value: unknown): boolean => Number.isInteger(value) && Number(value) >= 0;

const isFrameList = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0 && value.every(isTracedFrame);

/** A traced pass's record, refusing a malformed one or a trace outside the record's folder. */
export function readTraceRecord(value: unknown, file: string): TraceRecord {
  const { id, trace, categories, warmUp, frames, details } = isRecord(value) ? value : {};
  const valid =
    typeof id === 'string' &&
    isFileName(trace) &&
    isTextList(categories) &&
    isCount(warmUp) &&
    isFrameList(frames) &&
    (details === undefined || isRecord(details));
  if (!valid) {
    throw new Error(
      `${file} is not a trace record: it needs an id, a trace, categories and frames.`,
    );
  }
  return value as TraceRecord;
}

/** What the performance report keeps of a checked trace, its paths relative to perf-results/. */
export interface TraceResult {
  readonly id: string;
  readonly trace: string;
  readonly record: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly events: number;
  readonly frames: number;
  readonly warmUp: number;
  readonly median: number;
  readonly p95: number;
}

function readJson(read: (name: string) => Buffer | undefined, name: string, path: string) {
  const content = read(name);
  if (content === undefined) throw new Error(`${path} is missing.`);
  try {
    return { content, value: JSON.parse(content.toString('utf8')) as unknown };
  } catch (error) {
    throw new Error(`${path} is not JSON: ${String(error)}`, { cause: error });
  }
}

/** Refuses a record that another trace's frames or another pass's categories would make. */
function checkRecord(record: TraceRecord, id: string, path: string): void {
  if (record.id !== id) {
    throw new Error(`${path} is the record of ${record.id}, not of ${id}.`);
  }
  const same =
    record.categories.length === TRACE_CATEGORIES.length &&
    record.categories.every((category, index) => category === TRACE_CATEGORIES[index]);
  if (!same) {
    throw new Error(`${path} was traced with other categories: ${record.categories.join(',')}.`);
  }
}

/**
 * The traced pass of budget `id` in `folder`, read through `read`: its record and trace checked
 * against each other, with the trace's size, digest and events and the frames' statistics.
 */
export function traceResult(
  id: string,
  folder: string,
  read: (name: string) => Buffer | undefined,
): TraceResult {
  const names = traceFiles(id);
  const recordPath = `${folder}/${names.record}`;
  const record = readTraceRecord(readJson(read, names.record, recordPath).value, recordPath);
  checkRecord(record, id, recordPath);
  const tracePath = `${folder}/${record.trace}`;
  const { content, value } = readJson(read, record.trace, tracePath);
  const events = traceEventsOf(value, tracePath);
  const found = traceFrames(events, record, tracePath);
  found.forEach(({ ts }, index) => {
    const given = record.frames[index]?.ts;
    if (given !== ts) {
      const frame = `frame ${String(index + 1)} the start ${String(given)} in the trace`;
      throw new Error(`${recordPath} gives ${frame}, but its window starts at ${String(ts)}.`);
    }
  });
  const durations = record.frames.map(({ duration }) => duration);
  return {
    ...{ id, trace: tracePath, record: recordPath, bytes: content.length },
    ...{ sha256: createHash('sha256').update(content).digest('hex'), events: events.length },
    ...{ frames: record.frames.length, warmUp: record.warmUp },
    ...{ median: percentile(durations, 0.5), p95: statisticOf('p95', durations) },
  };
}

const row = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;
const TRACE_HEADER = ['Id', 'Frames', 'Median', '95th percentile', 'Trace', 'Bytes', 'SHA-256'];

/** The report's section on the traces, none when no trace was checked. */
export function traceMarkdown(results: readonly TraceResult[]): string[] {
  if (results.length === 0) return [];
  return [
    '### Traces',
    '',
    "After B1's own frames, which no trace slows, B1's pans ran again while Chromium traced the browser. The record beside each trace gives each traced frame's start on the page's clock and in the trace; these values are that pass's, not B1's.",
    '',
    row(TRACE_HEADER),
    row(TRACE_HEADER.map(() => '---')),
    ...results.map(({ id, frames, warmUp, median, p95, trace, bytes, sha256 }) =>
      row([
        ...[id, `${String(frames)} after ${String(warmUp)}`],
        ...[`${formatValue(median)} ms`, `${formatValue(p95)} ms`],
        ...[`\`${trace}\``, String(bytes), `\`${sha256}\``],
      ]),
    ),
    '',
  ];
}
