import { describe, expect, it } from 'vitest';

import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { Style } from '../../../src/model/style.ts';
import type { ChangeOrigin, ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import type { ChangeError } from '../../../src/scene/check.ts';
import { ChangeSetError, createSceneStore } from '../../../src/scene/store.ts';
import type { SceneStore } from '../../../src/scene/store.ts';
import { anyMixedScene, anyMixedSet } from '../../support/mixed-sets.ts';
import { checkProperty } from '../../support/property.ts';
import { readThrough } from '../../support/read-hooks.ts';
import { AUTHOR } from '../../support/scene-state.ts';
import { chance, pick } from '../../support/scenes.ts';
import { edit, fixtureStore, present } from '../../support/stores.ts';

// Mixed change sets of valid and refused changes (issue 45), applied once as plain JSON and once
// read through getters that run code at every read of a field or an item: the store must plan
// both alike, whatever that code applies to another store meanwhile.

const ORIGINS: readonly ChangeOrigin[] = ['local', 'history', 'load', 'remote'];

/** Styles that a check refuses after it has read on past its first error. */
const BROKEN_STYLES: readonly ((style: Style) => object)[] = [
  (style) => ({ ...style, extra: 1 }),
  (style) => ({ ...style, opacity: 2 }),
  (style) => ({ ...style, stroke: { ...style.stroke, color: 'red' } }),
];

interface Run {
  readonly document: DocumentState;
  readonly changes: ChangeSet;
  readonly origin: ChangeOrigin;
}

const idOf = (change: ElementChange): string =>
  change.type === 'update' ? change.id : change.element.id;

/** A mixed set over a scene, with an update of a broken style at a random place, half the time. */
function anyRun(random: Random): Run {
  const document = anyMixedScene(random, randomInt(random, 0, 150));
  let next = 10_000;
  const mixed = anyMixedSet(random, document, () => (next += 1), 200);
  const named = new Set(mixed.elements.map(idOf));
  const free = [...document.elements.values()].filter(({ id }) => !named.has(id));
  const elements = [...mixed.elements];
  if (free.length > 0 && chance(random, 0.5)) {
    const element = pick(random, free);
    const after = { style: pick(random, BROKEN_STYLES)(element.style) };
    const change: ElementChange = {
      type: 'update',
      id: element.id,
      before: { style: element.style },
      after,
    };
    elements.splice(randomInt(random, 0, elements.length), 0, change);
  }
  return { document, changes: { ...mixed, elements }, origin: pick(random, ORIGINS) };
}

/** A store holding the document, loaded as one `load` set, and the number of updates it told. */
function loaded(document: DocumentState): { readonly store: SceneStore; told: number } {
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
  const watched = { store, told: 0 };
  store.subscribe(() => {
    watched.told += 1;
  });
  return watched;
}

interface Outcome {
  /** The reasons of a refusal, or the text of another error, or nothing for an applied set. */
  readonly refused: readonly ChangeError[] | string | undefined;
  readonly document: DocumentState;
  readonly told: number;
}

function outcome(document: DocumentState, changes: ChangeSet, origin: ChangeOrigin): Outcome {
  const watched = loaded(document);
  let refused: Outcome['refused'];
  try {
    watched.store.apply(changes, origin);
  } catch (error) {
    refused =
      error instanceof ChangeSetError
        ? error.errors
        : `${(error as Error).name}: ${(error as Error).message}`;
  }
  return { refused, document: watched.store.document(), told: watched.told };
}

/** Moves the fixture's line one unit right, from where the store holds it now. */
const moveLine = (store: SceneStore): void => {
  store.apply(edit(store, 3, { x: present(store, 3).x + 1 }), 'local');
};

describe('the scene store, planning sets read through getters', () => {
  it(
    'plans each mixed set as its plain JSON, while every read applies a set to another store',
    { timeout: 60_000 },
    () => {
      const counts = { applied: 0, refused: 0, reads: 0 };
      checkProperty({ seed: 4501, runs: 40 }, anyRun, ({ document, changes, origin }) => {
        const expected = outcome(document, changes, origin);
        const other = fixtureStore();
        let reads = 0;
        const hooked = readThrough(changes, () => {
          reads += 1;
          moveLine(other);
        });
        const actual = outcome(document, hooked, origin);
        expect(actual).toStrictEqual(expected);
        expect(JSON.stringify([...actual.document.elements])).toBe(
          JSON.stringify([...expected.document.elements]),
        );
        expect({ rev: other.rev, x: present(other, 3).x }).toStrictEqual({
          rev: 1 + reads,
          x: 300 + reads,
        });
        counts[expected.refused === undefined ? 'applied' : 'refused'] += 1;
        counts.reads += reads;
      });
      // Both outcomes ran often, and every run read its set through the getters.
      expect(counts.applied).toBeGreaterThan(5);
      expect(counts.refused).toBeGreaterThan(5);
      expect(counts.reads).toBeGreaterThan(40 * 10);
    },
  );
});
