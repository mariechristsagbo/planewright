import { expect, test } from 'vitest';

import { enclosedBy } from '../../src/selection/marquee.ts';
import { bruteEnclosed } from '../support/enclosure.ts';
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
// box's result is first checked against a scan of every element by REQ-S06's rule, which keeps
// nothing between queries (tests/support/enclosure.ts).

const STEPS = 32;

test('B6 REQ-F01 a marquee query among 10,000 elements', async ({ bench, task }) => {
  const elements = benchElements();
  const store = benchStore(elements);
  const boxes = marqueeSweep(BENCH_SCENE.area, STEPS);
  expect(boxes.map((box) => enclosedBy(store, box))).toEqual(
    boxes.map((box) => bruteEnclosed(elements, box)),
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
      checked: `${String(STEPS)} marquees up to the whole scene enclosed what a scan of every element encloses, the last one all 10,000`,
    },
    result,
  );
});
