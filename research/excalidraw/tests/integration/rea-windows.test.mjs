// Runs rea-windows.mjs on synthetic REA records in a temporary directory: a window it summarises,
// and failed REA CLI envelopes that must stop the build. No REA call is made and no website is
// contacted.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rea-windows.mjs');
const root = mkdtempSync(join(tmpdir(), 'pw-rea-windows-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const window = {
  operation: 'inspect_web_page',
  evidence_id: 'ev-window',
  parameters: { allowed_origins: ['https://example.test'] },
  normalized_result: {
    capture_window: {
      started_at: '2026-01-01T00:00:10.000Z',
      ended_at: '2026-01-01T00:00:20.000Z',
      observation_ms: 10000,
    },
    network: { requests: [], websocket_connections: [] },
    console: { events: [] },
  },
};
const targets = { operation: 'list_browser_targets', evidence_id: 'ev-targets' };
const envelope = (data) => ({ ok: true, data, meta: { command: 'x' } });

// Writes a session directory with a one-step timeline and the given REA files.
const session = (name, files) => {
  mkdirSync(join(root, name, 'rea'), { recursive: true });
  const row = { started: '2026-01-01T00:00:12.000Z', step: { do: 'drag' }, result: {} };
  writeFileSync(join(root, name, 'timeline.jsonl'), `${JSON.stringify(row)}\n`);
  for (const [file, content] of Object.entries(files))
    writeFileSync(join(root, name, 'rea', file), JSON.stringify(content));
};
const build = (output, ...sessions) =>
  spawnSync(process.execPath, [SCRIPT, root, join(root, output), ...sessions], {
    encoding: 'utf8',
    cwd: root,
  });

describe('rea-windows.mjs', () => {
  it('summarises a window from a CLI envelope and leaves out other operations', () => {
    session('s-good', { 'r01-targets.json': envelope(targets), 'r02.json': envelope(window) });
    const run = build('good.json', 's-good');
    expect(run.status, run.stderr).toBe(0);
    const { windows } = JSON.parse(readFileSync(join(root, 'good.json'), 'utf8'));
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ session: 's-good', file: 'r02.json', network_requests: 0 });
    expect(windows[0].driver.steps).toBe(1);
  });

  it('stops on a failed CLI envelope, names the file and writes nothing', () => {
    // Synthetic, low-entropy room id built at run time (see sanitise.test.mjs).
    const room = 'a1B2'.repeat(5);
    const cases = [
      ['failed', { ok: false, error: { code: 'target_not_found' } }, 'does not report ok: true'],
      ['failed-with-record', { ok: false, data: window }, 'does not report ok: true'],
      ['room-code', { ok: false, error: { code: room } }, 'does not report ok: true'],
      ['ok-without-record', { ok: true, data: {} }, 'reports ok: true but holds no'],
      ['ok-other-data', envelope({ targets: [] }), 'reports ok: true but holds no'],
    ];
    for (const [name, content, message] of cases) {
      session(`s-${name}`, { 'r01-targets.json': envelope(targets), [`${name}.json`]: content });
      const output = `${name}.windows.json`;
      const run = build(output, 's-good', `s-${name}`);
      expect(run.status, name).not.toBe(0);
      expect(run.stderr, name).toContain(
        `s-${name}/rea/${name}.json: The REA CLI output ${message}`,
      );
      expect(run.stderr, name).not.toContain(room);
      expect(existsSync(join(root, output)), name).toBe(false);
    }
  });
});

describe('rea-windows.mjs on files that are not valid JSON', () => {
  // Synthetic, low-entropy room value built at run time (see sanitise.test.mjs). The checks on it
  // compare booleans, so that a failure never prints the output that holds it.
  const room = 'a1B2'.repeat(5);
  const link = `https://example.test/#room=${room},${'k_L-'.repeat(5)}m1`;
  const holds = (text, value) => text.includes(value);

  it('stops on a REA file that is not valid JSON, names it and never prints its content', () => {
    const cases = [
      ['truncated', `{"ok":true,"data":{"note":"${link}"`],
      ['stray-token', `{"ok":true,"data":{"note":"${link}" x}}`],
    ];
    for (const [name, text] of cases) {
      session(`s-${name}`, { 'r01-targets.json': envelope(targets) });
      writeFileSync(join(root, `s-${name}`, 'rea', `${name}.json`), text);
      const output = `${name}.windows.json`;
      const run = build(output, 's-good', `s-${name}`);
      expect(run.status, name).not.toBe(0);
      expect(holds(run.stderr, room), `${name}: room value in stderr`).toBe(false);
      expect(holds(run.stderr, '#room='), `${name}: link in stderr`).toBe(false);
      expect(run.stderr, name).toContain(`s-${name}/rea/${name}.json: not valid JSON.`);
      expect(run.stderr, name).not.toMatch(/SyntaxError/u);
      expect(existsSync(join(root, output)), name).toBe(false);
    }
  });

  it('stops on a timeline line that is not valid JSON and names it by its number', () => {
    session('s-timeline', { 'r01.json': envelope(window) });
    const row = { started: '2026-01-01T00:00:12.000Z', step: { do: 'goto', url: link } };
    const text = `${JSON.stringify(row)}\n\n${JSON.stringify(row).slice(0, -2)}\n`;
    writeFileSync(join(root, 's-timeline', 'timeline.jsonl'), text);
    const run = build('timeline.windows.json', 's-timeline');
    expect(run.status).not.toBe(0);
    expect(holds(run.stderr, room), 'room value in stderr').toBe(false);
    expect(holds(run.stderr, '#room='), 'link in stderr').toBe(false);
    expect(run.stderr).toContain('s-timeline/timeline.jsonl line 3: not valid JSON.');
    expect(existsSync(join(root, 'timeline.windows.json'))).toBe(false);
  });
});
