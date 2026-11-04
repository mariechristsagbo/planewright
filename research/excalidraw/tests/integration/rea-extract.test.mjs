// Runs rea-extract.mjs on synthetic REA screenshot results in a temporary directory. No REA
// call is made and no website is contacted.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { encodePng } from '../../lib/png.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rea-extract.mjs');
const dir = mkdtempSync(join(tmpdir(), 'pw-rea-extract-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const png = encodePng({ width: 2, height: 2, bpp: 3, rows: [Buffer.alloc(6), Buffer.alloc(6)] });
const result = JSON.stringify({
  operation: 'capture_web_screenshot',
  evidence_id: 'ev-test',
  normalized_result: {
    captured_at: '2026-01-01T00:00:00Z',
    viewport: { width: 2, height: 2 },
    artifact: {
      data_base64: png.toString('base64'),
      sha256: createHash('sha256').update(png).digest('hex'),
      bytes: png.length,
    },
  },
});
const extract = (...args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', cwd: dir });

describe('rea-extract.mjs screenshot output', () => {
  it('refuses an input whose name does not end in .json and leaves it intact', () => {
    const input = join(dir, 'result.txt');
    writeFileSync(input, result);
    const run = extract(input);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/must end in \.json/u);
    expect(readFileSync(input, 'utf8')).toBe(result);
  });

  it('writes the PNG beside a .json input and accepts a rerun with the same bytes', () => {
    const input = join(dir, 'shot.json');
    writeFileSync(input, result);
    expect(extract(input).status).toBe(0);
    expect(readFileSync(join(dir, 'shot.png')).equals(png)).toBe(true);
    const rerun = extract(input);
    expect(rerun.status).toBe(0);
    expect(JSON.parse(rerun.stdout)).toMatchObject({ png: { width: 2, height: 2 } });
    expect(readFileSync(input, 'utf8')).toBe(result);
  });

  it('refuses to replace an existing PNG with different content', () => {
    const input = join(dir, 'other.json');
    writeFileSync(input, result);
    writeFileSync(join(dir, 'other.png'), 'an earlier file');
    expect(extract(input).status).not.toBe(0);
    expect(readFileSync(join(dir, 'other.png'), 'utf8')).toBe('an earlier file');
    expect(existsSync(input)).toBe(true);
  });
});

describe('rea-extract.mjs summary output', () => {
  it('refuses to write the summary over its own input', () => {
    const input = join(dir, 'self.json');
    writeFileSync(input, result);
    const run = extract(input, input);
    expect(run.status).not.toBe(0);
    expect(run.stderr).toMatch(/already exists/u);
    expect(readFileSync(input, 'utf8')).toBe(result);
  });

  it('writes a new summary file and never replaces an existing one', () => {
    const input = join(dir, 'summary-source.json');
    const output = join(dir, 'summary.json');
    writeFileSync(input, result);
    expect(extract(input, output).status).toBe(0);
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({ kind: 'rea-screenshot' });
    writeFileSync(output, 'an earlier summary');
    const rerun = extract(input, output);
    expect(rerun.status).not.toBe(0);
    expect(readFileSync(output, 'utf8')).toBe('an earlier summary');
  });
});

// Synthetic, low-entropy room value built at run time (see sanitise.test.mjs).
const ROOM = 'a1B2'.repeat(5);
const KEY = `${'k_L-'.repeat(5)}m1`;
const LINK = `https://excalidraw.com/#room=${ROOM},${KEY}`;

describe('rea-extract.mjs page inspection', () => {
  it('redacts room values in accessible names, descriptions and limitations', () => {
    const input = join(dir, 'inspect.json');
    const inspection = {
      operation: 'inspect_web_page',
      evidence_id: 'ev-inspect',
      normalized_result: {
        target: { url: LINK },
        accessibility: {
          total_nodes: 2,
          nodes: [
            { role: 'textbox', name: LINK, description: `Share ${LINK}` },
            { role: 'button', name: 'Copy link', states: [{ name: 'disabled', value: false }] },
          ],
        },
        limitations: [`target ${LINK} was attach-limited`, { detail: LINK }],
      },
    };
    writeFileSync(input, JSON.stringify(inspection));
    const run = extract(input);
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain(ROOM);
    expect(run.stdout).not.toContain(KEY);
    const summary = JSON.parse(run.stdout);
    expect(summary.url).toBe('https://excalidraw.com/');
    expect(summary.controls[0].name).toBe('https://excalidraw.com/#room=<redacted>');
    expect(summary.controls[1]).toEqual({ role: 'button', name: 'Copy link', disabled: false });
    expect(summary.limitations[1]).toEqual({ detail: 'https://excalidraw.com/#room=<redacted>' });
  });
});
