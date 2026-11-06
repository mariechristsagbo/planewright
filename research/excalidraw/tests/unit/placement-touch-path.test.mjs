// Unit tests for touch paths in the drawing summary of lib/placement.mjs: a touchPath step draws,
// and a session without one keeps the summary it had before the step existed. Synthetic rows and
// entries only.
import { describe, expect, it } from 'vitest';

import { DRAWING, placeSession } from '../../lib/placement.mjs';

const at = (seconds) => new Date(Date.UTC(2026, 0, 1) + seconds * 1000).toISOString();
const row = (seconds, step) => ({ started: at(seconds), step, result: {} });
const request = (seconds, start) => ({
  at: at(seconds),
  startedAt: at(start),
  event: 'request',
  method: 'GET',
  type: 'script',
  status: 200,
  fromServiceWorker: false,
  origin: 'https://example.test',
  path: '/a.js',
  queryKeys: [],
  hasFragment: false,
});
const path = {
  do: 'touchPath',
  points: [
    [1, 2],
    [3, 4],
  ],
};
const rows = [row(10, { do: 'tap', at: [1, 1] }), row(20, path), row(30, { do: 'wait', ms: 5 })];

describe('touch paths in the drawing summary', () => {
  it('lists touchPath among the drawing kinds', () => {
    expect(DRAWING).toEqual(['drag', 'path', 'touchDrag', 'touchPath']);
  });

  it('counts a touchPath step, the entries written during it and the request starts in it', () => {
    const { drawing } = placeSession(rows, [request(21, 20.5), request(31, 30.5)]);
    expect(drawing.steps).toEqual({ drag: 0, path: 0, touchDrag: 0, touchPath: 1 });
    expect(drawing.entries_during).toBe(1);
    expect(drawing.next_entry_ms).toEqual({ min: 1000, max: 1000 });
    expect(drawing.request_starts).toEqual({ known: 2, unknown: 0, during_drawing: 1 });
    expect(drawing.last_started).toBe(at(20));
  });

  it('leaves the touchPath count out for a session that has none', () => {
    const { drawing } = placeSession([rows[0], rows[2]], [request(31, 30.5)]);
    expect(drawing.steps).toEqual({ drag: 0, path: 0, touchDrag: 0 });
    expect(Object.keys(drawing.steps)).not.toContain('touchPath');
  });
});
