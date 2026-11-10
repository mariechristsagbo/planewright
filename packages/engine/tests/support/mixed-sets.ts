import { randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { patchValue } from '../../src/model/patch.ts';
import type { ElementPatch } from '../../src/model/patch.ts';
import type {
  CanvasChange,
  ChangeSet,
  ElementChange,
  GroupChange,
} from '../../src/scene/change-set.ts';
import { createSceneStore } from '../../src/scene/store.ts';
import { fixtureDocument } from './fixtures.ts';
import { shuffled } from './generators.ts';
import { anyBrokenPatch, anyMove, anyValidPatch } from './mixed-patches.ts';
import { AUTHOR, color } from './scene-state.ts';
import {
  anyGroups,
  anySceneElement,
  chance,
  pick,
  sceneElementId,
  sceneGroupId,
} from './scenes.ts';

// Change sets for the differential tests of issue 36: up to 1,000 updates of a scene's elements,
// mostly valid, with additions, removals, group and canvas changes, and in half of the sets one to
// three changes that the planner must refuse, or that it may refuse for some origins only.

/** The `before` values of a patch's fields, as the element holds them now. */
const beforeOf = (element: Element, after: ElementPatch): ElementPatch =>
  Object.fromEntries(Object.keys(after).map((key) => [key, patchValue(element, key)]));

const update = (element: Element, after: ElementPatch): ElementChange => ({
  type: 'update',
  id: element.id,
  before: beforeOf(element, after),
  after,
});

/** A count from 1 to `max`, spread evenly over its orders of magnitude. */
const logUniform = (random: Random, max: number): number =>
  Math.min(max, Math.floor(Math.exp(random.next() * Math.log(max + 1))) || 1);

/** The scene being changed, and the set's changes so far. */
interface Draft {
  readonly random: Random;
  readonly document: DocumentState;
  readonly elements: ElementChange[];
  readonly groups: GroupChange[];
  canvas: CanvasChange | undefined;
  readonly fresh: () => number;
}

const existing = (draft: Draft): Element =>
  pick(draft.random, [...draft.document.elements.values()]);

/** The elements that an arrow of the scene is attached to, which no valid set removes alone. */
const targetsIn = (document: DocumentState): ReadonlySet<string> =>
  new Set(
    [...document.elements.values()].flatMap((element) =>
      element.kind === 'arrow'
        ? [element.start?.target, element.end?.target].filter((target) => target !== undefined)
        : [],
    ),
  );

/** One change that some or every origin refuses, about an element of the scene. */
const BROKEN_CHANGES: readonly ((draft: Draft) => ElementChange | undefined)[] = [
  (draft) => {
    const element = existing(draft);
    return update(element, anyBrokenPatch(draft.random, element));
  },
  (draft) => {
    const element = existing(draft);
    const after = anyValidPatch(draft.random, element);
    return { ...update(element, after), before: { ...beforeOf(element, after), x: 1e-7 } };
  },
  (draft) => {
    const element = existing(draft);
    const after = { x: element.x + 1, y: element.y };
    const before = pick(draft.random, [{ x: element.x }, { x: element.x, y: element.y, z: 0 }]);
    return { type: 'update', id: element.id, before, after };
  },
  () => ({ type: 'update', id: sceneElementId(9_999_999), before: { x: 0 }, after: { x: 1 } }),
  (draft) => (draft.elements.length > 0 ? pick(draft.random, draft.elements) : undefined),
  (draft) => ({ type: 'add', element: existing(draft) }),
  (draft) => ({
    type: 'add',
    element: { ...existing(draft), id: sceneElementId(draft.fresh()), x: Number.NaN },
  }),
  (draft) => ({ type: 'remove', element: { ...existing(draft), id: sceneElementId(9_999_998) } }),
  (draft) => ({ type: 'remove', element: { ...existing(draft), locked: true, rev: 0 } }),
  (draft) => {
    const targeted = [...targetsIn(draft.document)].flatMap(
      (id) => draft.document.elements.get(id as ElementId) ?? [],
    );
    return targeted.length > 0
      ? { type: 'remove', element: pick(draft.random, targeted) }
      : undefined;
  },
  (draft) => {
    const after = Object.create({ x: 5 }) as ElementPatch;
    return { type: 'update', id: existing(draft).id, before: {}, after };
  },
];

/** A group or canvas change that a check refuses, for some or every origin. */
const BROKEN_OTHERS: readonly ((draft: Draft) => void)[] = [
  (draft) => {
    const groups = [...draft.document.groups.values()];
    const group =
      groups.length > 0 ? pick(draft.random, groups) : { id: sceneGroupId(draft.fresh()) };
    draft.groups.push(
      pick(draft.random, [
        { type: 'add', group },
        {
          type: 'add',
          group: { id: sceneGroupId(draft.fresh()), parent: sceneGroupId(draft.fresh()) },
        },
        { type: 'remove', group: { ...group, parent: group.id } },
        { type: 'remove', group },
      ] as const),
    );
  },
  (draft) => {
    draft.canvas = chance(draft.random, 0.5)
      ? { before: { background: color('#000000') }, after: draft.document.canvas }
      : { before: draft.document.canvas, after: { background: color('grey') } };
  },
];

/** A valid group change: a new group, possibly nested, or the removal of an empty one. */
function groupChange(draft: Draft): GroupChange {
  const groups = [...draft.document.groups.values()];
  const used = new Set([
    ...[...draft.document.elements.values()].map(({ group }) => group),
    ...groups.map(({ parent }) => parent),
  ]);
  const empty = groups.filter(({ id }) => !used.has(id));
  if (empty.length > 0 && chance(draft.random, 0.5)) {
    return { type: 'remove', group: pick(draft.random, empty) };
  }
  const id = sceneGroupId(draft.fresh());
  const parent = groups.length === 0 ? undefined : pick(draft.random, groups).id;
  return { type: 'add', group: parent === undefined ? { id } : { id, parent } };
}

/** Valid additions and removals of whole elements, among the updates. */
function addAndRemove(draft: Draft, free: readonly Element[]): ElementChange[] {
  const targeted = targetsIn(draft.document);
  const removable = free.filter(({ id }) => !targeted.has(id));
  const removed = removable.slice(0, randomInt(draft.random, 0, Math.min(2, removable.length)));
  const gone = new Set<string>(removed.map(({ id }) => id));
  const refs = {
    elements: [...draft.document.elements.keys()].filter((id) => !gone.has(id)),
    groups: [...draft.document.groups.keys()],
  };
  const added = Array.from({ length: randomInt(draft.random, 0, 2) }, () =>
    anySceneElement(draft.random, sceneElementId(draft.fresh()), refs),
  );
  return [
    ...removed.map((element) => ({ type: 'remove', element }) as const),
    ...added.map((element) => ({ type: 'add', element }) as const),
  ];
}

const elementsOf = (document: DocumentState, ids: readonly ElementId[]): Element[] =>
  ids.flatMap((id) => document.elements.get(id) ?? []);

const insertAt = <T>(random: Random, items: T[], item: T): void => {
  items.splice(randomInt(random, 0, items.length), 0, item);
};

/** Adds one to three changes that a check refuses, for some or every origin. */
function breakDraft(draft: Draft): void {
  for (let broken = randomInt(draft.random, 1, 3); broken > 0; broken -= 1) {
    if (chance(draft.random, 0.15)) {
      pick(draft.random, BROKEN_OTHERS)(draft);
      continue;
    }
    const change = pick(draft.random, BROKEN_CHANGES)(draft);
    if (change !== undefined) insertAt(draft.random, draft.elements, change);
  }
}

/**
 * A change set over `document`: updates of 1 to `max` distinct elements, a few additions and
 * removals, sometimes a group and a canvas change, all valid, and in half of the sets one to
 * three changes that a check refuses for some or every origin, each at a random place in the set.
 */
export function anyMixedSet(
  random: Random,
  document: DocumentState,
  fresh: () => number,
  max = 1_000,
): ChangeSet {
  const ids = shuffled(random, [...document.elements.keys()]);
  const count = logUniform(random, Math.min(max, ids.length));
  const draft: Draft = { random, document, elements: [], groups: [], canvas: undefined, fresh };
  for (const element of elementsOf(document, ids.slice(0, count))) {
    draft.elements.push(update(element, anyValidPatch(random, element)));
  }
  for (const change of addAndRemove(draft, elementsOf(document, ids.slice(count)))) {
    insertAt(random, draft.elements, change);
  }
  if (chance(random, 0.2)) draft.groups.push(groupChange(draft));
  if (chance(random, 0.1)) {
    draft.canvas = { before: document.canvas, after: { background: color('#fafafa') } };
  }
  if (chance(random, 0.5)) breakDraft(draft);
  const { canvas } = draft;
  return {
    elements: draft.elements,
    groups: draft.groups,
    ...(canvas === undefined ? {} : { canvas }),
    author: AUTHOR,
    seq: fresh(),
  };
}

/** A set that moves `count` distinct elements of the scene, chosen at random. */
export function anyMoveSet(random: Random, document: DocumentState, count: number): ChangeSet {
  const ids = shuffled(random, [...document.elements.keys()]).slice(0, count);
  const elements = elementsOf(document, ids).map((element) =>
    update(element, anyMove(random, element)),
  );
  return { elements, groups: [], author: AUTHOR, seq: 0 };
}

/**
 * A scene as a store holds it, each element checked into the model's field order: the fixture's
 * ten elements of every kind, with their groups, and `count` random elements in up to five more
 * groups, some of them arrows attached to earlier elements; unless `largest` is false, the last
 * holds the largest revision, which one update can raise and a second one finds out of range.
 */
export function anyMixedScene(random: Random, count: number, largest = true): DocumentState {
  const fixture = fixtureDocument();
  const groups = [...fixture.groups.values(), ...anyGroups(random, 5)];
  const elements = [...fixture.elements.values()];
  for (let index = 0; index < count; index += 1) {
    const refs = { elements: elements.map(({ id }) => id), groups: groups.map(({ id }) => id) };
    elements.push(anySceneElement(random, sceneElementId(index), refs));
  }
  const last = elements.pop();
  if (last !== undefined) elements.push(largest ? { ...last, rev: Number.MAX_SAFE_INTEGER } : last);
  const store = createSceneStore(fixture.canvas);
  store.apply(
    {
      elements: elements.map((element) => ({ type: 'add', element })),
      groups: groups.map((group) => ({ type: 'add', group })),
      author: AUTHOR,
      seq: 0,
    },
    'load',
  );
  return store.document();
}
