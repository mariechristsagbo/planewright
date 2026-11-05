// Unit tests for request start times in the netlog placement (lib/placement.mjs): netlogs written
// before the driver recorded starts keep their earlier placement, and later ones count the
// requests that started while a drawing step was the latest to start. Synthetic data only.
import { describe, expect, it } from 'vitest';

import { entryText, placeSession } from '../../lib/placement.mjs';

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

const ROWS = [
  row(0, { do: 'key', key: 'r' }),
  row(1, { do: 'drag', from: [1, 1], to: [2, 2] }),
  row(3, { do: 'wait', ms: 800 }),
];

describe('placement without request start times', () => {
  it('keeps the drawing summary and entry texts of a netlog that has no start key', () => {
    const placed = placeSession(ROWS, [request(3.5)]);
    expect('request_starts' in placed.drawing).toBe(false);
    expect(placed.placements[0].entries).toEqual([
      '+500 request script 200 https://example.test/a.js',
    ]);
  });
});

describe('placement with request start times', () => {
  it('counts a request that started during a drawing step and was written after it', () => {
    const placed = placeSession(ROWS, [request(3.5, { startedAt: at(1.25) })]);
    expect(placed.drawing.entries_during).toBe(0);
    expect(placed.drawing.request_starts).toEqual({ known: 1, unknown: 0, during_drawing: 1 });
    expect(placed.placements).toEqual([
      expect.objectContaining({
        line: 3,
        entries: ['+500 request script 200 https://example.test/a.js start-1750'],
      }),
    ]);
  });

  it('counts a null start as unknown and leaves its text without a start', () => {
    const placed = placeSession(ROWS, [
      request(0.5, { startedAt: at(0.25) }),
      request(3.5, { startedAt: null }),
    ]);
    expect(placed.drawing.request_starts).toEqual({ known: 1, unknown: 1, during_drawing: 0 });
    expect(placed.placements.map((p) => p.entries)).toEqual([
      ['+500 request script 200 https://example.test/a.js start+250'],
      ['+500 request script 200 https://example.test/a.js'],
    ]);
  });

  it('counts failed requests and never counts workers or navigations', () => {
    const entries = [
      { at: at(1.5), event: 'worker', origin: 'https://example.test', path: '/w.js' },
      { at: at(1.6), event: 'navigated', origin: 'https://example.test', path: '/' },
      request(3.5, { event: 'request-failed', startedAt: at(1.5), failure: 'net::ERR_FAILED' }),
    ];
    const placed = placeSession(ROWS, entries);
    expect(placed.drawing.request_starts).toEqual({ known: 1, unknown: 0, during_drawing: 1 });
    expect(placed.drawing.entries_during).toBe(2);
  });

  it.each(['2026-01-01T00:00:01Z', '2026-01-01 00:00:01.000Z', 1700000000000])(
    'stops on a start time %s that is not in the canonical form, naming the line only',
    (startedAt) => {
      const entries = [request(0.5, { startedAt: at(0.25) }), request(3.5, { startedAt })];
      expect(() => placeSession(ROWS, entries)).toThrow(/^netlog line 2 start: no valid time\.$/u);
    },
  );
});

describe('entryText with a start offset', () => {
  it('adds the start offset from the same step start, signed', () => {
    expect(entryText(request(0), 40, -12)).toBe(
      '+40 request script 200 https://example.test/a.js start-12',
    );
    expect(entryText(request(0), 40, 0)).toBe(
      '+40 request script 200 https://example.test/a.js start+0',
    );
  });
});
