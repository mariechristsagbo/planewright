import { describe, expect, it } from 'vitest';

import { createRandom, randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import { patchValue } from '../../../src/model/patch.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { shuffled } from '../../support/generators.ts';
import { recorder } from '../../support/histories.ts';
import { anyGesturePatch } from '../../support/mixed-patches.ts';
import { anyMixedScene } from '../../support/mixed-sets.ts';
import { checkProperty } from '../../support/property.ts';
import { AUTHOR, contentOf } from '../../support/scene-state.ts';
import { chance } from '../../support/scenes.ts';

// Large change sets through the history (issue 36): transactions whose previews move, turn and
// resize up to 1,000 elements of a scene, some of them several times, then undo and redo. The
// last preview of each element wins, undo gives back the document as it was, and redo the one
// the previews reached, at every size.

function loaded(document: DocumentState): SceneStore {
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
  return store;
}

/** A preview of `count` elements' gestures, from the values that the store holds now. */
function anyPreview(random: Random, store: SceneStore, count: number): ChangeSet {
  const elements = shuffled(random, store.ordered()).slice(0, count);
  return {
    elements: elements.map((element: Element) => {
      const after = anyGesturePatch(random, element);
      const before = Object.fromEntries(
        Object.keys(after).map((key) => [key, patchValue(element, key)]),
      );
      return { type: 'update', id: element.id, before, after };
    }),
    groups: [],
    author: AUTHOR,
    seq: 0,
  };
}

interface Run {
  readonly seed: number;
  readonly size: number;
  readonly previews: number;
  /** Whether the transaction is cancelled rather than committed. */
  readonly cancel: boolean;
}

describe('the history over large change sets', () => {
  it(
    'commits the values of the last preview or cancels them all, and undoes and redoes at every size',
    { timeout: 120_000 },
    () => {
      checkProperty(
        { seed: 3663, runs: 12 },
        (random): Run => ({
          seed: randomInt(random, 0, 2 ** 31),
          size: chance(random, 0.5) ? randomInt(random, 900, 1_100) : randomInt(random, 0, 60),
          previews: randomInt(random, 1, 4),
          cancel: chance(random, 0.25),
        }),
        ({ seed, size, previews, cancel }) => {
          const random = createRandom(seed);
          const store = loaded(anyMixedScene(random, size, false));
          const { history } = recorder(store);
          const start = contentOf(store.document());
          const transaction = history.begin();
          for (let preview = 0; preview < previews; preview += 1) {
            const count = randomInt(random, 1, Math.min(1_000, store.ordered().length));
            transaction.preview(anyPreview(random, store, count));
          }
          const reached = contentOf(store.document());
          if (cancel) {
            transaction.cancel();
            expect(contentOf(store.document())).toStrictEqual(start);
            expect(history.canUndo).toBe(false);
            return;
          }
          const entry = transaction.commit('move');
          expect(contentOf(store.document())).toStrictEqual(reached);
          const ids = entry?.changes.elements.map((change) =>
            change.type === 'update' ? change.id : change.element.id,
          );
          expect(new Set(ids).size).toBe(ids?.length);
          for (let round = 0; round < 2; round += 1) {
            expect(history.undo()).not.toBeNull();
            expect(contentOf(store.document())).toStrictEqual(start);
            expect(history.redo()).not.toBeNull();
            expect(contentOf(store.document())).toStrictEqual(reached);
          }
        },
      );
    },
  );

  it('keeps the last of several sets that move the same 1,000 elements, and undoes each', () => {
    const random = createRandom(36);
    const store = loaded(anyMixedScene(random, 1_200, false));
    const { commit, history } = recorder(store);
    const moved = shuffled(random, store.ordered()).slice(0, 1_000);
    const xs = () => moved.map(({ id }) => store.get(id)?.x);
    for (const shift of [5, -3, 0.5]) {
      commit({
        elements: moved.map(({ id }) => {
          const x = store.get(id)?.x ?? Number.NaN;
          return { type: 'update', id, before: { x }, after: { x: x + shift } };
        }),
        groups: [],
        author: AUTHOR,
        seq: 0,
      });
    }
    expect(xs()).toStrictEqual(moved.map(({ x }) => x + 5 - 3 + 0.5));
    expect(moved.map(({ id }) => store.get(id)?.rev)).toStrictEqual(
      moved.map(({ rev }) => rev + 3),
    );
    history.undo();
    expect(xs()).toStrictEqual(moved.map(({ x }) => x + 5 - 3));
    history.undo();
    history.undo();
    expect(xs()).toStrictEqual(moved.map(({ x }) => x));
    history.redo();
    expect(xs()).toStrictEqual(moved.map(({ x }) => x + 5));
  });
});
