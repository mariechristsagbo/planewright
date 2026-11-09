import { describe, expect, it } from 'vitest';

import { createRandom, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { ChangeOrigin, ChangeSet } from '../../../src/scene/change-set.ts';
import type { Planned } from '../../../src/scene/check.ts';
import { ChangeSetError, createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { anyMixedScene, anyMixedSet, anyMoveSet } from '../../support/mixed-sets.ts';
import { checkProperty } from '../../support/property.ts';
import { referencePlan } from '../../support/reference-plan.ts';
import { AUTHOR, stateOf } from '../../support/scene-state.ts';
import { chance, pick } from '../../support/scenes.ts';
import {
  appliedPlan,
  deepFreeze,
  expectHolds,
  expectIndexesAgree,
  expectNoneWritten,
  expectUnchanged,
  heldBy,
} from '../../support/store-model.ts';

// The store over runs of mixed change sets, against a model that applies the plans of the planner
// as it was before issue 36: what it holds, field order included, its revision, the one update
// each listener receives, what its indexes answer, and that a refused set writes nothing at all.

/** A listener's error, thrown for some applied sets: the set stays applied and is told to all. */
const LISTENER_ERROR = new Error('a listener failed');

interface Session {
  readonly store: SceneStore;
  readonly updates: SceneUpdate[];
  document: DocumentState;
}

function loadedSession(document: DocumentState): Session {
  const store = createSceneStore(document.canvas);
  store.apply(
    {
      elements: [...document.elements.values()].map((element) => ({ type: 'add', element })),
      groups: [...document.groups.values()].map((group) => ({ type: 'add', group })),
      author: AUTHOR,
      seq: 0,
    },
    'load',
  );
  const session: Session = { store, updates: [], document: store.document() };
  store.subscribe((update) => {
    if (update.changed.length % 5 === 3) throw LISTENER_ERROR;
  });
  store.subscribe((update) => {
    session.updates.push(update);
  });
  return session;
}

/** Applies one set, and checks it against the model; returns whether the store took it. */
function step(session: Session, random: Random, changes: ChangeSet): boolean {
  const origin = pick(random, [
    'local',
    'history',
    'load',
    'remote',
  ] as const satisfies ChangeOrigin[]);
  const transient = chance(random, 0.3);
  const expected: Planned = referencePlan(stateOf(session.document), changes, origin);
  const held = heldBy(session.store);
  const told = session.updates.length;
  const thrown = attempt(() => {
    session.store.apply(deepFreeze(changes), origin, { transient });
  });
  expectNoneWritten(held);
  if (!expected.ok) {
    expect(thrown).toBeInstanceOf(ChangeSetError);
    expect((thrown as ChangeSetError).errors).toStrictEqual(expected.errors);
    expect(session.updates).toHaveLength(told);
    expectUnchanged(session.store, held);
    return false;
  }
  const changed = expected.plan.elements.map(({ id }) => id);
  expect(thrown).toBe(changed.length % 5 === 3 ? LISTENER_ERROR : undefined);
  expect(session.updates.slice(told)).toStrictEqual([
    { origin, transient, changes, changed, rev: held.rev + 1 },
  ]);
  expect(session.updates.at(-1)?.changes).toBe(changes);
  const model = appliedPlan(session.document, expected.plan);
  expectHolds(session.store, model, held);
  expect(session.store.rev).toBe(model.rev);
  expectIndexesAgree(session.store, model, { random, changed });
  // The next set is planned over the store's own objects, so that every element kept is checked.
  session.document = session.store.document();
  return true;
}

function attempt(run: () => void): unknown {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('the scene store against the planner before issue 36', () => {
  it(
    'applies each mixed set as the model does, or refuses it and writes nothing',
    { timeout: 120_000 },
    () => {
      const counts = { applied: 0, refused: 0, largest: 0 };
      checkProperty(
        { seed: 3662, runs: 16 },
        (random) => ({
          seed: randomInt(random, 0, 2 ** 31),
          size: chance(random, 0.4) ? 1_100 : 120,
        }),
        ({ seed, size }) => {
          const random = createRandom(seed);
          const session = loadedSession(anyMixedScene(random, size));
          let next = 50_000;
          for (let run = 0; run < 6; run += 1) {
            const changes =
              run === 0
                ? anyMoveSet(random, session.document, randomInt(random, 1, 1_000))
                : anyMixedSet(random, session.document, () => (next += 1));
            const applied = step(session, random, changes);
            counts[applied ? 'applied' : 'refused'] += 1;
            counts.largest = Math.max(counts.largest, applied ? changes.elements.length : 0);
          }
        },
      );
      // Both outcomes ran often, and some applied sets moved hundreds of elements.
      expect(counts.applied).toBeGreaterThan(20);
      expect(counts.refused).toBeGreaterThan(20);
      expect(counts.largest).toBeGreaterThan(500);
    },
  );

  it('raises the largest revision once, then refuses to update the element again, as before', () => {
    const session = loadedSession(anyMixedScene(createRandom(36), 0));
    const frame = [...session.document.elements.values()].find(({ kind }) => kind === 'frame');
    if (frame === undefined) throw new Error('The scene has a frame.');
    expect(frame.rev).toBe(Number.MAX_SAFE_INTEGER);
    const move = (x: number): ChangeSet => ({
      elements: [{ type: 'update', id: frame.id, before: { x }, after: { x: x + 1 } }],
      groups: [],
      author: AUTHOR,
      seq: 1,
    });
    expect(step(session, createRandom(1), move(frame.x))).toBe(true);
    expect(session.store.get(frame.id)?.rev).toBe(2 ** 53);
    expect(step(session, createRandom(2), move(frame.x + 1))).toBe(false);
  });
});
