import { describe, expect, it } from 'vitest';

import type { HistoryEntry } from '../../../src/history/entry.ts';
import { randomInt } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import { jsonEqual } from '../../../src/model/json-equal.ts';
import { patchValue } from '../../../src/model/patch.ts';
import type { ChangeSet, ElementChange } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { anyEdit, anySceneLoad, applyToDocument } from '../../support/edits.ts';
import { recorder } from '../../support/histories.ts';
import type { Recorder } from '../../support/histories.ts';
import { checkProperty } from '../../support/property.ts';
import { changeSet, color, contentOf } from '../../support/scene-state.ts';
import { pick } from '../../support/scenes.ts';

// The properties of docs/architecture/engine/history.md#properties-the-tests-check, over random
// scenes and random transactions built with the seeded generators of the store's own properties.

const CANVAS = { background: color('#ffffff') };
const EMPTY: DocumentState = { elements: new Map(), groups: new Map(), canvas: CANVAS, rev: 0 };

/** One step of a session: the previews of one transaction, or a change set from another client. */
type Step = { readonly local: readonly ChangeSet[] } | { readonly remote: ChangeSet };

/** New values for fields that refer to nothing, which a remote set can change again at will. */
const FREE_FIELDS: Readonly<Record<string, (random: Random, element: Element) => unknown>> = {
  x: (random) => randomInt(random, -5_000, 5_000),
  y: (random) => randomInt(random, -5_000, 5_000),
  rotation: (random) => random.next() * 6,
  style: (random, element) => ({ ...element.style, opacity: random.next() }),
};

const isFree = (key: string): boolean => Object.hasOwn(FREE_FIELDS, key);

/** A remote set that changes again the free fields of an update that an earlier local set made. */
function anyConflict(random: Random, document: DocumentState, locals: readonly ChangeSet[]) {
  const updates = locals
    .flatMap(({ elements }) => elements)
    .filter(
      (change): change is Extract<ElementChange, { type: 'update' }> =>
        change.type === 'update' &&
        document.elements.has(change.id) &&
        Object.keys(change.after).some(isFree),
    );
  const choice = updates.length === 0 ? undefined : pick(random, updates);
  const element = choice === undefined ? undefined : document.elements.get(choice.id);
  if (choice === undefined || element === undefined) return undefined;
  const keys = Object.keys(choice.after).filter(isFree);
  return changeSet([
    {
      type: 'update',
      id: choice.id,
      before: Object.fromEntries(keys.map((key) => [key, patchValue(element, key)])),
      after: Object.fromEntries(keys.map((key) => [key, FREE_FIELDS[key]?.(random, element)])),
    },
  ]);
}

/**
 * A random scene and random steps, each built on the document the ones before leave: one to six
 * transactions, or with `remotes` up to eight steps, two in five of them remote sets, half of
 * which change again what an earlier local set changed.
 */
function anySession(random: Random, remotes: boolean) {
  const load = anySceneLoad(random, 20);
  let document = applyToDocument(EMPTY, load);
  let next = 1_000;
  const fresh = () => (next += 1);
  const locals: ChangeSet[] = [];
  const edit = (): ChangeSet => {
    const changes = anyEdit(random, document, fresh);
    document = applyToDocument(document, changes);
    return changes;
  };
  const local = (): ChangeSet => {
    const changes = edit();
    locals.push(changes);
    return changes;
  };
  const remote = (): ChangeSet => {
    const conflict = random.next() < 0.5 ? anyConflict(random, document, locals) : undefined;
    if (conflict === undefined) return edit();
    document = applyToDocument(document, conflict);
    return conflict;
  };
  const steps = Array.from({ length: randomInt(random, 1, remotes ? 8 : 6) }, (): Step =>
    remotes && random.next() < 0.4
      ? { remote: remote() }
      : { local: Array.from({ length: randomInt(random, 1, 4) }, local) },
  );
  return { load, steps };
}

function started(load: ChangeSet): Recorder {
  const store = createSceneStore(CANVAS);
  store.apply(load, 'load');
  return recorder(store);
}

/** Previews a step's sets in one transaction and commits it; the clock then moves on by `gap`. */
function commitStep(rec: Recorder, local: readonly ChangeSet[], gap: number, mergeKey?: string) {
  const transaction = rec.history.begin();
  for (const changes of local) transaction.preview(changes);
  const entry = transaction.commit('move', mergeKey === undefined ? {} : { mergeKey });
  rec.clock.advance(gap);
  return entry;
}

/** Each field whose value a set's updates change, as "id field", with its new value. */
const updatedFields = (changes: ChangeSet): (readonly [string, unknown])[] =>
  changes.elements.flatMap((change) =>
    change.type === 'update'
      ? Object.keys(change.after)
          .filter((key) => !jsonEqual(change.before[key], change.after[key]))
          .map((key) => [`${change.id} ${key}`, change.after[key]] as const)
      : [],
  );

/** The value of an "id field" in a document. */
function valueOf(document: DocumentState, field: string): unknown {
  const [id = '', key = ''] = field.split(' ');
  const element = [...document.elements.values()].find((candidate) => candidate.id === id);
  return element === undefined ? undefined : patchValue(element, key);
}

/** "id field" for each field of an element in both documents whose value differs between them. */
function changedFields(before: DocumentState, after: DocumentState): string[] {
  return [...before.elements].flatMap(([id, element]) => {
    const now = after.elements.get(id);
    if (now === undefined) return [];
    const keys = new Set(
      [...Object.keys(element), ...Object.keys(now)].filter((key) => key !== 'rev'),
    );
    return [...keys]
      .filter((key) => !jsonEqual(patchValue(element, key), patchValue(now, key)))
      .map((key) => `${id} ${key}`);
  });
}

describe('the history over random transactions', () => {
  it(
    'undo then redo restores the document, and undo alone restores the start',
    { timeout: 30_000 },
    () => {
      checkProperty(
        { seed: 4201, runs: 60 },
        (random) => anySession(random, false),
        ({ load, steps }) => {
          const rec = started(load);
          const documents = [contentOf(rec.store.document())];
          for (const step of steps) {
            if ('local' in step && commitStep(rec, step.local, 1) !== null) {
              documents.push(contentOf(rec.store.document()));
            }
          }
          for (const document of documents.slice(0, -1).reverse()) {
            expect(rec.history.undo()).not.toBeNull();
            expect(contentOf(rec.store.document())).toStrictEqual(document);
          }
          expect(rec.history.undo()).toBeNull();
          for (const document of documents.slice(1)) {
            expect(rec.history.redo()).not.toBeNull();
            expect(contentOf(rec.store.document())).toStrictEqual(document);
          }
          expect(rec.history.redo()).toBeNull();
        },
      );
    },
  );

  it(
    'merges a burst into at most one entry, whose undo and redo give its start and its end',
    { timeout: 30_000 },
    () => {
      checkProperty(
        { seed: 4202, runs: 60 },
        (random) => anySession(random, false),
        ({ load, steps }) => {
          const rec = started(load);
          const start = contentOf(rec.store.document());
          // Even five commits in a row that change nothing stay within one burst.
          for (const step of steps) if ('local' in step) commitStep(rec, step.local, 200, 'burst');
          const end = contentOf(rec.store.document());
          const undone = rec.history.undo();
          expect(contentOf(rec.store.document())).toStrictEqual(start);
          expect(rec.history.undo()).toBeNull();
          if (undone !== null) {
            expect(rec.history.redo()).not.toBeNull();
          }
          expect(contentOf(rec.store.document())).toStrictEqual(end);
        },
      );
    },
  );
});

/**
 * Runs the steps: each transaction is committed, and each remote set applied with its origin.
 * Returns, per entry time, the fields that the entry changed with the values it left, and the
 * fields that remote sets changed after it.
 */
function runSession(rec: Recorder, steps: readonly Step[]) {
  const own = new Map<number, ReadonlyMap<string, unknown>>();
  const guarded = new Map<number, Set<string>>();
  for (const step of steps) {
    if ('remote' in step) {
      rec.store.apply(step.remote, 'remote');
      const changed = updatedFields(step.remote).map(([field]) => field);
      for (const fields of guarded.values()) changed.forEach((field) => fields.add(field));
      continue;
    }
    const entry: HistoryEntry | null = commitStep(rec, step.local, 1);
    if (entry === null) continue;
    own.set(entry.time, new Map(updatedFields(entry.changes)));
    guarded.set(entry.time, new Set());
  }
  return { own, guarded };
}

describe('the history with remote change sets between its entries', () => {
  it(
    'REQ-K03 never lets undo change a field that a remote set changed after the entry',
    { timeout: 30_000 },
    () => {
      let conflicts = 0;
      checkProperty(
        { seed: 4203, runs: 80 },
        (random) => anySession(random, true),
        ({ load, steps }) => {
          const rec = started(load);
          const { own, guarded } = runSession(rec, steps);
          let before = rec.store.document();
          for (let entry = rec.history.undo(); entry !== null; entry = rec.history.undo()) {
            const after = rec.store.document();
            const kept = guarded.get(entry.time) ?? new Set<string>();
            const left = own.get(entry.time) ?? new Map<string, unknown>();
            conflicts += [...left.keys()].filter((field) => kept.has(field)).length;
            // A remote set that put back the very value the entry left cannot be told apart by
            // value (history.md, conflict-safe undo): only that case may be undone.
            const overwritten = changedFields(before, after).filter(
              (field) => kept.has(field) && !jsonEqual(valueOf(before, field), left.get(field)),
            );
            expect(overwritten).toStrictEqual([]);
            before = after;
          }
        },
      );
      expect(conflicts).toBeGreaterThan(30);
    },
  );
});
