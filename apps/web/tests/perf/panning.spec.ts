import { expect, test } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';

import { canvasBox } from '../e2e/support.ts';
import {
  PROBES,
  areaFor,
  clearMeasures,
  measures,
  openEmpty,
  openMeasured,
  storeScene,
  taskTime,
  writeMeasurement,
} from './support.ts';

// Budget B2 (docs/architecture/engine/quality.md#performance-budgets, REQ-F01) and the element
// list's cost (I1, I2; the ENG-14 review's s4) on a seeded drawing of 5,000 elements spread over
// ten times the view: the view is panned around a loop of wheel steps, each step's scene render
// measured, and the main thread's busy time from each step to the animation frame after its
// render read from Chromium. The element list renders its 101 options again on every pan; for I2 those are texts
// of 100,000 characters each, drawn far from the panned area.

const SCENE = { seed: 22, count: 5_000 };
const WARM_UP = 10;
/** Wheel steps of 20 px: right, down, left and up, so that the view stays inside the area. */
const LOOP = [
  ...Array.from({ length: 40 }, () => [20, 0] as const),
  ...Array.from({ length: 15 }, () => [0, 20] as const),
  ...Array.from({ length: 40 }, () => [-20, 0] as const),
  ...Array.from({ length: 15 }, () => [0, -20] as const),
];

test.beforeEach(() => {
  test.setTimeout(300_000);
});

/** Pans around the loop; gives each step's main-thread time after the warm-up steps. */
async function panAround(page: Page, session: CDPSession): Promise<number[]> {
  const box = await canvasBox(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await session.send('Performance.enable');
  const busy: number[] = [];
  for (const [index, [dx, dy]] of LOOP.entries()) {
    if (index === WARM_UP) await clearMeasures(page);
    const done = await page.evaluate<number>('window.perfProbes.scenes');
    const before = await taskTime(session);
    await page.mouse.wheel(dx, dy);
    await page.evaluate(`window.perfProbes.afterScene(${String(done)})`);
    if (index >= WARM_UP) busy.push((await taskTime(session)) - before);
  }
  return busy;
}

async function openSpread(page: Page, longTexts: boolean) {
  await page.addInitScript(PROBES);
  const view = await openEmpty(page);
  const texts = longTexts
    ? { longTexts: { count: 101, length: 100_000, at: { x: -1e6, y: -1e6 } } }
    : {};
  await storeScene(page, { ...SCENE, area: areaFor(view, 0.1), ...texts });
  return openMeasured(page, await visibleAtStart(page));
}

/** How many elements the first frame drew: about a tenth, read from the page once it drew. */
async function visibleAtStart(page: Page): Promise<number> {
  await page.goto('/?measure');
  await page.waitForFunction(
    "performance.getEntriesByName('planewright:render-scene').some((entry) => entry.detail.elements > 0)",
  );
  const [first] = (await measures(page)).filter(({ elements }) => elements > 0);
  return first?.elements ?? 0;
}

test('B2 I1 REQ-F01 the scene layer redrawn while panning 5,000 elements, a tenth in view', async ({
  page,
}) => {
  const session = await openSpread(page, false);
  const busy = await panAround(page, session);
  const scene = (await measures(page)).filter(({ name }) => name === 'scene');
  const shares = scene.map(({ elements }) => elements / SCENE.count);
  expect(scene.length).toBeGreaterThanOrEqual(LOOP.length - WARM_UP);
  expect(Math.min(...shares)).toBeGreaterThan(0.05);
  expect(Math.max(...shares)).toBeLessThan(0.2);
  writeMeasurement(page, {
    id: 'B2',
    samples: scene.map(({ duration }) => duration),
    details: {
      ...SCENE,
      inView: {
        min: Math.min(...scene.map((s) => s.elements)),
        max: Math.max(...scene.map((s) => s.elements)),
      },
      warmUp: WARM_UP,
      by: `${String(LOOP.length)} wheel steps of 20 px around a loop`,
    },
  });
  writeMeasurement(page, {
    id: 'I1',
    samples: busy,
    details: {
      ...SCENE,
      warmUp: WARM_UP,
      by: 'Chromium TaskDuration from each wheel step to the animation frame after its render',
    },
  });
});

test('I2 the same pans with the 101 listed options texts of 100,000 characters', async ({
  page,
}) => {
  const session = await openSpread(page, true);
  await expect(page.getByRole('option')).toHaveCount(101);
  const busy = await panAround(page, session);
  writeMeasurement(page, {
    id: 'I2',
    samples: busy,
    details: { ...SCENE, longTexts: 101, textLength: 100_000, warmUp: WARM_UP, by: 'as I1' },
  });
});
