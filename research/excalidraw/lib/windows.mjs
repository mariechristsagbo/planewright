// Pure reductions of saved REA observation records and driver timeline rows into sanitized,
// committable facts: window bounds, completeness conditions, allowed origins, event-type counts
// and the driver steps that started inside each window. No URLs, payloads or values.

const OPERATIONS = new Set(['observe_web_session', 'inspect_web_page']);

const tally = (items, keyOf) => {
  const out = {};
  for (const item of items) out[keyOf(item)] = (out[keyOf(item)] ?? 0) + 1;
  return out;
};

// The CLI's error code is named in the message only when it has the shape of REA's own codes
// (target_not_found, INVALID_OUTPUT_FILTER, invalid-row, ENOENT): letters of one case in words
// joined by `_` or `-`, at most 64 characters. A code as long as a room id (20) or key (22) is
// never named, even a real one, and page text such as a URL never has that shape.
const IDENTIFIER = /^(?:[a-z]+(?:[_-][a-z]+)*|[A-Z]+(?:[_-][A-Z]+)*)$/u;
const ROOM_VALUE_LENGTHS = new Set([20, 22]);
const failureCode = (envelope) => {
  const code = envelope.error?.code;
  const named =
    typeof code === 'string' &&
    code.length <= 64 &&
    !ROOM_VALUE_LENGTHS.has(code.length) &&
    IDENTIFIER.test(code);
  return named ? ` (error code ${code})` : '';
};

// REA CLI output wraps one Evidence record as { ok, data }; the MCP server saves the bare record.
// An envelope must report ok: true and hold a record, so a failed CLI call is never read as one.
export function recordOf(parsed) {
  if (parsed === null || typeof parsed !== 'object' || !('ok' in parsed || 'data' in parsed)) {
    return parsed;
  }
  if (parsed.ok !== true) {
    throw new Error(
      `The REA CLI output does not report ok: true${failureCode(parsed)}, so it holds no ` +
        'Evidence record to read.',
    );
  }
  if (!parsed.data?.evidence_id) {
    throw new Error('The REA CLI output reports ok: true but holds no Evidence record in data.');
  }
  return parsed.data;
}

export function windowOf(result) {
  if (result?.window) {
    const { armed_at: start, ended_at: end, requested_ms, end_reason } = result.window;
    return { start, end, requested_ms, end_reason };
  }
  if (result?.capture_window) {
    const { started_at: start, ended_at: end, observation_ms } = result.capture_window;
    return { start, end, requested_ms: observation_ms, end_reason: null };
  }
  return null;
}

function observed(result) {
  const timeline = result.timeline ?? [];
  return {
    retains: 'navigation and lifecycle metadata only',
    timeline_events: tally(timeline, (e) => (e.detail ? `${e.type}:${e.detail}` : e.type)),
    timeline_events_without_timestamp: timeline.filter((e) => e.timestamp === null).length,
  };
}

const countOf = (list) => (Array.isArray(list) ? list.length : null);

function inspected(result) {
  return {
    retains: 'page inventory plus request, WebSocket and console metadata',
    network_coverage_started_at: result.network?.coverage_started_at ?? null,
    console_coverage_started_at: result.console?.coverage_started_at ?? null,
    network_requests: countOf(result.network?.requests),
    websocket_connections: countOf(result.network?.websocket_connections),
    console_events: countOf(result.console?.events),
    workers: countOf(result.workers),
    cache_names: countOf(result.storage?.cache_names),
  };
}

function completenessOf(result) {
  const completeness = result.completeness ?? {};
  return {
    completeness: completeness.status ?? null,
    conditions: completeness.conditions ?? [],
    attach_limited_sections: completeness.attach_limited_sections ?? [],
    policy_filtered_sections: completeness.policy_filtered_sections ?? [],
    unavailable_sections: completeness.unavailable_sections ?? [],
  };
}

export function summariseRecord(record) {
  if (!OPERATIONS.has(record?.operation)) return null;
  const result = record.normalized_result ?? {};
  return {
    evidence_id: record.evidence_id,
    operation: record.operation,
    allowed_origins: record.parameters?.allowed_origins ?? [],
    window: windowOf(result),
    ...completenessOf(result),
    ...(record.operation === 'observe_web_session' ? observed(result) : inspected(result)),
    limitations: result.limitations ?? [],
  };
}

// Driver steps whose start time lies inside the window, plus the last step that started before
// it, so that a window armed after a scenario's first steps is visible.
export function driverOverlap(rows, window) {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  const at = (row) => Date.parse(row.started);
  const inside = rows.filter((row) => at(row) >= start && at(row) <= end);
  const before = rows.filter((row) => at(row) < start).at(-1);
  return {
    steps: inside.length,
    failed: inside.filter((row) => row.result === undefined).length,
    by_kind: tally(inside, (row) => row.step?.do ?? null),
    probe_labels: [...new Set(inside.map((row) => row.step?.label).filter(Boolean))],
    first_step_at: inside[0]?.started ?? null,
    last_step_at: inside.at(-1)?.started ?? null,
    previous_step: before ? { at: before.started, do: before.step?.do ?? null } : null,
  };
}

export function summariseWindow(record, rows) {
  const summary = summariseRecord(record);
  if (!summary?.window) return summary;
  return { ...summary, driver: driverOverlap(rows, summary.window) };
}
