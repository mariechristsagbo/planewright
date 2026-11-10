import { expect } from 'vitest';

import type { Style } from '../../src/model/style.ts';
import type { ChangeSet } from '../../src/scene/change-set.ts';
import type { ChangeError } from '../../src/scene/check.ts';
import { ChangeSetError } from '../../src/scene/store.ts';
import type { SceneStore, SceneUpdate } from '../../src/scene/store.ts';
import { changeSet } from './scene-state.ts';
import { heldBy } from './store-model.ts';
import type { Held } from './store-model.ts';
import { edit, fixtureId, fixtureStore, present } from './stores.ts';

// Change sets with a value that runs code while the store plans them (issue 45), for the scene
// store's tests. No change set holds one (ADR 0010 §2), and nothing decoded from JSON can.

/** What the store says when it is asked to apply a set while it plans one. */
export const PLANNING_REFUSAL = 'cannot apply a change set while it is planning one';

/** The style, with a field that no style has when `extra` is set, whose stroke calls `onRead`. */
export function readingStyle(style: Style, onRead: () => void, extra: boolean): Style {
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

/** A set over the fixture store that writes the style into one of its elements. */
export type SetOf = (store: SceneStore, style: Style) => ChangeSet;

/**
 * The three ways a style is planned, with the fixture element that the set writes: by the
 * held-field path, by the generic path, and as an addition.
 */
export const PATHS: readonly (readonly [string, SetOf, number])[] = [
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
export function thrownBy(act: () => void): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  throw new Error('Nothing was thrown.');
}

/** The reasons for which a fresh fixture store refuses the set, made with a plain style. */
export function refusedPlain(setOf: SetOf): readonly ChangeError[] {
  const store = fixtureStore();
  const thrown = thrownBy(() => {
    store.apply(setOf(store, { ...present(store, 2).style, extra: 1 } as Style), 'local');
  });
  if (!(thrown instanceof ChangeSetError)) throw new Error('The plain set was not refused.');
  return thrown.errors;
}

/** Moves the fixture's line one unit right, from where the store holds it now. */
export const moveLine = (store: SceneStore): void => {
  store.apply(edit(store, 3, { x: present(store, 3).x + 1 }), 'local');
};

export interface Watched {
  readonly store: SceneStore;
  /** What the store held when it was made. */
  readonly held: Held;
  /** Every update that the store told. */
  readonly told: SceneUpdate[];
}

/** A fixture store with a listener that keeps every update. */
export function watched(): Watched {
  const store = fixtureStore();
  const told: SceneUpdate[] = [];
  store.subscribe((update) => told.push(update));
  return { store, held: heldBy(store), told };
}

/** At least one apply was tried, and each was refused for planning, not as a refused set. */
export function expectRefusedForPlanning(refusals: readonly unknown[]): void {
  expect(refusals.length).toBeGreaterThan(0);
  for (const refusal of refusals) {
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal).not.toBeInstanceOf(ChangeSetError);
    expect((refusal as Error).message).toContain(PLANNING_REFUSAL);
  }
}
