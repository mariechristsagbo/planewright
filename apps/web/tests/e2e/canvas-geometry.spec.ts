import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { canvas, canvasBox, expectCamera, readout } from './support.ts';

// The editor's size and its screen points come from the scene canvas, which sits inside the canvas
// host's 1 px border (ENG-08 review finding M1): each backing store is the canvas's CSS size times
// the device pixel ratio (ADR 0006), and the canvas's own top-left pixel is the screen origin.

interface Layer {
  readonly css: { readonly width: number; readonly height: number };
  readonly backing: { readonly width: number; readonly height: number };
}

/** The device pixel ratio, and each canvas's CSS size and backing store (its reflected size attributes). */
async function layersOf(page: Page): Promise<{ ratio: unknown; layers: Layer[] }> {
  const layers = await Promise.all(
    (await canvas(page).locator('canvas').all()).map(async (layer): Promise<Layer> => {
      const box = await layer.boundingBox();
      if (box === null) throw new Error('A canvas is not laid out.');
      const [width, height] = await Promise.all([
        layer.getAttribute('width'),
        layer.getAttribute('height'),
      ]);
      return {
        css: { width: box.width, height: box.height },
        backing: { width: Number(width), height: Number(height) },
      };
    }),
  );
  return { ratio: await page.evaluate('devicePixelRatio'), layers };
}

/** The host's border box and the scene canvas's box: the canvas must sit strictly inside. */
async function expectInsideBorder(page: Page): Promise<void> {
  const host = await canvas(page).boundingBox();
  const scene = await canvasBox(page);
  if (host === null) throw new Error('The canvas host is not laid out.');
  expect(scene.x).toBeGreaterThan(host.x);
  expect(scene.width).toBeLessThan(host.width);
}

const CASES = [
  { name: 'pixel ratio 1', deviceScaleFactor: 1, height: 720, fractional: false },
  { name: 'pixel ratio 2', deviceScaleFactor: 2, height: 720, fractional: false },
  {
    name: 'pixel ratio 2 and a fractional canvas height',
    deviceScaleFactor: 2,
    height: 901,
    fractional: true,
  },
] as const;

/**
 * Makes the canvas host 60 % of the viewport's height as soon as it is in the page, as P0's page
 * did: 540.6 px of 901, so that the scene canvas's height is fractional, which a host as tall as
 * the viewport never is (ADR 0012's row for this spec). Set before the editor first sizes, it
 * leaves the camera at the scene's origin, which a later resize would move to keep the centre.
 */
const FRACTIONAL_HOST = `new MutationObserver((_, observer) => {
  const host = document.getElementById('drawing-canvas');
  if (host === null) return;
  host.style.height = '60vh';
  observer.disconnect();
}).observe(document, { childList: true, subtree: true });`;

for (const { name, deviceScaleFactor, height, fractional } of CASES) {
  test.describe(`at ${name}`, () => {
    test.use({ deviceScaleFactor, viewport: { width: 1280, height } });

    test.beforeEach(async ({ page }) => {
      if (fractional) await page.addInitScript(FRACTIONAL_HOST);
      await page.goto('/');
      await expect(readout(page)).toHaveText('View: x 0, y 0, zoom 100%');
      await expectInsideBorder(page);
    });

    test('each backing store is the scene canvas’s CSS size times the pixel ratio', async ({
      page,
    }) => {
      const box = await canvasBox(page);
      expect(Number.isInteger(box.height)).toBe(!fractional);
      const backing = {
        width: Math.round(box.width * deviceScaleFactor),
        height: Math.round(box.height * deviceScaleFactor),
      };
      const css = { width: box.width, height: box.height };
      await expect
        .poll(() => layersOf(page))
        .toEqual({
          ratio: deviceScaleFactor,
          layers: [
            { css, backing },
            { css, backing },
          ],
        });
    });

    test('REQ-V04 Ctrl+wheel about the scene canvas’s top-left pixel keeps the scene origin there', async ({
      page,
    }) => {
      const box = await canvasBox(page);
      await page.mouse.move(box.x, box.y);
      await page.keyboard.down('Control');
      for (let step = 0; step < 3; step += 1) await page.mouse.wheel(0, -100);
      await page.keyboard.up('Control');
      // Chromium delivers each of these steps as a deltaY of −100 divided by the pixel ratio.
      await expectCamera(page, { x: 0, y: 0, zoom: Math.exp(0.3 / deviceScaleFactor) });
    });
  });
}
