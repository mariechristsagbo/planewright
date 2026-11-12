import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { FIXTURE_DOCUMENT_ID, openFixture } from './fixture-page.ts';
import { fixtureRecords, referenceCalls } from './scene-fixture.ts';
import { storedRecords } from './storage.ts';
import type { StoredRecords } from './storage.ts';
import { canvasBox } from './support.ts';

// The scene layer's pixels (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-34-decided):
// a stored drawing of overlapping elements of every kind and style, drawn by the page's renderer,
// matches device pixel for device pixel the same drawing made in the same page by the calls that
// drew it before issue #34, with each element in a state of its own. Both canvases are rasterised
// by the same browser, so any difference is a change in what the renderer draws. The comparison
// holds at one and two device pixels per CSS pixel, and again after frames that leave state
// behind: a pan away and back, and a resize, which resets the scene canvas.

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
      // The canvas's centre, which no island covers (ADR 0012's row for this spec).
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
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

/** The stored revision, and each stored text's id and size. */
function storedTexts({ documents, elements }: StoredRecords) {
  const texts = elements.flatMap(({ element }) => {
    const { id, kind, width, height } = element as Readonly<Record<string, unknown>>;
    return kind === 'text' ? [{ id, width, height }] : [];
  });
  return { rev: documents[0]?.['rev'], texts };
}

/** Whether the chrome's 500 face, which no canvas text uses, has loaded. */
const CHROME_500_LOADED = `[...document.fonts].some((face) =>
  face.family.replaceAll(/["']/g, '') === 'Planewright UI' && face.weight === '500' && face.status === 'loaded')`;

// The S1 review's m3 (issue #55, A12): the chrome's faces load after the editor starts, and none
// of them draws canvas text, so their arrival measures no text again and saves nothing; the
// fixture's texts are not sized as the canvas font measures them, so a new measure would change
// them and autosave would write them within its one-second limit.
test('a chrome face that loads after start-up measures no text again and saves nothing', async ({
  page,
}) => {
  const { record, elements } = fixtureRecords(FIXTURE_DOCUMENT_ID);
  // The records as the fixture stores them, plain data as IndexedDB keeps it.
  const stored = storedTexts(
    JSON.parse(JSON.stringify({ documents: [record], elements })) as StoredRecords,
  );
  expect(stored.texts.length).toBeGreaterThan(0);
  await openFixture(page);
  await page.evaluate(`document.fonts.load('500 16px "Planewright UI"')`);
  await page.waitForFunction(CHROME_500_LOADED);
  await page.waitForTimeout(1_500);
  expect(storedTexts(await storedRecords(page))).toEqual(stored);
});

/** Keeps the page's font faces, to find them again after a resize. */
const KEEP_FACES = 'window.keptFaces = [...document.fonts]';

/** Whether every face is one that was kept, and every canvas face is still loaded. */
const SAME_FACES = `(() => {
  const faces = [...document.fonts];
  const canvas = faces.filter((face) => /^"?Planewright (Sans|Hand|Mono)"?$/.test(face.family));
  return faces.every((face) => window.keptFaces.includes(face)) && canvas.length === 3 &&
    canvas.every((face) => face.status === 'loaded');
})()`;

// Media queries that change their result make Chromium recreate the font faces of their style
// sheet, so the layout's live in a style sheet apart from the fonts' (styles/responsive.css):
// a resize across the compact and phone breakpoints and back loads no canvas face again, and so
// measures no text again and saves nothing.
test('a resize across the layout’s breakpoints keeps every font face, measures no text again and saves nothing', async ({
  page,
}) => {
  const { record, elements } = fixtureRecords(FIXTURE_DOCUMENT_ID);
  const stored = storedTexts(
    JSON.parse(JSON.stringify({ documents: [record], elements })) as StoredRecords,
  );
  await openFixture(page);
  await page.waitForFunction(CHROME_500_LOADED);
  await page.evaluate(KEEP_FACES);
  const size = page.viewportSize() ?? { width: 1280, height: 720 };
  for (const next of [{ width: 1000, height: 600 }, { width: 390, height: 600 }, size]) {
    await redrawn(page, () => page.setViewportSize(next));
  }
  expect(await page.evaluate(SAME_FACES)).toBe(true);
  await page.waitForTimeout(1_500);
  expect(storedTexts(await storedRecords(page))).toEqual(stored);
  await expectSamePixels(page, 1);
});
