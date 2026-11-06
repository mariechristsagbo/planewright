// Runs build-evidence.mjs on a synthetic session directory in a temporary folder. No browser is
// started and no website is contacted.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'build-evidence.mjs');
const root = mkdtempSync(join(tmpdir(), 'pw-build-evidence-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
const ROOM = 'a1B2'.repeat(5);
const KEY = `${'k_L-'.repeat(5)}m1`;

describe('build-evidence.mjs failure messages', () => {
  it('redacts room values in timeline errors written before the driver redacted them', () => {
    const session = join(root, 's9');
    mkdirSync(session);
    const rows = [
      { started: '2026-01-01T00:00:00.000Z', step: { do: 'wait' }, result: { ms: 1 } },
      {
        started: '2026-01-01T00:00:01.000Z',
        step: { do: 'role' },
        error: `waiting for https://excalidraw.com/#room=${ROOM},${KEY} timed out`,
      },
    ];
    writeFileSync(join(session, 'timeline.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n'));
    const output = join(root, 'sessions.json');
    const run = spawnSync(process.execPath, [SCRIPT, root, output, 's9'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    const text = readFileSync(output, 'utf8');
    expect(text).not.toContain(ROOM);
    expect(text).not.toContain(KEY);
    const [failure] = JSON.parse(text).sessions[0].steps.failures;
    expect(failure).toEqual({
      step: 'role',
      error: 'waiting for https://excalidraw.com/#room=<redacted> timed out',
      fatal: false,
      count: 1,
    });
  });
});
