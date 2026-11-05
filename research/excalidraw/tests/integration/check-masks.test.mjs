// Runs check-masks.mjs on synthetic PNGs and a synthetic timeline in a temporary directory. No
// browser is started and no website is contacted.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { encodePng, paintBoxes } from '../../lib/png.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'pw-masks-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('check-masks.mjs', () => {
  it('fails a masked capture that recorded no mask box', () => {
    const session = join(dir, 'masks');
    mkdirSync(join(session, 'screenshots'), { recursive: true });
    const rows = Array.from({ length: 20 }, () => Buffer.alloc(60, 9));
    const png = { width: 20, height: 20, bpp: 3, rows };
    const box = { x: 2, y: 2, width: 10, height: 10 };
    writeFileSync(join(session, 'screenshots', 'none.png'), encodePng(png));
    writeFileSync(join(session, 'screenshots', 'good.png'), encodePng(paintBoxes(png, [box])));
    const row = (file, maskBoxes) =>
      JSON.stringify({
        step: { do: 'screenshot' },
        result: { file, masks: 1, maskBoxes, scale: 1 },
      });
    writeFileSync(
      join(session, 'timeline.jsonl'),
      `${row('none.png', [])}\n${row('good.png', [box])}\n`,
    );
    const run = spawnSync(process.execPath, [join(HERE, 'check-masks.mjs'), session], {
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toMatch(/^FAIL none\.png/mu);
    expect(run.stdout).toMatch(/^PASS good\.png/mu);
  });
});
