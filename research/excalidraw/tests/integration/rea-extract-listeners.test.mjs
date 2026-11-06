// Runs rea-extract.mjs on a synthetic REA listener inspection (R-65) in a temporary directory. The
// record holds the shapes a real one holds: script source text, a source-map URL, script ids and
// callback locations, none of which may reach the summary. No REA call is made and no website is
// contacted.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rea-extract.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pw-rea-listeners-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// A key-shaped value built at run time, so no secret shape sits in this file.
const KEY = ['AI', 'za', 'Sy', 'k'.repeat(33)].join('');
const QUERY = 'v=q1W2e3R4';
const SCRIPT_URL = `https://example.test/assets/index-abc.js?${QUERY}`;
const location = (line) => ({
  script_id: '42',
  url: SCRIPT_URL,
  line_number: line,
  column_number: 7,
  function_name: 'handlerName',
  source_association: 'script_id',
});
const listener = (type, flags = {}) => ({
  type,
  use_capture: false,
  passive: false,
  once: false,
  ...flags,
  location: location(11),
  execution: 'unknown',
});
const record = {
  ok: true,
  data: {
    operation: 'inspect_web_event_listeners',
    evidence_id: 'ev-listeners',
    parameters: { selector: 'canvas.interactive', target_id: 'T1', allowed_origins: [] },
    normalized_result: {
      inspected_at: '2026-01-01T00:00:00Z',
      selected_node: { selector: 'canvas.interactive', match: 'found', backend_node_id: 9 },
      listeners: [listener('click'), listener('touchstart', { passive: true, once: true })],
      sources: [
        {
          script_id: '42',
          url: SCRIPT_URL,
          source_map_url: 'index-abc.js.map',
          language: 'JavaScript',
          source: {
            state: 'captured',
            text: `const key = "${KEY}";`,
            sha256: 'f'.repeat(64),
            utf8_bytes: 27,
          },
        },
      ],
      cleanup: 'confirmed',
      limitations: ['Inspects listeners registered directly on the first native CSS match.'],
    },
  },
};
const extract = (input) =>
  spawnSync(process.execPath, [SCRIPT, input], { encoding: 'utf8', cwd: dir });
const run = () => {
  const input = join(dir, 'listeners.json');
  writeFileSync(input, JSON.stringify(record));
  const result = extract(input);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
};

describe('rea-extract.mjs listener inspections', () => {
  it('keeps each listener type and flag, the selector, the cleanup and the script path', () => {
    const summary = JSON.parse(run());
    expect(summary).toEqual({
      kind: 'rea-event-listeners',
      evidence_id: 'ev-listeners',
      selector: 'canvas.interactive',
      matched: true,
      listeners: [
        {
          type: 'click',
          use_capture: false,
          passive: false,
          once: false,
          execution: 'unknown',
          script: 'https://example.test/assets/index-abc.js',
        },
        {
          type: 'touchstart',
          use_capture: false,
          passive: true,
          once: true,
          execution: 'unknown',
          script: 'https://example.test/assets/index-abc.js',
        },
      ],
      sources: [
        {
          script: 'https://example.test/assets/index-abc.js',
          language: 'JavaScript',
          state: 'captured',
          utf8_bytes: 27,
        },
      ],
      cleanup: 'confirmed',
      limitations: ['Inspects listeners registered directly on the first native CSS match.'],
    });
  });

  it('writes no source text, source-map URL, callback location, script id or query value', () => {
    const text = run();
    expect(text.includes(KEY)).toBe(false);
    expect(text.includes(QUERY)).toBe(false);
    for (const absent of ['.map', 'line_number', 'column_number', 'handlerName', 'script_id']) {
      expect(text.includes(absent), absent).toBe(false);
    }
    expect(text.includes('f'.repeat(64))).toBe(false);
  });

  it('reports a selector that matched nothing as unmatched', () => {
    const input = join(dir, 'unmatched.json');
    const unmatched = structuredClone(record);
    unmatched.data.normalized_result.selected_node.match = 'not_found';
    unmatched.data.normalized_result.listeners = [];
    writeFileSync(input, JSON.stringify(unmatched));
    const result = extract(input);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ matched: false, listeners: [] });
  });
});
