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

  it('keeps the line order of unrelated rows that started in the same millisecond', () => {
    const steps = orderSteps([row(1, { do: 'key', key: 'a' }), row(1, { do: 'download' })]);
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

// The runner writes a row when its step ends, so the rows a trigger ran come before its own.
describe('orderSteps with triggers', () => {
  it('puts a trigger before the rows it ran when they started in the same millisecond', () => {
    // The runner writes the key row first, when the key step ends, then the download row.
    const key = { do: 'key', key: 'Control+s' };
    const steps = orderSteps([row(1, key), row(1, { do: 'download', name: 'x', trigger: [key] })]);
    expect(steps.map((s) => [s.line, s.do])).toEqual([
      [2, 'download'],
      [1, 'key'],
    ]);
  });

  it('rebuilds nested triggers, and a trigger that stopped at a failed step', () => {
    const [a, b, open] = [{ do: 'key', key: 'a' }, { do: 'key', key: 'b' }, { do: 'role' }];
    const chooser = { do: 'fileChooser', trigger: [open] };
    const nested = orderSteps([
      row(1, a),
      row(1, open),
      row(1, chooser),
      row(1, { do: 'download', trigger: [a, chooser] }),
    ]);
    expect(nested.map((s) => s.line)).toEqual([4, 1, 3, 2]);
    // Only the first trigger step ran, so only its row belongs to the parent.
    const stopped = orderSteps([row(1, a), row(1, a), row(1, { do: 'download', trigger: [a, b] })]);
    expect(stopped.map((s) => s.line)).toEqual([1, 3, 2]);
  });

  it('keeps the line order when the rows before a trigger are not its steps', () => {
    const steps = orderSteps([
      row(1, { invalid: 'number' }),
      row(1, { do: 'key', key: 'b' }),
      row(1, { do: 'download', trigger: [5, { do: 'key', key: 'a' }] }),
    ]);
    expect(steps.map((s) => s.line)).toEqual([1, 2, 3]);
  });
});

describe('the times of the rows and entries', () => {
  const started = (value) => () => orderSteps([{ started: value, step: { do: 'key' } }]);

  it('accept only the canonical UTC form, which is copied into the committed file', () => {
    for (const value of ['0000-01-01T00:00:00.000Z', '9999-12-31T23:59:59.999Z'])
      expect(started(value)()[0].started).toBe(value);
    // Forms that Date.parse reads, some as another instant or another day, and invalid ones.
    for (const value of [
      '2026-01-01T00:00:00Z',
      '2026-01-01T00:00:00.000+01:00',
      '2026-01-01 00:00:00.000Z',
      '2026-02-30T00:00:00.000Z',
      '2026-01-01T24:00:00.000Z',
      '2026-13-01T00:00:00.000Z',
      '+010000-01-01T00:00:00.000Z',
      ' 2026-01-01T00:00:00.000Z',
    ])
      expect(started(value), value).toThrow(/^timeline line 1: no valid time\.$/u);
  });

  it('refuse a netlog time in another form, naming its line and never quoting it', () => {
    const messageOf = (entries) => {
      try {
        placeSession(rows, entries);
      } catch (error) {
        return error.message;
      }
      return '';
    };
    const offset = messageOf([request(11), { ...request(12), at: `${at(12).slice(0, -1)}+00:00` }]);
    expect(offset).toBe('netlog line 2: no valid time.');
    // Compared as a boolean first, so a failing run never prints the synthetic room value.
    const room = messageOf([{ ...request(12), at: `${at(12)}#room=${ROOM},${KEY}` }]);
    expect(room.includes(ROOM) || room.includes(KEY)).toBe(false);
    expect(room).toBe('netlog line 1: no valid time.');
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

  it('counts an entry written in the millisecond a drawing step started as written during it', () => {
    const { drawing } = placeSession(rows, [request(20)]);
    expect(drawing.entries_during).toBe(1);
    expect(drawing.next_entry_ms).toEqual({ min: 0, max: 0 });
    expect(drawing.without_later_entry).toBe(1);
  });

  it('places an entry under the step a trigger ran, not the trigger, in the same millisecond', () => {
    const key = { do: 'key', key: 'Control+s' };
    const placed = placeSession(
      [row(1, key), row(1, { do: 'download', name: 'x', trigger: [key] })],
      [request(1.1)],
    );
    expect(placed.placements.map((p) => [p.line, p.do, p.entries])).toEqual([
      [1, 'key', ['+100 request script 200 https://example.test/a.js']],
    ]);
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
