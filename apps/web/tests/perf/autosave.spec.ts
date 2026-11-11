import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { perfElements } from '../../../../packages/engine/tests/support/perf-scenes.ts';
import { canvas } from '../e2e/support.ts';
import { saveState } from '../e2e/storage.ts';
import {
  DOCUMENT_ID,
  PROBES,
  areaFor,
  openEmpty,
  openMeasured,
  settle,
  storeScene,
  writeMeasurement,
} from './support.ts';

// Budget B9 (docs/architecture/engine/quality.md#performance-budgets, REQ-F03): no task over 50 ms
// while a 50-element change is saved. The stored drawing of 5,000 elements opens with 50 of them
// selected; each round nudges them from the keyboard and, from the frame after the nudge until the
// stored revision rises and the shell's root says the drawing is saved (data-save-state="saved",
// ADR 0012, decision 16, since the page shows nothing while saving works), collects the long tasks
// that the page's observer reports.

const SCENE = { seed: 23, count: 5_000 };
const ROUNDS = 8;

/** The revision of the stored drawing, which a whole save stores at 1 and each save raises. */
const storedRevision = (page: Page): Promise<number> =>
  page.evaluate<number>(`new Promise((resolve, reject) => {
    const request = indexedDB.open('planewright');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const read = database.transaction('documents').objectStore('documents').get('${DOCUMENT_ID}');
      read.onsuccess = () => { database.close(); resolve(read.result.rev); };
      read.onerror = () => reject(read.error);
    };
  })`);

test('B9 REQ-F03 no long task while a 50-element change is saved', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(PROBES);
  const view = await openEmpty(page);
  const spec = { ...SCENE, area: areaFor(view, 1) };
  const selected = perfElements(spec)
    .slice(0, 50)
    .map(({ id }) => id);
  await storeScene(page, spec, selected);
  await openMeasured(page, SCENE.count);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');
  await canvas(page).focus();

  const windows: { from: number; to: number }[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    await page.keyboard.press(round % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    await settle(page);
    const from = await page.evaluate<number>('performance.now()');
    // The save is known by the stored revision it raises, since the pending state may last too
    // briefly to be seen, and then by the root's save state.
    await expect.poll(() => storedRevision(page), { intervals: [50] }).toBe(round + 2);
    await expect(saveState(page)).toHaveAttribute('data-save-state', 'saved');
    windows.push({ from, to: await page.evaluate<number>('performance.now()') });
  }
  // Long tasks reach the observer some time after they end, so they are read once all are in.
  await settle(page);
  await settle(page);
  const tasks = await page.evaluate<{ start: number; duration: number }[]>(
    'window.perfProbes.longTasks',
  );
  const during = windows.map(({ from, to }) =>
    tasks.filter(({ start, duration }) => start < to && start + duration > from),
  );
  const counts = during.map((found) => found.length);
  const longest = during.flat().map(({ duration }) => duration);
  writeMeasurement(page, {
    id: 'B9',
    samples: counts,
    details: {
      ...SCENE,
      changed: 50,
      rounds: ROUNDS,
      longestTaskMs: Math.max(0, ...longest),
      by: 'long tasks from the frame after each nudge until data-save-state says saved',
    },
  });
});
