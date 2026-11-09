import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixtureRecords, referenceCalls } from './scene-fixture.ts';
import { canvasBox } from './support.ts';

// The scene layer's pixels (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-34-decided):
// a stored drawing of overlapping elements of every kind and style, drawn by the page's renderer,
// matches device pixel for device pixel the same drawing made in the same page by the calls that
// drew it before issue #34, with each element in a state of its own. Both canvases are rasterised
// by the same browser, so any difference is a change in what the renderer draws. The comparison
// holds at one and two device pixels per CSS pixel, and again after frames that leave state
// behind: a pan away and back, and a resize, which resets the scene canvas.

const DOCUMENT_ID = 'SceneFixtureDocument00';

async function openFixture(page: Page): Promise<number> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Drawing canvas' })).toBeVisible();
  const { record, elements, count } = fixtureRecords(DOCUMENT_ID);
  await page.evaluate(`(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('planewright');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['documents', 'elements'], 'readwrite');
      transaction.objectStore('documents').put({ ...${JSON.stringify(record)}, updated: Date.now() });
      const store = transaction.objectStore('elements');
      for (const element of ${JSON.stringify(elements)}) store.put(element);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  })()`);
  await page.goto('/?measure');
  await page.waitForFunction(
    `performance.getEntriesByName('planewright:render-scene').some((entry) => entry.detail.elements === ${String(count)})`,
  );
  return count;
}

const renders = (page: Page): Promise<number> =>
  page.evaluate<number>("performance.getEntriesByName('planewright:render-scene').length");

/** Does something that redraws the scene, and waits until the page has drawn it. */
async function redrawn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = await renders(page);
  await act();
  await page.waitForFunction(
    `performance.getEntriesByName('planewright:render-scene').length > ${String(before)}`,
  );
  await page.evaluate('new Promise((resolve) => requestAnimationFrame(() => resolve()))');
}

/**
 * Draws the reference calls on a new canvas the size of the scene canvas, then counts the device
 * pixels where the two differ and those where the reference is not the background.
 */
const COMPARE = `(({ calls, paths }) => {
  const scene = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[0];
  const reference = document.createElement('canvas');
  reference.width = scene.width;
  reference.height = scene.height;
  const context = reference.getContext('2d');
  const built = paths.map((commands) => {
    const path = new Path2D();
    for (const [name, ...args] of commands) path[name](...args);
    return path;
  });
  for (const [name, ...args] of calls) {
    if (name.endsWith('=')) context[name.slice(0, -1)] = args[0];
    else if (name === 'fill' || name === 'stroke') context[name](built[args[0]]);
    else context[name](...args);
  }
  const drawn = scene.getContext('2d').getImageData(0, 0, scene.width, scene.height).data;
  const expected = context.getImageData(0, 0, scene.width, scene.height).data;
  let differing = 0;
  let inked = 0;
  for (let at = 0; at < expected.length; at += 4) {
    if ([0, 1, 2, 3].some((channel) => drawn[at + channel] !== expected[at + channel])) differing += 1;
    if ([0, 1, 2, 3].some((channel) => expected[at + channel] !== expected[channel])) inked += 1;
  }
  return { differing, inked, pixels: expected.length / 4 };
})`;

interface Comparison {
  readonly differing: number;
  readonly inked: number;
  readonly pixels: number;
}

async function compare(page: Page): Promise<Comparison> {
  const [width, height, ratio] = await page.evaluate<[number, number, number]>(
    `(() => { const c = document.querySelectorAll('[aria-label="Drawing canvas"] canvas')[0]; return [c.width, c.height, devicePixelRatio]; })()`,
  );
  const reference = referenceCalls({ width, height }, ratio);
  return page.evaluate<Comparison>(`${COMPARE}(${JSON.stringify(reference)})`);
}

async function expectSamePixels(page: Page, ratio: number): Promise<void> {
  const { differing, inked, pixels } = await compare(page);
  expect(pixels).toBeGreaterThan(400_000 * ratio * ratio);
  // The fixture covers a good part of the canvas: about 70,000 CSS pixels at zoom 1.25.
  expect(inked).toBeGreaterThan(50_000 * ratio * ratio);
  expect(differing).toBe(0);
}

for (const ratio of [1, 2]) {
  test.describe(`at ${String(ratio)} device pixels per CSS pixel`, () => {
    test.use({ deviceScaleFactor: ratio });

    test('the scene layer draws every pixel as each element in a state of its own did', async ({
      page,
    }) => {
      await openFixture(page);
      await expectSamePixels(page, ratio);
    });

    test('and again after frames that leave state behind: a pan back and forth and a resize', async ({
      page,
    }) => {
      await openFixture(page);
      const box = await canvasBox(page);
      await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20);
      await redrawn(page, () => page.mouse.wheel(0, 40));
      await redrawn(page, () => page.mouse.wheel(0, -40));
      await expectSamePixels(page, ratio);
      const size = page.viewportSize() ?? { width: 1280, height: 720 };
      await redrawn(page, () => page.setViewportSize({ width: 1000, height: 600 }));
      await redrawn(page, () => page.setViewportSize(size));
      await expectSamePixels(page, ratio);
    });
  });
}
