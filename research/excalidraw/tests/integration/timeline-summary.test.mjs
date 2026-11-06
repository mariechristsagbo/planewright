// Runs timeline-summary.mjs on synthetic timelines in a temporary folder. No browser is started
// and no website is contacted.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'timeline-summary.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pw-timeline-summary-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const appState = (started, label, tool, ids) => ({
  started,
  step: { do: 'appState', label },
  result: { selected: { activeTool: { type: tool }, selectedElementIds: ids } },
});
const scene = (started, label) => ({
  started,
  step: { do: 'scene', label },
  result: { elements: [] },
});

function summarise(name, rows, flags = []) {
  const file = join(dir, `${name}.jsonl`);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n'));
  return spawnSync(process.execPath, [SCRIPT, file, '--json', ...flags], { encoding: 'utf8' });
}

describe('timeline-summary.mjs repeated labels', () => {
  it('warns when one label is read more than once by the same probe', () => {
    const run = summarise('repeated', [
      appState('2026-01-01T00:00:01.000Z', 'tool-probe', 'selection', {}),
      appState('2026-01-01T00:00:09.000Z', 'tool-probe', 'selection', { a: true }),
    ]);
    expect(run.status).toBe(0);
    expect(run.stderr).toContain(
      'warning: label "tool-probe" was read 2 times by appState; the summary keeps the first ' +
        "read's time and the last read's values.",
    );
    expect(JSON.parse(run.stdout)).toEqual([
      expect.objectContaining({ label: 'tool-probe', at: '2026-01-01T00:00:01.000Z', selected: 1 }),
    ]);
  });

  it('does not warn for one scene and one appState read under the same label', () => {
    const run = summarise('pair', [
      scene('2026-01-01T00:00:01.000Z', 'pair'),
      appState('2026-01-01T00:00:01.100Z', 'pair', 'selection', {}),
    ]);
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
  });
});

describe('timeline-summary.mjs point counts', () => {
  const shapes = {
    started: '2026-01-01T00:00:01.000Z',
    step: { do: 'scene', label: 'shapes' },
    result: { elements: [{ type: 'arrow', points: 3 }, { type: 'rectangle' }] },
  };
  const elementsOf = (run) => JSON.parse(run.stdout)[0].elements;

  it('keeps the point count of an element that has points only with --points', () => {
    const run = summarise('points', [shapes], ['--points']);
    expect(run.status).toBe(0);
    const [arrow, rectangle] = elementsOf(run);
    expect(arrow.points).toBe(3);
    expect('points' in rectangle).toBe(false);
  });

  it('leaves the point count out by default, as in the summaries built before it', () => {
    const run = summarise('no-points', [shapes]);
    expect(run.status).toBe(0);
    for (const element of elementsOf(run)) expect('points' in element).toBe(false);
  });
});

describe('timeline-summary.mjs elbowed flag', () => {
  const arrows = (elbowed) => ({
    started: '2026-01-01T00:00:01.000Z',
    step: { do: 'scene', label: 'arrows' },
    result: {
      elements: [
        { type: 'arrow', points: 2, roundness: null, elbowed },
        { type: 'rectangle', roundness: 3 },
      ],
    },
  });
  const elementsOf = (run) => JSON.parse(run.stdout)[0].elements;

  it('keeps an arrow’s elbowed flag, which tells an elbow arrow from a sharp one', () => {
    for (const flag of [true, false]) {
      const run = summarise(`elbowed-${String(flag)}`, [arrows(flag)]);
      expect(run.status).toBe(0);
      const [arrow, rectangle] = elementsOf(run);
      expect(arrow.elbowed).toBe(flag);
      expect('elbowed' in rectangle).toBe(false);
    }
  });

  it('adds no elbowed key for a probe that did not read one, as in the earlier timelines', () => {
    const run = summarise('elbowed-absent', [arrows(undefined)]);
    expect(run.status).toBe(0);
    for (const element of elementsOf(run)) expect('elbowed' in element).toBe(false);
  });
});

describe('timeline-summary.mjs text fields', () => {
  const texts = {
    started: '2026-01-01T00:00:01.000Z',
    step: { do: 'scene', label: 'texts' },
    result: {
      elements: [
        { type: 'text', fontSize: 28, fontFamily: 5, textAlign: 'center' },
        { type: 'rectangle' },
      ],
    },
  };
  const elementsOf = (run) => JSON.parse(run.stdout)[0].elements;

  it('keeps a text element’s font size, family and alignment only with --text', () => {
    const run = summarise('text', [texts], ['--text']);
    expect(run.status).toBe(0);
    const [text, rectangle] = elementsOf(run);
    expect(text.font).toEqual([28, 5, 'center']);
    expect('font' in rectangle).toBe(false);
  });

  it('leaves the font out by default, as in the summaries built before it', () => {
    const run = summarise('no-text', [texts]);
    expect(run.status).toBe(0);
    for (const element of elementsOf(run)) expect('font' in element).toBe(false);
  });
});

describe('timeline-summary.mjs link and pressure fields', () => {
  const link = { origin: 'https://example.com', path: '/a' };
  const read = (fields) => ({
    started: '2026-01-01T00:00:01.000Z',
    step: { do: 'scene', label: 'later' },
    result: { elements: [{ type: 'freedraw', ...fields }, { type: 'rectangle' }] },
  });
  const elementsOf = (run) => JSON.parse(run.stdout)[0].elements;

  it('keeps a link and the pressure fields of an element whose probe read them', () => {
    const fields = { link, simulatePressure: false, pressures: 7, strokeOptions: { a: 1 } };
    const run = summarise('later', [read(fields)]);
    expect(run.status).toBe(0);
    const [stroke, rectangle] = elementsOf(run);
    expect(stroke).toMatchObject(fields);
    for (const key of Object.keys(fields)) expect(key in rectangle).toBe(false);
  });

  it('adds none of them for a probe that did not read them, as in the earlier timelines', () => {
    const run = summarise('later-absent', [read({})]);
    expect(run.status).toBe(0);
    for (const element of elementsOf(run)) {
      for (const key of ['link', 'simulatePressure', 'pressures', 'strokeOptions']) {
        expect(key in element).toBe(false);
      }
    }
  });
});

describe('timeline-summary.mjs focus, connectivity, layout and background reads', () => {
  const at = '2026-01-01T00:00:01.000Z';
  const row = (kind, label, result) => ({ started: at, step: { do: kind, label }, result });
  const focused = { tag: 'BUTTON', name: 'Rectangle', textChars: 1, focusVisible: true };
  const online = { onLine: false, controlled: true, registration: null, readyState: 'complete' };
  const layout = {
    viewport: [390, 844],
    lang: 'en',
    dir: 'ltr',
    appClass: 'raw only',
    buttons: [],
  };
  const rows = [
    row('focus', 'f', {
      focused,
      live: [{ role: 'status', live: 'polite', chars: 6, text: 'Copied' }],
    }),
    row('connectivity', 'c', online),
    row('layout', 'l', layout),
    row('appState', 'b', { selected: { viewBackgroundColor: '#ffc9c9' } }),
  ];

  it('keeps the focused element, live region lengths, connectivity, layout and background', () => {
    const run = summarise('view', rows);
    expect(run.status).toBe(0);
    const [focus, connectivity, view, background] = JSON.parse(run.stdout);
    expect(focus).toEqual({
      label: 'f',
      at,
      focused,
      live: [{ role: 'status', live: 'polite', chars: 6 }],
    });
    expect(connectivity).toEqual({ label: 'c', at, connectivity: online });
    expect(view).toEqual({
      label: 'l',
      at,
      layout: { viewport: [390, 844], lang: 'en', dir: 'ltr', buttons: [] },
    });
    expect(background).toMatchObject({ label: 'b', background: '#ffc9c9' });
  });

  it('copies no live region text and no app class name into the summary', () => {
    const run = summarise('view-text', rows);
    expect(run.stdout.includes('Copied')).toBe(false);
    expect(run.stdout.includes('raw only')).toBe(false);
  });

  it('adds no background key for an app state read without one, as in the earlier timelines', () => {
    const run = summarise('no-background', [appState(at, 'a', 'selection', {})]);
    expect(run.status).toBe(0);
    expect('background' in JSON.parse(run.stdout)[0]).toBe(false);
  });
});

describe('timeline-summary.mjs rows come from the probes only', () => {
  it('adds no row and no warning for a step whose label field names an option', () => {
    const pick = (started) => ({
      started,
      step: { do: 'selectOption', role: 'combobox', label: 'English' },
      result: { values: ['en'] },
    });
    const run = summarise('select', [
      pick('2026-01-01T00:00:01.000Z'),
      pick('2026-01-01T00:00:02.000Z'),
      appState('2026-01-01T00:00:03.000Z', 'after', 'selection', {}),
    ]);
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout).map((row) => row.label)).toEqual(['after']);
  });
});
