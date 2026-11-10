import { describe, expect, it } from 'vitest';

import type { Style } from '../../../src/model/style.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import type { ChangeError } from '../../../src/scene/check.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../../src/scene/store.ts';
import { changeSet } from '../../support/scene-state.ts';
import { expectNoneWritten, expectUnchanged, heldBy } from '../../support/store-model.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

// A change set with a value that runs code while the store plans it (issue 45). No change set holds
// one (ADR 0010 §2), and nothing decoded from JSON can; these tests show that such code changes
// neither what planning the set reports nor, through another store, the store that plans it.

/** The style, with a field that no style has when `extra` is set, whose stroke calls `onRead`. */
function readingStyle(style: Style, onRead: () => void, extra: boolean): Style {
  const { stroke, ...rest } = style;
  const reading = {
    ...(extra ? { extra: 1 } : {}),
    get stroke() {
      onRead();
      return stroke;
    },
    ...rest,
  };
  return reading;
}

type SetOf = (store: SceneStore, style: Style) => ChangeSet;

/**
 * The three ways a style is planned, with the fixture element that the set writes: by the
 * held-field path, by the generic path, and as an addition.
 */
const PATHS: readonly (readonly [string, SetOf, number])[] = [
  ['a held-field update', (store, style) => edit(store, 2, { style }), 2],
  ['a generic update', (store, style) => edit(store, 2, { link: 'https://a.test/', style }), 2],
  [
    'an addition',
    (store, style) =>
      changeSet([{ type: 'add', element: { ...present(store, 2), id: fixtureId(20), style } }]),
    20,
  ],
];

/** Runs `act` and returns what it threw, or fails when it threw nothing. */
function thrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  throw new Error('Nothing was thrown.');
}

/** The reasons for which a fresh fixture store refuses the set, made with a plain style. */
function refusedPlain(setOf: SetOf): readonly ChangeError[] {
  const store = fixtureStore();
  const thrown = thrownBy(() => {
    store.apply(setOf(store, { ...present(store, 2).style, extra: 1 } as Style), 'local');
  });
  if (!(thrown instanceof ChangeSetError)) throw new Error('The plain set was not refused.');
  return thrown.errors;
}

/** Moves the fixture's line one unit right, from where the store holds it now. */
const moveLine = (store: SceneStore): void => {
  store.apply(edit(store, 3, { x: present(store, 3).x + 1 }), 'local');
};

/** A fixture store, what it held before the test, and every update it told. */
function watched(): { store: SceneStore; held: ReturnType<typeof heldBy>; told: SceneUpdate[] } {
  const store = fixtureStore();
  const told: SceneUpdate[] = [];
  store.subscribe((update) => told.push(update));
  return { store, held: heldBy(store), told };
}

describe('the scene store, planning a set whose value applies a set to another store', () => {
  it.each(PATHS)('refuses %s with a field too many, as it refuses the plain set', (_, setOf) => {
    const { store, held, told } = watched();
    const other = fixtureStore();
    let reads = 0;
    const style = readingStyle(
      present(store, 2).style,
      () => {
        reads += 1;
        moveLine(other);
      },
      true,
    );
    const thrown = thrownBy(() => {
      store.apply(setOf(store, style), 'local');
    });
    expect(thrown).toBeInstanceOf(ChangeSetError);
    expect((thrown as ChangeSetError).errors).toStrictEqual(refusedPlain(setOf));
    expectUnchanged(store, held);
    expectNoneWritten(held);
    expect(told).toStrictEqual([]);
    expect(reads).toBeGreaterThan(0);
    expect({ rev: other.rev, x: present(other, 3).x }).toStrictEqual({
      rev: 1 + reads,
      x: 300 + reads,
    });
  });

  it.each(PATHS)('applies %s of a valid style as it applies the plain set', (_, setOf, index) => {
    const { store, told } = watched();
    const other = fixtureStore();
    const plain = fixtureStore();
    plain.apply(setOf(plain, present(plain, 2).style), 'local');
    const style = readingStyle(
      present(store, 2).style,
      () => {
        moveLine(other);
      },
      false,
    );
    store.apply(setOf(store, style), 'local');
    expect(store.document()).toStrictEqual(plain.document());
    expect(told.map(({ changed, rev }) => ({ changed, rev }))).toStrictEqual([
      { changed: [fixtureId(index)], rev: 2 },
    ]);
    const stored = present(store, index).style;
    expect(Object.getOwnPropertyDescriptor(stored, 'stroke')).toHaveProperty('value');
    expect(other.rev).toBeGreaterThan(1);
  });
});
