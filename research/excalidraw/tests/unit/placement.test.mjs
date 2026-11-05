// Unit tests for the placement of netlog entries in the driver timeline (lib/placement.mjs):
// step order, the step in effect when an entry was written, the entry texts, the drawing
// summary and the redaction of step names. Synthetic rows and entries only.
import { describe, expect, it } from 'vitest';

import { DRAWING, entryText, latestStep, orderSteps, placeSession } from '../../lib/placement.mjs';

// Synthetic, low-entropy room values built at run time (see sanitise.test.mjs).
const ROOM = 'a1B2'.repeat(5);
const KEY = `${'k_L-'.repeat(5)}m1`;

const at = (seconds) => new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString();
const row = (seconds, step) => ({ started: at(seconds), step, result: {} });
const request = (seconds, extra = {}) => ({
  at: at(seconds),
  event: 'request',
  method: 'GET',
  type: 'script',
  status: 200,
  fromServiceWorker: false,
  origin: 'https://example.test',
  path: '/a.js',
  queryKeys: [],
  hasFragment: false,
  ...extra,
});

describe('orderSteps', () => {
  it('orders rows by start and keeps their timeline line numbers', () => {
    // A trigger's nested row is written before its parent, which started first.
    const steps = orderSteps([
      row(2, { do: 'role', role: 'button', name: 'Export' }),
      row(1, { do: 'download', name: 'x', trigger: [{ do: 'role' }] }),
      row(3, { do: 'wait', ms: 10 }),
    ]);
    expect(steps.map((s) => [s.line, s.do])).toEqual([
      [2, 'download'],
      [1, 'role'],
      [3, 'wait'],
    ]);
    expect(steps[1].name).toBe('Export');
    expect(steps[0].name).toBeUndefined();
  });

  it('keeps the line order of rows that started in the same millisecond', () => {
    const steps = orderSteps([row(1, { do: 'key' }), row(1, { do: 'download' })]);
    expect(steps.map((s) => s.line)).toEqual([1, 2]);
  });

  it('names a kind only when it is a plain step name', () => {
    const steps = orderSteps([
      row(1, { do: 'touchDrag' }),
      row(2, { invalid: 'string' }),
      row(3, { do: 'a b' }),
      row(4, null),
    ]);
    expect(steps.map((s) => s.do)).toEqual(['touchDrag', null, null, null]);
  });

  it('redacts a room value in a role name', () => {
    const [step] = orderSteps([row(1, { do: 'role', name: `#room=${ROOM},${KEY}` })]);
    expect(step.name.includes(ROOM)).toBe(false);
    expect(step.name.includes(KEY)).toBe(false);
  });

  it('refuses a row without a valid start time, naming its line', () => {
    expect(() => orderSteps([row(1, { do: 'key' }), { step: { do: 'key' } }])).toThrow(
      'timeline line 2: no valid time.',
    );
    expect(() => orderSteps([{ started: 'soon', step: { do: 'key' } }])).toThrow(
      'timeline line 1: no valid time.',
    );
  });
});

describe('latestStep', () => {
  const steps = orderSteps([row(1, { do: 'a' }), row(3, { do: 'b' }), row(3, { do: 'c' })]);
  const t = (seconds) => Date.parse(at(seconds));

  it('finds the step that started last at or before a time', () => {
    expect(latestStep(steps, t(0))).toBe(-1);
    expect(latestStep(steps, t(1))).toBe(0);
    expect(latestStep(steps, t(2))).toBe(0);
    expect(latestStep(steps, t(3))).toBe(2);
    expect(latestStep(steps, t(9))).toBe(2);
  });
});

describe('entryText', () => {
  it('writes the offset, event, type, status, origin and path, and the flags', () => {
    expect(entryText(request(0), 372)).toBe('+372 request script 200 https://example.test/a.js');
    expect(
      entryText(
        request(0, { fromServiceWorker: true, queryKeys: ['a', 'b'], hasFragment: true }),
        0,
      ),
    ).toBe('+0 request script 200 https://example.test/a.js sw q2 fragment');
    expect(
      entryText({ at: at(0), event: 'worker', origin: 'https://w.test', path: '/w.js' }, 5),
    ).toBe('+5 worker https://w.test/w.js');
    expect(entryText({ at: at(0), event: 'request', type: 'image', scheme: 'data:' }, -40)).toBe(
      '-40 request image data:',
    );
    expect(entryText({ at: at(0), event: 'request-failed', unparseable: true }, 1)).toBe(
      '+1 request-failed unparseable',
    );
    expect(entryText({ at: at(0), event: 'websocket-open', origin: 'wss://w.test' }, 2)).toBe(
      '+2 websocket-open wss://w.test',
    );
  });

  it('keeps no field it does not know, and no failure text', () => {
    const entry = { at: at(0), event: 'odd event', type: 'Bad Type', status: '200', failure: 'x' };
    expect(entryText({ ...entry, origin: 'https://o.test', path: '/' }, 1)).toBe(
      '+1 other https://o.test/',
    );
  });

  it('redacts a room value that reached a path', () => {
    const text = entryText(request(0, { path: `/x#room=${ROOM},${KEY}` }), 1);
    expect(text.includes(ROOM)).toBe(false);
  });
});

// A session with a load, a mouse drag, a wait, a touch drag and a role click.
const rows = [
  row(10, { do: 'goto', url: 'https://example.test/' }),
  row(20, { do: 'drag', from: [0, 0], to: [1, 1] }),
  row(21, { do: 'wait', ms: 800 }),
  row(30, { do: 'touchDrag', from: [[0, 0]], to: [[1, 1]] }),
  row(31, { do: 'role', role: 'button', name: 'Export' }),
];

describe('placeSession', () => {
  it('places each entry under the step in effect, with its offset from that step', () => {
    const placed = placeSession(rows, [
      request(9),
      request(11),
      request(12, { origin: 'https://cdn.test', path: '/f.woff2', fromServiceWorker: true }),
      request(25),
      { at: at(33), event: 'worker', origin: 'https://example.test', path: '/w.js' },
    ]);
    expect(placed.timeline_rows).toBe(5);
    expect(placed.netlog_entries).toBe(5);
    expect(placed.before_first_step).toEqual([
      '-1000 request script 200 https://example.test/a.js',
    ]);
    expect(placed.placements).toEqual([
      {
        line: 1,
        started: at(10),
        do: 'goto',
        entries: [
          '+1000 request script 200 https://example.test/a.js',
          '+2000 request script 200 https://cdn.test/f.woff2 sw',
        ],
      },
      {
        line: 3,
        started: at(21),
        do: 'wait',
        entries: ['+4000 request script 200 https://example.test/a.js'],
      },
      {
        line: 5,
        started: at(31),
        do: 'role',
        name: 'Export',
        entries: ['+2000 worker https://example.test/w.js'],
      },
    ]);
  });

  it('refuses a session without timeline rows, and an entry without a valid time', () => {
    expect(() => placeSession([], [request(1)])).toThrow('no timeline rows');
    expect(() => placeSession(rows, [request(11), { event: 'request' }])).toThrow(
      'netlog line 2: no valid time.',
    );
  });
});

describe('the drawing summary of placeSession', () => {
  it('summarises the drawing steps: counts, entries during them and the next entry after', () => {
    const { drawing } = placeSession(rows, [request(11), request(20.5), request(25)]);
    expect(Object.keys(drawing.steps)).toEqual(DRAWING);
    expect(drawing.steps).toEqual({ drag: 1, path: 0, touchDrag: 1 });
    expect(drawing.entries_during).toBe(1);
    expect(drawing.next_entry_ms).toEqual({ min: 500, max: 500 });
    expect(drawing.without_later_entry).toBe(1);
    expect(drawing.last_started).toBe(at(30));
  });

  it('reports no next entry when no entry follows any drawing step', () => {
    const { drawing } = placeSession(rows, [request(11)]);
    expect(drawing.entries_during).toBe(0);
    expect(drawing.next_entry_ms).toBeNull();
    expect(drawing.without_later_entry).toBe(2);
  });

  it('reports no drawing for a session without drawing steps', () => {
    const { drawing } = placeSession(rows.slice(0, 1), [request(11)]);
    expect(drawing).toEqual({
      steps: { drag: 0, path: 0, touchDrag: 0 },
      entries_during: 0,
      next_entry_ms: null,
      without_later_entry: 0,
      last_started: null,
    });
  });
});
