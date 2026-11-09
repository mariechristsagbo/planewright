import { expect, test } from 'vitest';

import { enclosedBy } from '../../src/selection/marquee.ts';
import type { SceneReader } from '../../src/scene/store.ts';
import {
  BENCH_SCENE,
  benchElements,
  benchStore,
  marqueeSweep,
  recordBench,
  runOptions,
} from '../support/perf-bench.ts';

// Budget B6 (docs/architecture/engine/quality.md#performance-budgets, REQ-F01): a marquee query
// among 10,000 elements, at most 2 ms. The marquee is dragged from the scene's top-left corner to
// its far corner in 32 steps, so the samples cover small boxes and the whole scene alike; each
// box's result is first checked against the same query given every element as a candidate.

const STEPS = 32;

test('B6 REQ-F01 a marquee query among 10,000 elements', async ({ bench, task }) => {
  const elements = benchElements();
  const store = benchStore(elements);
  const ids = elements.map(({ id }) => id);
  const unindexed: SceneReader = { ...store, queryBox: () => ids };
  const boxes = marqueeSweep(BENCH_SCENE.area, STEPS);
  expect(boxes.map((box) => enclosedBy(store, box))).toEqual(
    boxes.map((box) => enclosedBy(unindexed, box)),
  );
  expect(enclosedBy(store, boxes[STEPS - 1] ?? BENCH_SCENE.area)).toHaveLength(BENCH_SCENE.count);

  let next = 0;
  const result = await bench('B6 marquee query, 10,000 elements', () => {
    enclosedBy(store, boxes[next++ % STEPS] ?? BENCH_SCENE.area);
  }).run(runOptions(640));
  recordBench(
    task.meta,
    {
      budget: 'B6',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: `${String(STEPS)} marquees up to the whole scene enclosed what an unindexed query encloses, the last one all 10,000`,
    },
    result,
  );
});
