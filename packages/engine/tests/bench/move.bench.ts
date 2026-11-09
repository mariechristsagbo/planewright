import { expect, test } from 'vitest';

import {
  BENCH_SCENE,
  benchElements,
  benchStore,
  indexed,
  recordBench,
  runOptions,
  shuttle,
} from '../support/perf-bench.ts';

// Budget B7 (docs/architecture/engine/quality.md#performance-budgets, REQ-F01): a change set that
// moves 1,000 of the 10,000 elements, applied with the order, spatial, group and attachment
// indexes, at most 4 ms. Each sample applies one local change set, moving the elements by one
// unit and then back, so that every set's before values are the document's.

const MOVED = 1_000;

test('B7 REQ-F01 a change set moving 1,000 elements, indexes included', async ({ bench, task }) => {
  const elements = benchElements();
  const store = benchStore(elements);
  const moving = elements.filter((_, at) => at % (BENCH_SCENE.count / MOVED) === 0);
  const [forth, back] = shuttle(moving, 1, 1);
  expect(forth.elements).toHaveLength(MOVED);

  const state = { moved: false };
  const result = await bench('B7 apply a change set moving 1,000 elements', () => {
    store.apply(state.moved ? back : forth, 'local');
    state.moved = !state.moved;
  }).run(runOptions(400));

  const now = moving.map(({ id }) => store.get(id));
  const shift = state.moved ? 1 : 0;
  expect(now.map((element) => element?.x)).toEqual(moving.map(({ x }) => x + shift));
  expect(now.every((element) => element !== undefined && indexed(store, element))).toBe(true);
  recordBench(
    task.meta,
    {
      budget: 'B7',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: `the ${String(MOVED)} moved elements ended where the last set put them, each listed by the spatial index there`,
    },
    result,
  );
});
