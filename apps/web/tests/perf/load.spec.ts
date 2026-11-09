import { expect, test } from '@playwright/test';

import {
  areaFor,
  measures,
  openEmpty,
  openMeasured,
  storeScene,
  writeMeasurement,
} from './support.ts';

// Budget B10 (docs/architecture/engine/quality.md#performance-budgets, REQ-F04): a cached load of
// a stored drawing of 1,000 elements to the first editor frame, at most 1.5 s. After one load that
// fills the browser's cache, each load's value is the end of the first render that draws all 1,000
// elements, from the navigation's start, the page's time origin.

const SCENE = { seed: 24, count: 1_000 };
const LOADS = 12;

test('B10 REQ-F04 a cached load of 1,000 elements to the first editor frame', async ({ page }) => {
  test.setTimeout(240_000);
  const view = await openEmpty(page);
  await storeScene(page, { ...SCENE, area: areaFor(view, 1) });
  await openMeasured(page, SCENE.count);
  const seconds: number[] = [];
  for (let load = 0; load < LOADS; load += 1) {
    await openMeasured(page, SCENE.count);
    const first = (await measures(page)).find(
      ({ name, elements }) => name === 'scene' && elements === SCENE.count,
    );
    expect(first).toBeDefined();
    if (first !== undefined) seconds.push((first.start + first.duration) / 1000);
  }
  writeMeasurement(page, {
    id: 'B10',
    samples: seconds,
    details: {
      ...SCENE,
      loads: LOADS,
      warmUp: 1,
      by: 'navigation start to the end of the first render of all 1,000 elements',
    },
  });
});
