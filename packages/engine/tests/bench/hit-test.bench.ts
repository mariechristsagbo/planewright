import { expect, test } from 'vitest';

import { createRandom, randomBetween, randomInt } from '../../src/math/random.ts';
import type { Point } from '../../src/model/elements.ts';
import { hitsElement } from '../../src/selection/element-hit.ts';
import { hitTest } from '../../src/selection/hit-test.ts';
import { HIT_TOLERANCE } from '../../src/selection/pointer.ts';
import {
  BENCH_SCENE,
  benchElements,
  benchStore,
  recordBench,
  runOptions,
} from '../support/perf-bench.ts';

// Budget B5 (docs/architecture/engine/quality.md#performance-budgets, REQ-F01): a hit test at a
// point among 10,000 elements, at most 0.2 ms. The points are seeded, half of them at an element's
// centre and half anywhere in the scene, and each one's result is first checked against every
// element tested in drawing order, without the spatial index.

const POINTS = 64;

test('B5 REQ-F01 a hit test at a point among 10,000 elements', async ({ bench, task }) => {
  const elements = benchElements();
  const store = benchStore(elements);
  const view = { scene: store, selection: [], camera: { x: 0, y: 0, zoom: 1 } };
  const random = createRandom(BENCH_SCENE.seed + 1);
  const { area } = BENCH_SCENE;
  const points: Point[] = Array.from({ length: POINTS }, (_, at) => {
    const element = elements[randomInt(random, 0, elements.length - 1)];
    if (at % 2 === 0 && element !== undefined) return { x: element.x + 1, y: element.y + 1 };
    return {
      x: randomBetween(random, area.x, area.x + area.width),
      y: randomBetween(random, area.y, area.y + area.height),
    };
  });
  const topmost = [...elements].reverse();
  const expected = points.map((point) => {
    const hit = topmost.find((element) => hitsElement(element, point, HIT_TOLERANCE.mouse));
    return hit === undefined ? { type: 'none' } : { type: 'element', id: hit.id };
  });
  expect(points.map((point) => hitTest(view, point, 'mouse'))).toEqual(expected);
  expect(expected.filter(({ type }) => type === 'element').length).toBeGreaterThan(POINTS / 4);

  let next = 0;
  const result = await bench('B5 hit test at a point, 10,000 elements', () => {
    hitTest(view, points[next++ % POINTS] ?? { x: 0, y: 0 }, 'mouse');
  }).run(runOptions(2_000));
  recordBench(
    task.meta,
    {
      budget: 'B5',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: `${String(POINTS)} seeded points gave the topmost element that a scan of every element gives`,
    },
    result,
  );
});
