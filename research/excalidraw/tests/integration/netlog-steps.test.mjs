// Runs netlog-steps.mjs on synthetic session directories in a temporary directory: a session it
// places, and missing or malformed files that must stop the build. No browser is started and no
// website is contacted.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'netlog-steps.mjs');
const root = mkdtempSync(join(tmpdir(), 'pw-netlog-steps-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Synthetic, low-entropy room values built at run time (see sanitise.test.mjs).
const ROOM = 'a1B2'.repeat(5);
const KEY = `${'k_L-'.repeat(5)}m1`;

const rows = [
  { started: '2026-01-01T00:00:10.000Z', step: { do: 'goto', url: 'https://example.test/' } },
  { started: '2026-01-01T00:00:20.000Z', step: { do: 'drag', from: [0, 0], to: [1, 1] } },
  { started: '2026-01-01T00:00:21.000Z', step: { do: 'role', name: 'Export' } },
];
const entries = [
  { at: '2026-01-01T00:00:10.500Z', event: 'navigated', origin: 'https://example.test', path: '/' },
  {
    at: '2026-01-01T00:00:21.250Z',
    event: 'worker',
    origin: 'https://example.test',
    path: '/w.js',
  },
];
const lines = (items) => items.map((item) => `${JSON.stringify(item)}\n`).join('');

// Writes a session directory; `null` leaves a file out, a string is written as it is.
const session = (name, timeline, netlog) => {
  mkdirSync(join(root, name), { recursive: true });
  if (timeline !== null) writeFileSync(join(root, name, 'timeline.jsonl'), timeline);
  if (netlog !== null) writeFileSync(join(root, name, 'netlog.jsonl'), netlog);
};
const build = (output, ...sessions) =>
  spawnSync(process.execPath, [SCRIPT, root, join(root, output), ...sessions], {
    encoding: 'utf8',
    cwd: root,
  });

describe('netlog-steps.mjs', () => {
  it('places every entry of each session and names the drawing steps', () => {
    session('s-good', lines(rows), lines(entries));
    const run = build('good.json', 's-good');
    expect(run.status, run.stderr).toBe(0);
    const index = JSON.parse(readFileSync(join(root, 'good.json'), 'utf8'));
    expect(index.schema).toBe('planewright-research-netlog-steps/v1');
    expect(index.generated_by).toBe('research/excalidraw/netlog-steps.mjs');
    expect(index.drawing_steps).toEqual(['drag', 'path', 'touchDrag']);
    expect(index.sessions).toHaveLength(1);
    const [placed] = index.sessions;
    expect(placed).toMatchObject({ session: 's-good', timeline_rows: 3, netlog_entries: 2 });
    expect(placed.placements.map((p) => [p.line, p.do, p.entries])).toEqual([
      [1, 'goto', ['+500 navigated https://example.test/']],
      [3, 'role', ['+250 worker https://example.test/w.js']],
    ]);
    expect(placed.drawing.entries_during).toBe(0);
    expect(placed.drawing.next_entry_ms).toEqual({ min: 1250, max: 1250 });
    expect(run.stdout).toContain('(1 sessions, 2 entries)');
  });

  it('stops on a missing netlog or timeline, names the file and writes nothing', () => {
    session('s-no-netlog', lines(rows), null);
    session('s-no-timeline', null, lines(entries));
    for (const [name, file] of [
      ['s-no-netlog', 'netlog.jsonl'],
      ['s-no-timeline', 'timeline.jsonl'],
    ]) {
      const run = build(`${name}.json`, name);
      expect(run.status, name).not.toBe(0);
      expect(run.stderr).toContain(`${name}/${file}: cannot be read.`);
      expect(run.stderr.includes(root)).toBe(false);
      expect(existsSync(join(root, `${name}.json`))).toBe(false);
    }
  });

  it('stops on a line that is not valid JSON, names it by number and quotes nothing', () => {
    const bad = `{"at":"2026-01-01T00:00:11.000Z","path":"/#room=${ROOM},${KEY}"`;
    session('s-bad-line', lines(rows), `${lines(entries)}${bad}\n`);
    const run = build('bad.json', 's-bad-line');
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('s-bad-line/netlog.jsonl line 3: not valid JSON.');
    expect(run.stderr.includes(ROOM)).toBe(false);
    expect(existsSync(join(root, 'bad.json'))).toBe(false);
  });

  it('stops on an entry without a valid time and names the session', () => {
    session('s-no-time', lines(rows), lines([{ event: 'request' }]));
    const run = build('no-time.json', 's-no-time');
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('s-no-time: netlog line 1: no valid time.');
    expect(existsSync(join(root, 'no-time.json'))).toBe(false);
  });

  it('needs a root, an output and at least one session', () => {
    const run = build('none.json');
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(
      'Usage: netlog-steps.mjs <sessions-root> <output.json> <session...>',
    );
  });
});

describe('netlog-steps.mjs drawing kinds', () => {
  it('names touchPath among the drawing steps only when a session has one', () => {
    const path = {
      do: 'touchPath',
      points: [
        [0, 0],
        [1, 1],
      ],
    };
    const traced = [rows[0], { ...rows[1], step: path }, rows[2]];
    session('s-drag', lines(rows), lines(entries));
    session('s-path', lines(traced), lines(entries));
    const run = build('path.json', 's-drag', 's-path');
    expect(run.status, run.stderr).toBe(0);
    const index = JSON.parse(readFileSync(join(root, 'path.json'), 'utf8'));
    expect(index.drawing_steps).toEqual(['drag', 'path', 'touchDrag', 'touchPath']);
    expect(index.sessions.map((s) => s.drawing.steps)).toEqual([
      { drag: 1, path: 0, touchDrag: 0 },
      { drag: 0, path: 0, touchDrag: 0, touchPath: 1 },
    ]);
  });
});
