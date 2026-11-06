// Pure reductions of a driver timeline and its netlog into sanitized, committable placements:
// each netlog entry is set against the timeline step that had started last when the driver wrote
// it. Both files take their times from the driver process's clock. The netlog writes a request
// when it has finished or failed (netlog.mjs), so an entry's time bounds the request's start from
// above and is never that start; the timeline records when each step started, not when it ended.
// Netlogs written since the observation batch also give each request's start (`startedAt`); for
// those, an entry text carries its start offset and the drawing summary counts request starts.
// Kept: step lines, kinds, start times and role names; per entry its offset, event, resource type,
// status, origin and path, and whether the service worker served it, how many query keys it had
// and whether its URL had a fragment. No query keys or values, headers, bodies or payloads.
import { redactSecrets } from './sanitise.mjs';

/** The step kinds that draw on the canvas: mouse drags, freehand paths, touch drags and paths. */
export const DRAWING = ['drag', 'path', 'touchDrag', 'touchPath'];
// Counted in a summary only when a session has one, so the summaries of the sessions run before
// the step existed are unchanged.
const LATER_KINDS = new Set(['touchPath']);

const EVENTS = new Set([
  'request',
  'request-failed',
  'websocket-open',
  'websocket-close',
  'worker',
  'navigated',
]);
const KIND = /^[A-Za-z]{1,32}$/u;
const TYPE = /^[a-z]{1,32}$/u;
// The form Date#toISOString writes for a four-digit year, which is how the driver writes times.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

// A start time is copied into the committed file as it is, so only that canonical form is read:
// another form, even one that Date.parse reads, and a day or hour that rolls over are refused.
const timeOf = (value, name) => {
  const t = typeof value === 'string' && ISO.test(value) ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(t) || new Date(t).toISOString() !== value)
    throw new Error(`${name}: no valid time.`);
  return t;
};

const kindOf = (step) => (typeof step?.do === 'string' && KIND.test(step.do) ? step.do : null);

// Role steps click a control by its accessible name; the name identifies the step in the record.
const nameOf = (step) =>
  step?.do === 'role' && typeof step.name === 'string' ? redactSecrets(step.name) : undefined;

const same = (step, wanted) => JSON.stringify(step) === JSON.stringify(wanted);

// Takes from `done` the rows that a trigger ran: the most rows just before its own whose steps
// are, in order, the first steps of the trigger (fewer than all when a trigger step failed).
function takeNested(done, trigger) {
  for (let k = Math.min(trigger.length, done.length); k > 0; k -= 1) {
    if (done.slice(-k).every((node, i) => same(node.step, trigger[i]))) return done.splice(-k);
  }
  return [];
}

// The runner writes a row when its step ends, so the rows that a trigger ran come just before the
// row of their parent, which started before them. Rebuilds that nesting from each parent's
// recorded trigger and returns the timeline lines in the order their steps started.
function startOrder(rows) {
  const done = [];
  rows.forEach((row, index) => {
    const trigger = Array.isArray(row?.step?.trigger) ? row.step.trigger : [];
    const nested = takeNested(done, trigger);
    done.push({ line: index + 1, step: row?.step, nested });
  });
  const lines = [];
  const visit = (node) => {
    lines.push(node.line);
    node.nested.forEach(visit);
  };
  done.forEach(visit);
  return lines;
}

/**
 * Timeline rows ordered by start time. Rows that started in the same millisecond keep the order in
 * which their steps started: a trigger before the rows it ran, which are written before it, and
 * other rows in line order.
 */
export function orderSteps(rows) {
  const rank = new Map(startOrder(rows).map((line, k) => [line, k]));
  return rows
    .map((row, index) => {
      const line = index + 1;
      const t = timeOf(row?.started, `timeline line ${String(line)}`);
      return { line, t, started: row.started, do: kindOf(row.step), name: nameOf(row.step) };
    })
    .sort((a, b) => a.t - b.t || rank.get(a.line) - rank.get(b.line));
}

/** The index of the step that started last at or before `t`, or -1 before the first step. */
export function latestStep(steps, t) {
  let [low, high, found] = [0, steps.length - 1, -1];
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (steps[middle].t <= t) [found, low] = [middle, middle + 1];
    else high = middle - 1;
  }
  return found;
}

const target = (entry) => {
  if (typeof entry.origin === 'string') return `${entry.origin}${String(entry.path ?? '')}`;
  return typeof entry.scheme === 'string' ? entry.scheme : 'unparseable';
};

const flags = (entry) => [
  entry.fromServiceWorker === true ? 'sw' : '',
  Array.isArray(entry.queryKeys) && entry.queryKeys.length > 0
    ? `q${String(entry.queryKeys.length)}`
    : '',
  entry.hasFragment === true ? 'fragment' : '',
];

/**
 * One entry as `<offset> <event> [type] [status] <origin+path> [sw] [qN] [fragment] [start]`;
 * `start±N` is the request's start offset from the same step start, when it is known.
 */
export function entryText(entry, ms, startMs) {
  const parts = [
    `${ms < 0 ? '' : '+'}${String(ms)}`,
    EVENTS.has(entry.event) ? entry.event : 'other',
    typeof entry.type === 'string' && TYPE.test(entry.type) ? entry.type : '',
    Number.isInteger(entry.status) ? String(entry.status) : '',
    target(entry),
    ...flags(entry),
    startMs === undefined ? '' : `start${startMs < 0 ? '' : '+'}${String(startMs)}`,
  ];
  return redactSecrets(parts.filter(Boolean).join(' '));
}

const isDrawing = (step) => DRAWING.includes(step?.do);
const REQUESTS = new Set(['request', 'request-failed']);

// A request's start time, or null when the entry has none. A start that is present must be in
// the canonical form, like every other time; netlogs written before starts were recorded have no
// `startedAt` key.
const startOf = (entry, index) =>
  REQUESTS.has(entry?.event) && 'startedAt' in entry && entry.startedAt !== null
    ? timeOf(entry.startedAt, `netlog line ${String(index + 1)} start`)
    : null;

/**
 * How many request starts are known, how many are not, and how many fell while a drawing step was
 * the latest to start. Absent for a netlog without start times, so its summary is unchanged.
 */
function requestStarts(steps, entries, starts) {
  const requests = entries.filter((entry) => REQUESTS.has(entry?.event));
  if (!requests.some((entry) => 'startedAt' in entry)) return {};
  const known = starts.filter((t) => t !== null);
  const during = known.filter((t) => isDrawing(steps[latestStep(steps, t)])).length;
  return {
    request_starts: {
      known: known.length,
      unknown: requests.length - known.length,
      during_drawing: during,
    },
  };
}

/**
 * The drawing steps of a session: how many of each kind, how many entries were written while one
 * of them was the latest step to start, and how long after each one's start the next entry came.
 */
function drawingSummary(steps, times) {
  const drawing = steps.filter(isDrawing);
  const gaps = drawing
    .map((step) => times.find((t) => t >= step.t))
    .map((t, k) => (t === undefined ? null : t - drawing[k].t));
  const known = gaps.filter((gap) => gap !== null);
  return {
    steps: Object.fromEntries(
      DRAWING.map((kind) => [kind, drawing.filter((s) => s.do === kind).length]).filter(
        ([kind, count]) => count > 0 || !LATER_KINDS.has(kind),
      ),
    ),
    entries_during: times.filter((t) => isDrawing(steps[latestStep(steps, t)])).length,
    next_entry_ms: known.length > 0 ? { min: Math.min(...known), max: Math.max(...known) } : null,
    without_later_entry: gaps.length - known.length,
    last_started: drawing.at(-1)?.started ?? null,
  };
}

const placementOf = (step, entries) => ({
  line: step.line,
  started: step.started,
  do: step.do,
  ...(step.name === undefined ? {} : { name: step.name }),
  entries,
});

/** Places every netlog entry of a session under the step in effect when it was written. */
export function placeSession(rows, entries) {
  if (rows.length === 0) throw new Error('no timeline rows');
  const steps = orderSteps(rows);
  const times = entries.map((entry, index) =>
    timeOf(entry?.at, `netlog line ${String(index + 1)}`),
  );
  const starts = entries.map(startOf);
  const groups = new Map();
  const before = [];
  entries.forEach((entry, index) => {
    const k = latestStep(steps, times[index]);
    const base = steps[Math.max(k, 0)].t;
    const start = starts[index] === null ? undefined : starts[index] - base;
    const text = entryText(entry, times[index] - base, start);
    if (k < 0) before.push(text);
    else groups.set(k, [...(groups.get(k) ?? []), text]);
  });
  return {
    timeline_rows: rows.length,
    netlog_entries: entries.length,
    drawing: {
      ...drawingSummary(
        steps,
        [...times].sort((a, b) => a - b),
      ),
      ...requestStarts(steps, entries, starts),
    },
    before_first_step: before,
    placements: [...groups.keys()]
      .sort((a, b) => a - b)
      .map((k) => placementOf(steps[k], groups.get(k))),
  };
}
