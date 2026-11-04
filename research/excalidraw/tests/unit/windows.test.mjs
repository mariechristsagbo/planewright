import { describe, expect, it } from 'vitest';

import {
  driverOverlap,
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

describe('REA window summaries', () => {
  it('unwraps CLI envelopes and keeps MCP records as they are', () => {
    expect(recordOf({ ok: true, data: observeRecord })).toBe(observeRecord);
    expect(recordOf(observeRecord)).toBe(observeRecord);
  });

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

  it('attaches the overlap only when the record has a window', () => {
    expect(summariseWindow(inspectRecord, rows)?.driver.steps).toBe(3);
    const noWindow = { ...observeRecord, normalized_result: {} };
    expect(summariseWindow(noWindow, rows)).not.toHaveProperty('driver');
    expect(driverOverlap([], windowOf(observeRecord.normalized_result)).previous_step).toBeNull();
  });
});
