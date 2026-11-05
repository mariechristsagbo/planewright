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
