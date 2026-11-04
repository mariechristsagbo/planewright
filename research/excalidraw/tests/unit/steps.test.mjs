// Exercises step handlers and probes at their file and navigation boundaries with stub pages:
// no browser is started and no website is contacted.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterAll, describe, expect, it } from 'vitest';

import { streamExclusive } from '../../lib/files.mjs';
import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const ROOM = 'a1B2'.repeat(5);
const root = mkdtempSync(join(tmpdir(), 'pw-steps-test-'));
const outDir = join(root, 'session');
for (const sub of ['downloads', 'aria']) mkdirSync(join(outDir, sub), { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

function downloadCtx(content, suggested = 'scene.excalidraw') {
  const item = {
    suggestedFilename: () => suggested,
    createReadStream: async () => Readable.from([Buffer.from(content)]),
  };
  return { outDir, page: { waitForEvent: async () => item }, run: async () => undefined };
}

describe('download', () => {
  const file = join(outDir, 'downloads', 'dl-scene.excalidraw');

  it('saves with exclusive create and reports size and digest', async () => {
    const result = await handlers.download(downloadCtx('first'), { name: 'dl', trigger: [] });
    expect(readFileSync(file, 'utf8')).toBe('first');
    const digest = createHash('sha256').update('first').digest('hex');
    expect(result).toMatchObject({ bytes: 5, sha256: digest });
  });

  it('refuses a reused name and leaves the earlier file intact', async () => {
    const step = { name: 'dl', trigger: [] };
    await expect(handlers.download(downloadCtx('second'), step)).rejects.toThrow(/EEXIST/u);
    expect(readFileSync(file, 'utf8')).toBe('first');
  });

  it('redacts a room value in the suggested name and in the name on disk', async () => {
    const ctx = downloadCtx('x', `room=${ROOM}.json`);
    const result = await handlers.download(ctx, { name: 'dl2', trigger: [] });
    expect(result.suggestedFilename).toBe('room=<redacted>');
    const names = readdirSync(join(outDir, 'downloads'));
    expect(names).toContain('dl2-room_redacted_');
    expect(names.join(' ')).not.toContain(ROOM);
  });

  it('removes a partial file when the stream fails, and only a file it created', async () => {
    const broken = new Readable({
      read() {
        this.destroy(new Error('stream broke'));
      },
    });
    const partial = join(outDir, 'downloads', 'partial');
    await expect(streamExclusive(broken, partial)).rejects.toThrow('stream broke');
    expect(existsSync(partial)).toBe(false);
    await expect(streamExclusive(Readable.from(['x']), file)).rejects.toThrow(/EEXIST/u);
    expect(readFileSync(file, 'utf8')).toBe('first');
  });
});

describe('aria', () => {
  const ctx = {
    outDir,
    page: { locator: () => ({ ariaSnapshot: async () => `- link "#room=${ROOM}"` }) },
  };

  it('writes redacted text once and never overwrites it', async () => {
    await handlers.aria(ctx, { save: 'dialog' });
    const text = readFileSync(join(outDir, 'aria', 'dialog.yml'), 'utf8');
    expect(text).toBe('- link "#room=<redacted>"');
    await expect(handlers.aria(ctx, { save: 'dialog' })).rejects.toThrow(/EEXIST/u);
  });
});

describe('clipboard probe', () => {
  it('shapes and redacts the text in this process', async () => {
    const text = `https://excalidraw.com/#room=${ROOM},abc`;
    const ctx = { page: { evaluate: async () => text } };
    const shape = await probes.clipboard(ctx);
    expect(shape).toEqual({ chars: text.length, json: false, startsWith: expect.any(String) });
    expect(shape.startsWith).not.toContain(ROOM.slice(0, 4));
  });
});
