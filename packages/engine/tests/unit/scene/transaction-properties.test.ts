import { describe, expect, it } from 'vitest';

import type { Random } from '../../../src/math/random.ts';
import type { DocumentState } from '../../../src/model/document.ts';
import { invertChangeSet } from '../../../src/scene/change-set.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import type { SceneUpdate } from '../../../src/scene/store.ts';
import { openTransaction } from '../../../src/scene/transaction.ts';
import { anyEdit, anySceneLoad, applyToDocument } from '../../support/edits.ts';
import { checkProperty } from '../../support/property.ts';
import { AUTHOR, color, contentOf } from '../../support/scene-state.ts';

const CANVAS = { background: color('#ffffff') };
const EMPTY: DocumentState = { elements: new Map(), groups: new Map(), canvas: CANVAS, rev: 0 };
const STAMP = { author: AUTHOR, seq: 9_999 };

/** A random scene, then one to six random previews over it, each built on the one before. */
function anyRun(random: Random): { readonly load: ChangeSet; readonly previews: ChangeSet[] } {
  const load = anySceneLoad(random, 20);
  let document = applyToDocument(EMPTY, load);
  let next = 1_000;
  const fresh = () => (next += 1);
  const previews = Array.from({ length: 1 + Math.floor(random.next() * 6) }, () => {
    const changes = anyEdit(random, document, fresh);
    document = applyToDocument(document, changes);
    return changes;
  });
  return { load, previews };
}

function previewed({ load, previews }: ReturnType<typeof anyRun>) {
  const store = createSceneStore(CANVAS);
  store.apply(load, 'load');
  const start = contentOf(store.document());
  const transaction = openTransaction(store);
  for (const changes of previews) transaction.preview(changes);
  return { store, transaction, start, end: contentOf(store.document()) };
}

describe('transactions over random previews', () => {
  it('leave the document equal to its start when cancelled', { timeout: 30_000 }, () => {
    checkProperty({ seed: 3701, runs: 60 }, anyRun, (run) => {
      const { store, transaction, start } = previewed(run);
      transaction.cancel();
      expect(contentOf(store.document())).toStrictEqual(start);
    });
  });

  it(
    'revert their previews when committed, then apply one net set that inverts exactly',
    { timeout: 30_000 },
    () => {
      checkProperty({ seed: 3702, runs: 60 }, anyRun, (run) => {
        const { store, transaction, start, end } = previewed(run);
        const seen: {
          readonly update: SceneUpdate;
          readonly content: ReturnType<typeof contentOf>;
        }[] = [];
        store.subscribe((update) => {
          seen.push({ update, content: contentOf(store.document()) });
        });
        const net = transaction.commit(STAMP);
        expect(contentOf(store.document())).toStrictEqual(end);
        if (net === null) {
          expect(end).toStrictEqual(start);
          expect(seen).toStrictEqual([]);
          return;
        }
        expect(seen.map(({ update }) => [update.origin, update.transient])).toStrictEqual([
          ['local', true],
          ['local', false],
        ]);
        expect(seen.map(({ content }) => content)).toStrictEqual([start, end]);
        expect(seen[1]?.update.changes).toBe(net);
        store.apply(invertChangeSet(net), 'local');
        expect(contentOf(store.document())).toStrictEqual(start);
        store.apply(net, 'local');
        expect(contentOf(store.document())).toStrictEqual(end);
      });
    },
  );
});
