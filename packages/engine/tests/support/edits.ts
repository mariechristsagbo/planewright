import { randomBetween, randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../src/model/ids.ts';
import { applyPatch, patchValue } from '../../src/model/patch.ts';
import type { ElementPatch } from '../../src/model/patch.ts';
import type { ChangeSet, ElementChange, GroupChange } from '../../src/scene/change-set.ts';
import { AUTHOR } from './scene-state.ts';
import {
  anyGroups,
  anyOrderKey,
  anySceneElement,
  chance,
  pick,
  sceneElementId,
  sceneGroupId,
} from './scenes.ts';

// Random valid change sets over a scene, for the store's and the transactions' properties. Each
// set changes an element or a group at most once, and never removes what the scene or the set
// still uses, so every set it builds is complete.

/** A random scene of up to `max` elements and 5 groups, as one `load` change set. */
export function anySceneLoad(random: Random, max: number): ChangeSet {
  const groups = anyGroups(random, 5);
  const groupIds = groups.map(({ id }) => id);
  const elements: Element[] = [];
  for (let index = 0, count = randomInt(random, 0, max); index < count; index += 1) {
    const refs = { elements: elements.map(({ id }) => id), groups: groupIds };
    elements.push(anySceneElement(random, sceneElementId(index), refs));
  }
  return {
    elements: elements.map((element) => ({ type: 'add', element })),
    groups: groups.map((group) => ({ type: 'add', group })),
    author: AUTHOR,
    seq: 0,
  };
}

/** One change set being built over a document. */
interface Draft {
  readonly random: Random;
  readonly document: DocumentState;
  /** Numbers for new identifiers. */
  readonly fresh: () => number;
  readonly elements: ElementChange[];
  readonly groups: GroupChange[];
  /** Elements and groups that a change of the set already changes or refers to. */
  readonly used: Set<string>;
  /** Elements and groups that the set removes. */
  readonly gone: Set<string>;
  readonly addedElements: ElementId[];
  readonly addedGroups: GroupId[];
}

/** The elements that the scene will hold once the set so far is applied. */
const liveElements = (draft: Draft): ElementId[] =>
  [...draft.document.elements.keys(), ...draft.addedElements].filter((id) => !draft.gone.has(id));

const liveGroups = (draft: Draft): GroupId[] =>
  [...draft.document.groups.keys(), ...draft.addedGroups].filter((id) => !draft.gone.has(id));

/** An existing element that the set does not touch yet. */
function untouched(draft: Draft): Element | undefined {
  const free = [...draft.document.elements.values()].filter(({ id }) => !draft.used.has(id));
  return free.length === 0 ? undefined : pick(draft.random, free);
}

type PatchOf = (draft: Draft, element: Element) => ElementPatch | undefined;

const PATCHES: readonly PatchOf[] = [
  ({ random }, { x }) => ({
    x: x + randomInt(random, -900, 900),
    y: randomBetween(random, -4_000, 4_000),
  }),
  ({ random }) => ({ order: anyOrderKey(random) }),
  ({ random }, { style }) => ({
    style: { ...style, opacity: random.next() },
    link: chance(random, 0.5) ? 'https://example.test/' : null,
  }),
  (draft) => {
    const groups = liveGroups(draft);
    return {
      group: groups.length > 0 && chance(draft.random, 0.7) ? pick(draft.random, groups) : null,
    };
  },
  ({ random }, element) =>
    'width' in element
      ? { width: randomInt(random, 0, 9_000), height: randomBetween(random, 0, 300) }
      : undefined,
  (draft, element) => {
    const targets = liveElements(draft).filter((id) => id !== element.id);
    if (element.kind !== 'arrow') return undefined;
    const target =
      targets.length > 0 && chance(draft.random, 0.7) ? pick(draft.random, targets) : undefined;
    return {
      end: target === undefined ? null : { target, anchor: { x: draft.random.next(), y: 1 } },
    };
  },
  ({ random }) => ({ rotation: chance(random, 0.5) ? 0 : randomBetween(random, 0, 6.28) }),
];

/** What a patch or an element refers to, so that the set removes none of it. */
function referencesOf(values: ElementPatch | Element): string[] {
  const { group, end, start } = values as Record<string, unknown>;
  const targets = [start, end].map((at) => (at as { target?: string } | null | undefined)?.target);
  return [group, ...targets].filter((id): id is string => typeof id === 'string');
}

function update(draft: Draft): void {
  const element = untouched(draft);
  const after = element === undefined ? undefined : pick(draft.random, PATCHES)(draft, element);
  if (element === undefined || after === undefined) return;
  const before = Object.fromEntries(
    Object.keys(after).map((key) => [key, patchValue(element, key)]),
  );
  draft.elements.push({ type: 'update', id: element.id, before, after });
  [element.id, ...referencesOf(after)].forEach((id) => draft.used.add(id));
}

function add(draft: Draft): void {
  const id = sceneElementId(draft.fresh());
  const refs = { elements: liveElements(draft), groups: liveGroups(draft) };
  const element = anySceneElement(draft.random, id, refs);
  draft.elements.push({ type: 'add', element });
  draft.addedElements.push(id);
  [id, ...referencesOf(element)].forEach((ref) => draft.used.add(ref));
}

/** Removes an element that nothing points at and that the set leaves alone so far. */
function remove(draft: Draft): void {
  const pointed = new Set([...draft.document.elements.values()].flatMap(referencesOf));
  const free = [...draft.document.elements.values()].filter(
    ({ id }) => !draft.used.has(id) && !pointed.has(id),
  );
  if (free.length === 0) return;
  const element = pick(draft.random, free);
  draft.elements.push({ type: 'remove', element });
  draft.used.add(element.id);
  draft.gone.add(element.id);
}

function addGroup(draft: Draft): void {
  const id = sceneGroupId(draft.fresh());
  const parents = liveGroups(draft);
  const parent =
    parents.length > 0 && chance(draft.random, 0.5) ? pick(draft.random, parents) : undefined;
  draft.groups.push({ type: 'add', group: parent === undefined ? { id } : { id, parent } });
  draft.addedGroups.push(id);
  [id, ...(parent === undefined ? [] : [parent])].forEach((ref) => draft.used.add(ref));
}

/** Removes a group with no members and no nested group, that the set does not use. */
function removeGroup(draft: Draft): void {
  const { elements, groups } = draft.document;
  const busy = new Set([
    ...[...elements.values()].map(({ group }) => group),
    ...[...groups.values()].map(({ parent }) => parent),
  ]);
  const free = [...groups.values()].filter(({ id }) => !busy.has(id) && !draft.used.has(id));
  if (free.length === 0) return;
  const group = pick(draft.random, free);
  draft.groups.push({ type: 'remove', group });
  draft.used.add(group.id);
  draft.gone.add(group.id);
}

const EDITS = [update, update, update, add, remove, addGroup, removeGroup];

/**
 * A random valid change set of one to four edits over `document`: element updates of every
 * field the scene indexes, additions, removals, and group additions and removals.
 */
export function anyEdit(random: Random, document: DocumentState, fresh: () => number): ChangeSet {
  const draft: Draft = {
    random,
    document,
    fresh,
    elements: [],
    groups: [],
    used: new Set(),
    gone: new Set(),
    addedElements: [],
    addedGroups: [],
  };
  for (let count = randomInt(random, 1, 4); count > 0; count -= 1) {
    pick(random, EDITS)(draft);
  }
  return { elements: draft.elements, groups: draft.groups, author: AUTHOR, seq: fresh() };
}

/**
 * A reference model of applying a valid change set to a document, written independently of the
 * store: additions keep their revision, an update raises it by one, and the document's rises.
 */
export function applyToDocument(document: DocumentState, changes: ChangeSet): DocumentState {
  const elements = new Map(document.elements);
  const groups = new Map(document.groups);
  for (const change of changes.elements) {
    if (change.type === 'add') elements.set(change.element.id, change.element);
    else if (change.type === 'remove') elements.delete(change.element.id);
    else {
      const current = elements.get(change.id);
      if (current === undefined) throw new Error('The reference model has no element to update.');
      elements.set(change.id, {
        ...applyPatch(current, change.after),
        rev: current.rev + 1,
      } as Element);
    }
  }
  for (const { type, group } of changes.groups) {
    if (type === 'add') groups.set(group.id, group);
    else groups.delete(group.id);
  }
  return {
    elements,
    groups,
    canvas: changes.canvas?.after ?? document.canvas,
    rev: document.rev + 1,
  };
}
