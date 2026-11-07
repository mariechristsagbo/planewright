import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { patchValue } from '../../src/model/patch.ts';
import type { ChangeSet } from '../../src/scene/change-set.ts';
import { createSceneStore } from '../../src/scene/store.ts';
import type { SceneReader, SceneStore } from '../../src/scene/store.ts';
import { elementId, fixtureDocument } from './fixtures.ts';
import { changeSet } from './scene-state.ts';

// Scene stores for the tests of what is built on the store: transactions and history.

/** The fixture identifier `index`, also for elements that a test adds. */
export const fixtureId = (index: number): ElementId => elementId(index) as ElementId;

/** A store that holds the fixture document, loaded as one `load` change set. */
export function fixtureStore(): SceneStore {
  const { elements, groups, canvas } = fixtureDocument();
  const store = createSceneStore(canvas);
  store.apply(
    changeSet(
      [...elements.values()].map((element) => ({ type: 'add', element })),
      [...groups.values()].map((group) => ({ type: 'add', group })),
    ),
    'load',
  );
  return store;
}

/** The element that the store holds under the fixture identifier `index`. */
export function present(store: SceneReader, index: number): Element {
  const found = store.get(fixtureId(index));
  if (found === undefined) throw new Error(`The store holds no element ${String(index)}.`);
  return found;
}

/** An update of one element's fields, from the values that the store holds now. */
export function edit(store: SceneReader, index: number, after: Record<string, unknown>): ChangeSet {
  const current = present(store, index);
  const before = Object.fromEntries(
    Object.keys(after).map((key) => [key, patchValue(current, key)]),
  );
  return changeSet([{ type: 'update', id: fixtureId(index), before, after }]);
}
