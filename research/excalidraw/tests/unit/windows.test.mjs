import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createRunner } from '../../lib/server.mjs';
import {
  driverOverlap,
  parseJson,
  recordOf,
  summariseRecord,
  summariseWindow,
  windowOf,
} from '../../lib/windows.mjs';

const observeRecord = {
  evidence_id: 'ev_observe',
  operation: 'observe_web_session',
  parameters: { allowed_origins: ['https://example.test'] },
  normalized_result: {
    window: {
      armed_at: '2026-01-01T00:00:10.000Z',
      ended_at: '2026-01-01T00:00:20.000Z',
      requested_ms: 10000,
      end_reason: 'window_elapsed',
    },
    timeline: [
      { type: 'lifecycle', detail: 'init', timestamp: 1 },
      { type: 'navigation_committed', detail: null, timestamp: null },
      { type: 'lifecycle', detail: 'load', timestamp: 2 },
    ],
    completeness: { status: 'attach_limited', conditions: ['attach_limited'] },
    limitations: ['Only navigation metadata is retained.'],
  },
};

const inspectRecord = {
  evidence_id: 'ev_inspect',
  operation: 'inspect_web_page',
  parameters: { allowed_origins: ['https://example.test'] },
  normalized_result: {
    capture_window: {
      started_at: '2026-01-01T00:00:10.000Z',
      ended_at: '2026-01-01T00:00:20.000Z',
      observation_ms: 10000,
    },
    network: { requests: [], websocket_connections: [], coverage_started_at: 'n' },
    console: { events: [{}], coverage_started_at: 'c' },
    workers: [],
    storage: { cache_names: ['a', 'b'] },
    completeness: { status: 'policy_filtered', unavailable_sections: ['workers'] },
  },
};

const rows = [
  { started: '2026-01-01T00:00:09.900Z', step: { do: 'tap' }, result: {} },
  { started: '2026-01-01T00:00:10.000Z', step: { do: 'drag' }, result: {} },
  { started: '2026-01-01T00:00:12.000Z', step: { do: 'scene', label: 'probe-a' }, result: {} },
  { started: '2026-01-01T00:00:13.000Z', step: { do: 'scene', label: 'probe-a' }, error: 'x' },
  { started: '2026-01-01T00:00:20.001Z', step: { do: 'drag' }, result: {} },
];

describe('raw files that are not valid JSON', () => {
  it('are named, with neither the parse message nor the parse error kept', () => {
    // Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
    const room = 'a1B2'.repeat(5);
    expect(parseJson('{"ok":true}', 's/rea/f.json')).toEqual({ ok: true });
    const thrown = (() => {
      try {
        parseJson(`{"note":"https://example.test/#room=${room}" x}`, 's/rea/f.json');
      } catch (error) {
        return error;
      }
    })();
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe('s/rea/f.json: not valid JSON.');
    expect(thrown).not.toHaveProperty('cause');
    expect(String(thrown.stack).includes(room), 'room value in the stack').toBe(false);
  });
});

describe('REA CLI envelopes', () => {
  it('unwraps CLI envelopes and keeps MCP records as they are', () => {
    expect(recordOf({ ok: true, data: observeRecord })).toBe(observeRecord);
    expect(recordOf(observeRecord)).toBe(observeRecord);
    expect(recordOf([observeRecord])).toEqual([observeRecord]);
  });

  it('refuses a CLI envelope that does not report ok: true, even with a record inside', () => {
    for (const ok of [false, 'true', 1, undefined]) {
      expect(() => recordOf({ ok, data: observeRecord }), String(ok)).toThrow(
        /REA CLI output does not report ok: true/u,
      );
    }
    expect(() => recordOf({ ok: false, error: { code: 'target_not_found' } })).toThrow(
      /\(error code target_not_found\)/u,
    );
    const text = `https://example.test/#room=${'a1B2'.repeat(5)}`;
    expect(() => recordOf({ ok: false, error: { code: text, message: text } })).toThrow(
      /^The REA CLI output does not report ok: true, so it holds no Evidence record to read\.$/u,
    );
  });

  it('names only error codes shaped like REA identifiers, never one of a room value length', () => {
    const named = (code) => () => recordOf({ ok: false, error: { code } });
    // Codes are capped at 64 characters: the 64-character identifier is named, and 65-character
    // ones of either case are not.
    const [longest, tooLong] = [`${'abcd_'.repeat(12)}abcd`, `${'abcd_'.repeat(12)}abcde`];
    expect([longest.length, tooLong.length]).toEqual([64, 65]);
    for (const code of [
      'target_not_found',
      'INVALID_OUTPUT_FILTER',
      'invalid-row',
      'ENOENT',
      longest,
    ])
      expect(named(code), code).toThrow(`(error code ${code})`);
    // Room ids are 20 characters and keys 22, from [A-Za-z0-9_-]; every one of these matched the
    // earlier filter. A real REA code of either length (INVALID_OUTPUT_VALUE) is left out too, and
    // so are codes with digits or mixed case, which REA's own codes do not have.
    for (const code of [
      'a1B2c3D4e5F6g7H8i9J0',
      '0f3a9c1d7e5b2a8c4d6e',
      'abcdefghijklmnopqrst',
      'Q2xlYW4tcm9vbS1rZXk_AB',
      'abcdefghij_klmnopqrstu',
      'ABCDEFGHIJK-LMNOPQRSTU',
      'INVALID_OUTPUT_VALUE',
      'http_404',
      'Target_Not_Found',
    ]) {
      expect(named(code), code).toThrow(
        /^The REA CLI output does not report ok: true, so it holds no Evidence record to read\.$/u,
      );
    }
    for (const code of [tooLong, tooLong.toUpperCase()])
      expect(named(code), code).toThrow(/^The REA CLI output does not report ok: true, so it/u);
  });

  it('refuses a CLI envelope that reports ok: true without an Evidence record', () => {
    for (const data of [undefined, null, {}, { operation: 'inspect_web_page' }]) {
      expect(() => recordOf({ ok: true, data }), JSON.stringify(data)).toThrow(
        /reports ok: true but holds no Evidence record/u,
      );
    }
  });
});

describe('REA window summaries', () => {
  it('reads both window shapes and rejects records without one', () => {
    expect(windowOf(observeRecord.normalized_result)).toEqual({
      start: '2026-01-01T00:00:10.000Z',
      end: '2026-01-01T00:00:20.000Z',
      requested_ms: 10000,
      end_reason: 'window_elapsed',
    });
    expect(windowOf(inspectRecord.normalized_result)?.end_reason).toBeNull();
    expect(windowOf({})).toBeNull();
  });

  it('states that a session observation retains navigation metadata only', () => {
    const summary = summariseRecord(observeRecord);
    expect(summary?.retains).toBe('navigation and lifecycle metadata only');
    expect(summary?.timeline_events).toEqual({
      'lifecycle:init': 1,
      navigation_committed: 1,
      'lifecycle:load': 1,
    });
    expect(summary?.timeline_events_without_timestamp).toBe(1);
    expect(summary).not.toHaveProperty('network_requests');
  });

  it('counts request, WebSocket and console metadata of a page inspection', () => {
    const summary = summariseRecord(inspectRecord);
    expect(summary).toMatchObject({
      network_requests: 0,
      websocket_connections: 0,
      console_events: 1,
      workers: 0,
      cache_names: 2,
      unavailable_sections: ['workers'],
      allowed_origins: ['https://example.test'],
    });
  });

  it('ignores other operations', () => {
    expect(summariseRecord({ operation: 'capture_web_screenshot' })).toBeNull();
    expect(summariseRecord(undefined)).toBeNull();
  });
});

describe('REA window summaries of incomplete records', () => {
  it('reports what a record lacks as null or empty, never as a count of zero', () => {
    const inspect = { operation: 'inspect_web_page', evidence_id: 'ev_bare' };
    expect(summariseRecord(inspect)).toEqual({
      evidence_id: 'ev_bare',
      operation: 'inspect_web_page',
      allowed_origins: [],
      window: null,
      completeness: null,
      conditions: [],
      attach_limited_sections: [],
      policy_filtered_sections: [],
      unavailable_sections: [],
      retains: 'page inventory plus request, WebSocket and console metadata',
      network_coverage_started_at: null,
      console_coverage_started_at: null,
      network_requests: null,
      websocket_connections: null,
      console_events: null,
      workers: null,
      cache_names: null,
      limitations: [],
    });
    const notLists = { network: { requests: {}, websocket_connections: 'x' }, workers: 3 };
    expect(summariseRecord({ ...inspect, normalized_result: notLists })).toMatchObject({
      network_requests: null,
      websocket_connections: null,
      workers: null,
    });
  });

  it('reports a session observation without a timeline list as null, an empty list as zero', () => {
    const observe = (normalized_result) =>
      summariseRecord({ operation: 'observe_web_session', evidence_id: 'ev', normalized_result });
    const unknown = { timeline_events: null, timeline_events_without_timestamp: null };
    expect(observe(undefined)).toMatchObject(unknown);
    for (const timeline of [null, {}, 'x', 3])
      expect(observe({ timeline }), JSON.stringify(timeline)).toMatchObject(unknown);
    expect(observe({ timeline: [] })).toMatchObject({
      timeline_events: {},
      timeline_events_without_timestamp: 0,
    });
  });
});

// The timeline rows that the real runner writes for steps that are not objects. Its step record
// is then { invalid: <type> }, which names no kind (lib/server.mjs).
async function invalidStepRows(steps) {
  const dir = mkdtempSync(join(tmpdir(), 'pw-windows-test-'));
  try {
    const timelineFile = join(dir, 'timeline.jsonl');
    const ctx = createRunner({ steps: new Map(), timelineFile, base: {} });
    for (const step of steps) await ctx.run(step).catch(() => undefined);
    return readFileSync(timelineFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('REA window overlap with the driver timeline', () => {
  it('reports the driver steps inside the window and the step just before it', () => {
    const overlap = driverOverlap(rows, windowOf(observeRecord.normalized_result));
    expect(overlap).toEqual({
      steps: 3,
      failed: 1,
      by_kind: { drag: 1, scene: 2 },
      probe_labels: ['probe-a'],
      first_step_at: '2026-01-01T00:00:10.000Z',
      last_step_at: '2026-01-01T00:00:13.000Z',
      previous_step: { at: '2026-01-01T00:00:09.900Z', do: 'tap' },
    });
  });

  it('counts a step that is not an object under null, as the driver logs it', async () => {
    const real = await invalidStepRows([null, 42, 'tap']);
    expect(real.map((row) => row.step)).toEqual([
      { invalid: 'object' },
      { invalid: 'number' },
      { invalid: 'string' },
    ]);
    const times = [
      '2026-01-01T00:00:09.000Z',
      '2026-01-01T00:00:11.000Z',
      '2026-01-01T00:00:12.000Z',
    ];
    const timed = real.map((row, index) => ({ ...row, started: times[index] }));
    expect(driverOverlap(timed, windowOf(observeRecord.normalized_result))).toMatchObject({
      steps: 2,
      failed: 2,
      by_kind: { null: 2 },
      probe_labels: [],
      previous_step: { at: times[0], do: null },
    });
  });

  it('counts a null or missing step under null too, which the driver never writes', () => {
    const bare = [
      { started: '2026-01-01T00:00:09.000Z', step: null, error: 'x' },
      { started: '2026-01-01T00:00:11.000Z', error: 'y' },
    ];
    expect(driverOverlap(bare, windowOf(observeRecord.normalized_result))).toMatchObject({
      steps: 1,
      failed: 1,
      by_kind: { null: 1 },
      probe_labels: [],
      previous_step: { at: '2026-01-01T00:00:09.000Z', do: null },
    });
  });

  it('attaches the overlap only when the record has a window', () => {
    expect(summariseWindow(inspectRecord, rows)?.driver.steps).toBe(3);
    const noWindow = { ...observeRecord, normalized_result: {} };
    expect(summariseWindow(noWindow, rows)).not.toHaveProperty('driver');
    expect(driverOverlap([], windowOf(observeRecord.normalized_result)).previous_step).toBeNull();
  });
});
