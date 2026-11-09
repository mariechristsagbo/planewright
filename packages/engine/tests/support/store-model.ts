import { expect } from 'vitest';

import { worldBounds } from '../../src/geometry/world-bounds.ts';
import type { Random } from '../../src/math/random.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { Plan } from '../../src/scene/check.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import {
  anyQueryBox,
  anyQueryPoint,
  bruteBox,
  bruteConnectors,
  bruteMembers,
  bruteOrder,
  bruteOutermost,
  brutePoint,
  pick,
  sortedIds,
} from './scenes.ts';

// A reference model of the store for the differential tests of issue 36: a document that a plan
// of the planner before the issue is applied to, and the checks that the store agrees with it.

/** The document once a plan is applied: deltas, groups and canvas, and the revision raised. */
export function appliedPlan(document: DocumentState, plan: Plan): DocumentState {
  const elements = new Map(document.elements);
  for (const { id, after } of plan.elements) {
    if (after === undefined) elements.delete(id);
    else elements.set(id, after);
  }
  const groups = new Map(document.groups);
  for (const group of plan.addedGroups) groups.set(group.id, group);
  for (const { id } of plan.removedGroups) groups.delete(id);
  return { elements, groups, canvas: plan.canvas ?? document.canvas, rev: document.rev + 1 };
}

/** Freezes a value and everything in it, so that any write to it throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** What the store holds, as the objects it holds them in, with the reader's revision and order. */
export interface Held {
  readonly document: DocumentState;
  readonly rev: number;
  readonly ordered: readonly Element[];
  /** Each element written out, to see that no element changed in place. */
  readonly written: ReadonlyMap<ElementId, string>;
}

export function heldBy(store: SceneStore): Held {
  const document = store.document();
  const written = new Map(
    [...document.elements].map(([id, element]) => [id, JSON.stringify(element)]),
  );
  return { document, rev: store.rev, ordered: store.ordered(), written };
}

/** The store holds the same objects as before, at the same revision, with the same order array. */
export function expectUnchanged(store: SceneStore, held: Held): void {
  expect(store.rev).toBe(held.rev);
  expect(store.ordered()).toBe(held.ordered);
  const now = store.document();
  expect(now.elements.size).toBe(held.document.elements.size);
  for (const [id, element] of held.document.elements) expect(now.elements.get(id)).toBe(element);
  expect(now.groups).toStrictEqual(held.document.groups);
  expect(now.canvas).toBe(held.document.canvas);
}

/** No element that the store held changed in place, whatever the store holds now. */
export function expectNoneWritten(held: Held): void {
  for (const [id, element] of held.document.elements) {
    expect(JSON.stringify(element)).toBe(held.written.get(id));
  }
}

/** The store holds the expected document, field order included, and keeps unchanged elements. */
export function expectHolds(store: SceneStore, expected: DocumentState, before: Held): void {
  const now = store.document();
  expect(now).toStrictEqual(expected);
  expect(JSON.stringify([...now.elements])).toBe(JSON.stringify([...expected.elements]));
  for (const [id, element] of now.elements) {
    const previous = before.document.elements.get(id);
    if (previous !== undefined && expected.elements.get(id) === previous) {
      expect(element).toBe(previous);
    }
  }
}

/**
 * Every query of the store agrees with a scan of the document: the drawing order, random boxes
 * and points, each changed element listed under its world bounds, and the groups and connectors
 * of the changed elements and of a few others.
 */
export function expectIndexesAgree(
  store: SceneStore,
  { elements, groups }: DocumentState,
  { random, changed }: { readonly random: Random; readonly changed: readonly ElementId[] },
): void {
  const all = [...elements.values()];
  expect(store.ordered().map(({ id }) => id)).toStrictEqual(bruteOrder(all));
  for (let query = 0; query < 4; query += 1) {
    const box = anyQueryBox(random);
    expect(sortedIds(store.queryBox(box))).toStrictEqual(bruteBox(all, box));
    const { point, radius } = anyQueryPoint(random);
    expect(sortedIds(store.queryPoint(point, radius))).toStrictEqual(
      brutePoint(all, point, radius),
    );
  }
  const sample = all.length === 0 ? [] : Array.from({ length: 8 }, () => pick(random, all).id);
  for (const id of [...changed, ...sample]) {
    const element = elements.get(id);
    if (element !== undefined) {
      expect(store.queryBox(worldBounds(element))).toContain(id);
      expect(store.outermostGroup(id)).toBe(bruteOutermost(groups, element));
    }
    expect(sortedIds(store.connectorsOf(id))).toStrictEqual(bruteConnectors(all, id));
  }
  for (const id of groups.keys()) {
    expect(sortedIds(store.members(id))).toStrictEqual(bruteMembers(all, groups, id));
  }
}
