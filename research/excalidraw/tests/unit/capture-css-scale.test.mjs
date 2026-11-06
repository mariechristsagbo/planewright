// Exercises the cssScale option of the screenshot step with a stub page and CDP session: no
// browser is started and no website is contacted. REA captures CSS pixels and the driver device
// pixels (R-71), so a matched pair needs a driver capture at CSS scale.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { screenshot } from '../../lib/capture.mjs';
import { encodePng } from '../../lib/png.mjs';

const root = mkdtempSync(join(tmpdir(), 'pw-capture-css-test-'));
const outDir = join(root, 'session');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
afterAll(() => rmSync(root, { recursive: true, force: true }));

const grey = (width, height) =>
  encodePng({
    width,
    height,
    bpp: 3,
    rows: Array.from({ length: height }, () => Buffer.alloc(width * 3, 128)),
  }).toString('base64');

// A 4x2 CSS-pixel view at DPR 3: the stub returns a CSS-size image when the capture is clipped
// at scale 1/3 and a device-size one otherwise, as the browser does.
function stubCtx(view = { href: 'https://excalidraw.com/', cssWidth: 4, cssHeight: 2, dpr: 3 }) {
  const sent = [];
  const page = {
    locator: () => ({ all: async () => [], count: async () => 0 }),
    getByText: () => ({ all: async () => [] }),
    evaluate: async () => view,
  };
  const cdp = {
    send: async (method, params) => {
      sent.push({ method, params });
      const css = params?.clip?.scale === 1 / view.dpr;
      return { data: css ? grey(4, 2) : grey(12, 6) };
    },
  };
  return { ctx: { page, cdp, outDir }, sent };
}

describe('screenshot cssScale', () => {
  it('clips the capture to the CSS viewport at scale 1/DPR and reports scale 1', async () => {
    const { ctx, sent } = stubCtx();
    const result = await screenshot(ctx, { name: 'css-pair', cssScale: true });
    expect(sent).toEqual([
      {
        method: 'Page.captureScreenshot',
        params: { format: 'png', clip: { x: 0, y: 0, width: 4, height: 2, scale: 1 / 3 } },
      },
    ]);
    expect(result).toMatchObject({ file: 'css-pair.png', scale: 1, width: 4, height: 2 });
  });

  it('keeps the device-pixel capture without the option', async () => {
    const { ctx, sent } = stubCtx();
    const result = await screenshot(ctx, { name: 'device-pair' });
    expect(sent).toEqual([{ method: 'Page.captureScreenshot', params: { format: 'png' } }]);
    expect(result).toMatchObject({ scale: 3, width: 12, height: 6 });
  });

  it.each([
    ['a string', 'true'],
    ['a number', 1],
  ])('refuses a cssScale that is %s before capturing', async (_label, value) => {
    const { ctx, sent } = stubCtx();
    await expect(screenshot(ctx, { name: 'bad-css', cssScale: value })).rejects.toThrow(
      /^cssScale must be true or false\.$/u,
    );
    expect(sent).toEqual([]);
  });

  it('refuses when the page reports no usable device pixel ratio', async () => {
    const view = { href: 'https://excalidraw.com/', cssWidth: 4, cssHeight: 2, dpr: 0 };
    const { ctx, sent } = stubCtx(view);
    await expect(screenshot(ctx, { name: 'no-dpr', cssScale: true })).rejects.toThrow(
      /^Screenshot refused: no usable device pixel ratio for a CSS-scale capture\.$/u,
    );
    expect(sent).toEqual([]);
  });
});
