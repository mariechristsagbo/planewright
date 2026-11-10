import { describe, expect, it } from 'vitest';

import { contentBounds } from '../../../src/geometry/world-bounds.ts';
import { aabbExpand } from '../../../src/math/aabb.ts';
import type { Aabb } from '../../../src/math/aabb.ts';
import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { enclosedBy } from '../../../src/selection/marquee.ts';
import { bruteEnclosed } from '../../support/enclosure.ts';
import { BENCH_SCENE, benchElements, benchStore, shuttle } from '../../support/perf-bench.ts';
import { checkProperty } from '../../support/property.ts';
import { changeSet, color } from '../../support/scene-state.ts';
import { anyQueryBox, anySceneElement, pick, sceneElementId } from '../../support/scenes.ts';
import { watched } from '../../support/watched-scene.ts';

// Box selection's kept rows after a change that leaves them empty or elsewhere (REQ-S06,
// rendering-and-hit-testing.md#what-issue-43-decided): a marquee that meets more than a sixteenth
// of the scene's elements makes them again, whatever the rows made before it say, and the next
// query scans them. A query that reads no element is one that scanned rows of the current scene.

/** A marquee around the benchmarks' scene, with room for elements moved by a unit. */
const WHOLE = { x: -100, y: -100, width: 8_200, height: 4_700 };

/** The same marquee 50,000 units to the right. */
const AWAY = { ...WHOLE, x: WHOLE.x + 50_000 };

const removal = (store: SceneStore): ChangeSet =>
  changeSet(store.ordered().map((element) => ({ type: 'remove', element })));

const addition = (elements: readonly Element[]): ChangeSet =>
  changeSet(elements.map((element) => ({ type: 'add', element })));

type Watching = ReturnType<typeof watched>;

/** The query's result, then a second query's, which reads no element of the scene. */
function scansRowsNext({ reader, reads }: Watching, marquee: Aabb, expected: readonly string[]) {
  expect(enclosedBy(reader, marquee)).toStrictEqual(expected);
  reads.clear();
  expect(enclosedBy(reader, marquee)).toStrictEqual(expected);
  expect(reads.size).toBe(0);
}

describe('kept marquee rows over the benchmarks’ 10,000 elements', () => {
  it('are made again by a whole-scene marquee after delete all, a marquee and undo', () => {
    const elements = benchElements();
    const store = benchStore(elements);
    const watching = watched(store);
    expect(enclosedBy(watching.reader, WHOLE)).toHaveLength(BENCH_SCENE.count);
    store.apply(removal(store), 'local');
    expect(enclosedBy(watching.reader, WHOLE)).toStrictEqual([]);
    store.apply(addition(elements), 'history');
    const all = bruteEnclosed(elements, WHOLE);
    expect(all).toHaveLength(BENCH_SCENE.count);
    scansRowsNext(watching, WHOLE, all);
  });

  it('are made again by a whole-scene marquee after every element moved elsewhere', () => {
    const elements = benchElements();
    const store = benchStore(elements);
    const watching = watched(store);
    expect(enclosedBy(watching.reader, WHOLE)).toHaveLength(BENCH_SCENE.count);
    store.apply(shuttle(elements, 50_000, 0)[0], 'local');
    const all = bruteEnclosed(store.ordered(), AWAY);
    expect(all).toHaveLength(BENCH_SCENE.count);
    scansRowsNext(watching, AWAY, all);
  });

  it('are made again by a whole-scene marquee after most of the elements were added', () => {
    const elements = benchElements();
    const far = elements.slice(0, 32).map((element) => ({ ...element, x: element.x + 50_000 }));
    const store = benchStore(far);
    const watching = watched(store);
    expect(enclosedBy(watching.reader, AWAY)).toHaveLength(32);
    store.apply(addition(elements.slice(32)), 'local');
    const all = bruteEnclosed(store.ordered(), WHOLE);
    expect(all).toHaveLength(BENCH_SCENE.count - 32);
    scansRowsNext(watching, WHOLE, all);
  });

  it('are left for a marquee over few elements, which reads only its candidates', () => {
    const elements = benchElements();
    const store = benchStore(elements);
    const watching = watched(store);
    expect(enclosedBy(watching.reader, WHOLE)).toHaveLength(BENCH_SCENE.count);
    store.apply(shuttle(elements, 50_000, 0)[0], 'local');
    const small = { x: 50_000, y: 0, width: 200, height: 200 };
    const enclosed = bruteEnclosed(store.ordered(), small);
    watching.reads.clear();
    expect(enclosedBy(watching.reader, small)).toStrictEqual(enclosed);
    const candidates = store.queryBox(small);
    expect(candidates.length).toBeLessThan(BENCH_SCENE.count / 16);
    expect([...watching.reads.keys()].sort()).toStrictEqual([...candidates].sort());
  });
});

const SWEEPS = ['remove all', 'restore', 'move all', 'add many', 'move one'] as const;

interface Sweep {
  readonly kind: (typeof SWEEPS)[number];
  readonly dx: number;
  readonly dy: number;
}

/** A few elements, twenty times as many to add later, and sweeping changes between queries. */
function anySweeps(random: Random) {
  const refs = { elements: [], groups: [] };
  const count = randomInt(random, 1, 12);
  const element = (index: number) => anySceneElement(random, sceneElementId(index), refs);
  return {
    elements: Array.from({ length: count }, (_, index) => element(index)),
    extra: Array.from({ length: count * 20 }, (_, index) => element(1_000 + index)),
    sweeps: Array.from({ length: 8 }, (): Sweep => {
      const kind = pick(random, SWEEPS);
      return { kind, dx: pick(random, [1, 3e4, -3e4]), dy: pick(random, [0, 1, 3e4]) };
    }),
    small: anyQueryBox(random),
  };
}

const moved = (elements: readonly Element[], { dx, dy }: Sweep): ChangeSet =>
  changeSet(
    elements.map(({ id, x, y }) => ({
      type: 'update',
      id,
      before: { x, y },
      after: { x: x + dx, y: y + dy },
    })),
  );

/** The change a sweep makes, keeping in `out` the elements that a removal of all takes out. */
function sweepChanges(store: SceneStore, sweep: Sweep, out: Element[], extra: readonly Element[]) {
  const absent = (elements: readonly Element[]) =>
    elements.filter(({ id }) => store.get(id) === undefined);
  const now = store.ordered();
  if (sweep.kind === 'remove all') {
    out.splice(0, out.length, ...now);
    return removal(store);
  }
  if (sweep.kind === 'restore') return addition(absent(out));
  if (sweep.kind === 'add many') return addition(absent(extra));
  return moved(sweep.kind === 'move all' ? now : now.slice(0, 1), sweep);
}

/** The whole content, where it was before the sweep and where it is now, and a small marquee. */
const marqueesOf = (store: SceneStore, before: Aabb | null, small: Aabb): Aabb[] =>
  [before, contentBounds(store.ordered()), small].flatMap((box) =>
    box === null ? [] : [aabbExpand(box, 1)],
  );

describe('kept marquee rows through sweeping changes', () => {
  it('are made again by every marquee whose candidates are more than a sixteenth', () => {
    checkProperty({ seed: 4301, runs: 150 }, anySweeps, ({ elements, extra, sweeps, small }) => {
      const store = createSceneStore({ background: color('#ffffff') });
      store.apply(addition(elements), 'load');
      const watching = watched(store);
      const out: Element[] = [];
      for (const sweep of sweeps) {
        const before = contentBounds(store.ordered());
        store.apply(sweepChanges(store, sweep, out, extra), 'local');
        for (const marquee of marqueesOf(store, before, small)) {
          const expected = bruteEnclosed(store.ordered(), marquee);
          expect(enclosedBy(watching.reader, marquee)).toStrictEqual(expected);
          if (store.queryBox(marquee).length <= store.ordered().length / 16) continue;
          watching.reads.clear();
          expect(enclosedBy(watching.reader, marquee)).toStrictEqual(expected);
          expect(watching.reads.size).toBe(0);
        }
      }
    });
  });
});
