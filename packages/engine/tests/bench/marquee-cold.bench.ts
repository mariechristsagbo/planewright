import { expect, test } from 'vitest';
import type { TestContext } from 'vitest';

import type { Element } from '../../src/model/elements.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import { enclosedBy } from '../../src/selection/marquee.ts';
import { bruteEnclosed } from '../support/enclosure.ts';
import {
  BENCH_SCENE,
  benchElements,
  benchStore,
  recordBench,
  runOptions,
  shuttle,
} from '../support/perf-bench.ts';

// I4 to I6, measurements that are no budget
// (docs/architecture/engine/quality.md#what-issue-43-decided): the first whole-scene marquee query
// after a change or a load of the benchmarks' 10,000 elements, which B6 does not time, since its
// check makes the scene's rows before it times queries of an unchanged scene. The editor runs one
// query, when a marquee is released, and it usually follows a change. Before each sample, an
// untimed change moves the same elements from where they are by one unit and back in turn, or a
// new store loads the scene, and the store's ordered elements are read, as the editor's view reads
// them after every gesture; each sample is then the one query that follows. Warm-up iterations
// are such samples too, whose times Vitest drops: they warm the code, never the rows.

/** A marquee around the whole scene, with room for elements moved by a unit. */
const WHOLE = { x: -100, y: -100, width: 8_200, height: 4_700 };

const checked = (what: string, each: string) =>
  `${what}: the first query after each of two enclosed what a scan of every element encloses, all 10,000, and every iteration, warm-up included, followed its own ${each}`;

/** A change of the moving elements, by one unit and back in turn, then a read of the order. */
function changing(store: SceneStore, moving: readonly Element[]) {
  const [forth, back] = shuttle(moving, 1, 1);
  const state = { moved: false, changes: 0 };
  const change = () => {
    store.apply(state.moved ? back : forth, 'local');
    state.moved = !state.moved;
    state.changes += 1;
    store.ordered();
  };
  return { change, state };
}

/** The first query after a change of the scene, as a scan of every element of it finds it. */
function expectFirstQuery(change: () => void, scene: () => SceneStore): void {
  change();
  const store = scene();
  const enclosed = bruteEnclosed(store.ordered(), WHOLE);
  expect(enclosed).toHaveLength(BENCH_SCENE.count);
  expect(enclosedBy(store, WHOLE)).toStrictEqual(enclosed);
}

/** The first query after each change of some of the elements, 200 samples after 40. */
async function firstAfterMoves(
  bench: TestContext['bench'],
  id: string,
  moving: (elements: readonly Element[]) => readonly Element[],
) {
  const elements = benchElements();
  const store = benchStore(elements);
  const { change, state } = changing(store, moving(elements));
  expectFirstQuery(change, () => store);
  expectFirstQuery(change, () => store);
  const before = state.changes;
  const name = `${id} the first whole-scene marquee query after a change`;
  const result = await bench(name, { beforeEach: change }, () => {
    enclosedBy(store, WHOLE);
  }).run(runOptions(200));
  expect(state.changes - before).toBe(240);
  return result;
}

test('I4 the first whole-scene marquee query after one of 10,000 elements moved', async ({
  bench,
  task,
}) => {
  const result = await firstAfterMoves(bench, 'I4', (elements) => elements.slice(5_000, 5_001));
  recordBench(
    task.meta,
    {
      budget: 'I4',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: checked('the element at 5,000 in drawing order moved by a unit and back', 'change'),
    },
    result,
  );
});

test('I5 the first whole-scene marquee query after 1,000 of 10,000 elements moved', async ({
  bench,
  task,
}) => {
  const every = BENCH_SCENE.count / 1_000;
  const result = await firstAfterMoves(bench, 'I5', (elements) =>
    elements.filter((_, at) => at % every === 0),
  );
  recordBench(
    task.meta,
    {
      budget: 'I5',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: checked("every tenth element, as B7's, moved by a unit and back", 'change'),
    },
    result,
  );
});

test('I6 the first whole-scene marquee query of 10,000 elements just loaded', async ({
  bench,
  task,
}) => {
  const elements = benchElements();
  const loaded = { store: benchStore(elements), loads: 0 };
  const load = () => {
    loaded.store = benchStore(elements);
    loaded.loads += 1;
    loaded.store.ordered();
  };
  expectFirstQuery(load, () => loaded.store);
  expectFirstQuery(load, () => loaded.store);
  const before = loaded.loads;
  const result = await bench(
    'I6 the first whole-scene marquee query of a scene just loaded',
    { beforeEach: load },
    () => {
      enclosedBy(loaded.store, WHOLE);
    },
  ).run(runOptions(50));
  expect(loaded.loads - before).toBe(60);
  recordBench(
    task.meta,
    {
      budget: 'I6',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: checked('the scene loaded into a new store as one load change set', 'load'),
    },
    result,
  );
});
