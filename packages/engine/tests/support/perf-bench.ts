import { worldBounds } from '../../src/geometry/world-bounds.ts';
import type { Aabb } from '../../src/math/aabb.ts';
import { toColor } from '../../src/model/color.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ChangeSet } from '../../src/scene/change-set.ts';
import { createSceneStore } from '../../src/scene/store.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import { perfElements } from './perf-scenes.ts';
import { changeSet } from './scene-state.ts';

// What the engine's benchmarks share (docs/architecture/engine/quality.md#performance-budgets):
// one seeded scene of 10,000 elements, the run options that every benchmark uses, and the record
// of what a benchmark measured, which the performance report reads from the test's meta.

/** The seed and the size of the scene that every engine benchmark measures on. */
export const BENCH_SCENE = {
  seed: 15,
  count: 10_000,
  area: { x: 0, y: 0, width: 8_000, height: 4_500 },
} as const;

/**
 * Vitest's benchmark run options: a fifth as many warm-up iterations as timed ones, no time limit,
 * so that exactly `iterations` samples are kept, and a failure of the benchmarked function ending
 * the run. Vitest's runner chooses the clock; the record names it.
 */
export const runOptions = (iterations: number) =>
  ({
    iterations,
    time: 0,
    warmupIterations: Math.ceil(iterations / 5),
    warmupTime: 0,
    retainSamples: true,
    throws: true,
  }) as const;

/** The scene's elements, in drawing order. */
export const benchElements = (): Element[] => perfElements(BENCH_SCENE);

/** A store holding the elements, loaded as one `load` change set, as a cached load does. */
export function benchStore(elements: readonly Element[]): SceneStore {
  const store = createSceneStore({ background: toColor('#ffffff') });
  store.apply(changeSet(elements.map((element) => ({ type: 'add', element }))), 'load');
  return store;
}

/**
 * Two change sets that move each element by (dx, dy) from where it is now and back to exactly
 * where it was, so that they can be applied in turn for as long as a benchmark runs.
 */
export function shuttle(
  elements: readonly Element[],
  dx: number,
  dy: number,
): readonly [ChangeSet, ChangeSet] {
  const moves = elements.map(({ id, x, y }) => ({
    id,
    at: { x, y },
    moved: { x: x + dx, y: y + dy },
  }));
  return [
    changeSet(moves.map(({ id, at, moved }) => ({ type: 'update', id, before: at, after: moved }))),
    changeSet(moves.map(({ id, at, moved }) => ({ type: 'update', id, before: moved, after: at }))),
  ];
}

/** The boxes of a marquee dragged from the area's top-left corner to its far corner, in steps. */
export function marqueeSweep(area: Aabb, steps: number): Aabb[] {
  return Array.from({ length: steps }, (_, step) => ({
    x: area.x,
    y: area.y,
    width: (area.width * (step + 1)) / steps,
    height: (area.height * (step + 1)) / steps,
  }));
}

/** Whether the spatial index lists an element under its world bounds now. */
export const indexed = (store: SceneStore, element: Element): boolean =>
  store.queryBox(worldBounds(element)).includes(element.id);

/** What the report reads about a benchmark beside Vitest's statistics. */
export interface BenchRecord {
  /** The budget's row in quality.md, B5 to B8, or I4 to I6, measurements that are no budget. */
  readonly budget: string;
  readonly seed: number;
  readonly elements: number;
  /** What the test checked about the benchmarked results before timing them. */
  readonly checked: string;
  readonly clock: string;
  readonly runtime: string;
}

/** Keeps the record in the test's meta, which Vitest's JSON report carries to the report. */
export function recordBench(
  meta: object,
  record: Omit<BenchRecord, 'clock' | 'runtime'>,
  result: { readonly timestampProviderName: string; readonly runtimeVersion: string },
): void {
  // Vitest's runner hands tinybench the runtime's `performance.now()`, which tinybench names custom.
  const clock = result.timestampProviderName === 'custom' ? 'performance.now()' : 'tinybench';
  const perf: BenchRecord = { ...record, clock, runtime: result.runtimeVersion };
  Object.assign(meta, { perf });
}
