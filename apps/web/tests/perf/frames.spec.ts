import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { settled } from '../e2e/motion.ts';
import { canvas, canvasBox } from '../e2e/support.ts';
import {
  PROBES,
  areaFor,
  clearMeasures,
  measures,
  openEmpty,
  rendered,
  openMeasured,
  storeScene,
  waitForRenders,
  writeMeasurement,
} from './support.ts';
import type { Measure } from './support.ts';
import { traced, writeControl } from './trace.ts';

// Budgets B1, B3 and B4 (docs/architecture/engine/quality.md#performance-budgets, REQ-F01 and
// REQ-F02) on a seeded drawing of 5,000 elements, all of them in view: the scene layer redrawn by
// small pans, the overlay layer redrawn by a marquee, and the frame that shows each pointer move
// of the marquee and of a Hand tool drag. Warm-up frames are dropped before the samples. After B1,
// its pans run again on a page of their own while Chromium traces the browser, so that B1's own
// frames stay untraced, then once more untraced on another page, as the traced pass's paired
// control (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided).

const SCENE = { seed: 21, count: 5_000 };
const WARM_UP = 20;

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(PROBES);
  const view = await openEmpty(page);
  await storeScene(page, { ...SCENE, area: areaFor(view, 1) });
  await openMeasured(page, SCENE.count);
  await page.mouse.move(...(await canvasPoint(page, 0.5, 0.5)));
});

/** A point of the scene canvas, as page coordinates, at a share of its width and height. */
async function canvasPoint(page: Page, x: number, y: number): Promise<[number, number]> {
  const box = await canvasBox(page);
  return [box.x + box.width * x, box.y + box.height * y];
}

const durations = (found: readonly Measure[], layer: string): number[] =>
  found.filter(({ name }) => name === layer).map(({ duration }) => duration);

/**
 * B1's pans: wheel pans of 2 px back and forth, each waiting for its scene render, with the
 * measures cleared after the warm-up; gives the scene renders measured since, checked to be at
 * least 100, each of every element.
 */
async function panBackAndForth(page: Page): Promise<Measure[]> {
  for (let step = 0; step < WARM_UP + 100; step += 1) {
    if (step === WARM_UP) await clearMeasures(page);
    const done = await rendered(page, 'scene');
    await page.mouse.wheel(0, step % 2 === 0 ? 2 : -2);
    await waitForRenders(page, 'scene', done);
  }
  const found = (await measures(page)).filter(({ name }) => name === 'scene');
  expect(found.length).toBeGreaterThanOrEqual(100);
  expect(found.every(({ elements }) => elements === SCENE.count)).toBe(true);
  return found;
}

test('B1 REQ-F01 the scene layer redrawn with 5,000 elements in view', async ({ page }) => {
  const found = await panBackAndForth(page);
  writeMeasurement(page, {
    id: 'B1',
    samples: durations(found, 'scene'),
    details: {
      ...SCENE,
      inView: SCENE.count,
      warmUp: WARM_UP,
      by: 'wheel pans of 2 px back and forth',
    },
  });
});

test("B1's pans again, after B1, while Chromium traces the browser", async ({ page, browser }) => {
  const details = { ...SCENE, inView: SCENE.count, by: "B1's pans, traced after B1's own" };
  const frames = await traced(browser, { id: 'B1', warmUp: WARM_UP, details }, () =>
    panBackAndForth(page),
  );
  expect(frames.length).toBeGreaterThanOrEqual(100);
});

test("B1's pans again, untraced, as the traced pass's paired control", async ({
  page,
  browser,
}) => {
  const details = {
    ...SCENE,
    inView: SCENE.count,
    by: "B1's pans, untraced after the traced pass",
  };
  const frames = await panBackAndForth(page);
  writeControl(browser, { id: 'B1', warmUp: WARM_UP, details }, frames);
});

/**
 * Drags from one canvas point to another in steps, waiting for a render of `layer` after each;
 * the pointer moves are counted from the press on, since a hover before it shows nothing.
 */
async function drag(page: Page, from: [number, number], to: [number, number], layer: string) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.evaluate('window.perfProbes.moves.length = 0');
  for (let step = 1; step <= 60; step += 1) {
    const done = await rendered(page, layer);
    const at = step / 60;
    await page.mouse.move(from[0] + (to[0] - from[0]) * at, from[1] + (to[1] - from[1]) * at);
    await waitForRenders(page, layer, done);
  }
  await page.mouse.up();
}

/**
 * For each pointer move, how many animation frames started after it until the frame of the first
 * render after it began: 1 when that render ran in the next animation frame (REQ-F02).
 */
async function framesToShow(page: Page): Promise<number[]> {
  const { frames, moves } = await page.evaluate<{ frames: number[]; moves: number[] }>(
    '({ frames: window.perfProbes.frames, moves: window.perfProbes.moves })',
  );
  const renders = (await measures(page)).map(({ start }) => start);
  return moves.flatMap((move) => {
    const shown = renders.find((start) => start > move);
    if (shown === undefined) return [];
    return [frames.filter((frame) => frame > move && frame <= shown).length];
  });
}

test('B3 B4 REQ-F02 the overlay redrawn by a marquee, and each pointer move shown in the next frame', async ({
  page,
}) => {
  await page.evaluate('(function loop() { requestAnimationFrame(loop); })()');
  await page.evaluate('window.perfProbes.moves.length = 0; window.perfProbes.frames.length = 0');
  await clearMeasures(page);
  await drag(
    page,
    await canvasPoint(page, 0.005, 0.01),
    await canvasPoint(page, 0.6, 0.6),
    'overlay',
  );
  const marquee = await measures(page);
  const overlay = durations(marquee, 'overlay');
  expect(overlay.length).toBeGreaterThanOrEqual(60);
  const marqueeFrames = await framesToShow(page);
  // The marquee's selection mounts the selection panel, whose entrance ends before the Hand drag.
  await expect(page.locator('[data-island="selection"]')).toBeVisible();
  await settled(page);

  await canvas(page).focus();
  await page.keyboard.press('h');
  await clearMeasures(page);
  await drag(page, await canvasPoint(page, 0.3, 0.3), await canvasPoint(page, 0.5, 0.45), 'scene');
  const handFrames = await framesToShow(page);
  const panned = (await measures(page)).filter(({ name }) => name === 'scene');
  expect(panned.length).toBeGreaterThanOrEqual(60);

  writeMeasurement(page, {
    id: 'B3',
    samples: overlay.slice(WARM_UP / 4),
    details: {
      ...SCENE,
      inView: SCENE.count,
      warmUp: WARM_UP / 4,
      by: 'a marquee dragged in 60 steps',
    },
  });
  writeMeasurement(page, {
    id: 'B4',
    samples: [...marqueeFrames, ...handFrames],
    details: {
      ...SCENE,
      moves: { marquee: marqueeFrames.length, hand: handFrames.length },
      by: 'each pointer move of a marquee and of a Hand tool drag, 60 steps each',
    },
  });
  expect(marqueeFrames.length + handFrames.length).toBeGreaterThanOrEqual(100);
});
