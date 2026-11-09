import { expect, test } from '@playwright/test';

import { perfElements } from '../../../../packages/engine/tests/support/perf-scenes.ts';
import { canvas } from '../e2e/support.ts';
import { saveStatus } from '../e2e/storage.ts';
import {
  PROBES,
  areaFor,
  openEmpty,
  openMeasured,
  settle,
  storeScene,
  taskTime,
  writeMeasurement,
} from './support.ts';

// Budget B9 (docs/architecture/engine/quality.md#performance-budgets, REQ-F03): no task over 50 ms
// while a 50-element change is saved. The stored drawing of 5,000 elements opens with 50 of them
// selected; each round nudges them from the keyboard and, from the frame after the nudge until the
// page says the drawing is saved, collects the long tasks that the page's observer reports.

const SCENE = { seed: 23, count: 5_000 };
const ROUNDS = 8;

test('B9 REQ-F03 no long task while a 50-element change is saved', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(PROBES);
  const view = await openEmpty(page);
  const spec = { ...SCENE, area: areaFor(view, 1) };
  const selected = perfElements(spec)
    .slice(0, 50)
    .map(({ id }) => id);
  await storeScene(page, spec, selected);
  const session = await openMeasured(page, SCENE.count);
  await session.send('Performance.enable');
  await expect(saveStatus(page)).toHaveText('Saved in this browser');
  await canvas(page).focus();

  const counts: number[] = [];
  const longest: number[] = [];
  const busy: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    await page.keyboard.press(round % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(saveStatus(page)).toHaveText('Saving…');
    await settle(page);
    const from = await page.evaluate<number>('performance.now()');
    const before = await taskTime(session);
    await expect(saveStatus(page)).toHaveText('Saved in this browser');
    const tasks = await page.evaluate<{ start: number; duration: number }[]>(
      `window.perfProbes.longTasks.filter((task) => task.start + task.duration > ${String(from)})`,
    );
    counts.push(tasks.length);
    longest.push(Math.max(0, ...tasks.map(({ duration }) => duration)));
    busy.push((await taskTime(session)) - before);
  }
  writeMeasurement(page, {
    id: 'B9',
    samples: counts,
    details: {
      ...SCENE,
      changed: 50,
      rounds: ROUNDS,
      longestTaskMs: Math.max(...longest),
      mainThreadMsPerSave: busy,
      by: 'long tasks from the frame after each nudge until the page says Saved in this browser',
    },
  });
});
