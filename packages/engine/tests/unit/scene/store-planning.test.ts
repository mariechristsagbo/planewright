import { describe, expect, it } from 'vitest';

import { createRandom } from '../../../src/math/random.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { ChangeSetError } from '../../../src/scene/store.ts';
import {
  PATHS,
  PLANNING_REFUSAL,
  expectRefusedForPlanning,
  moveLine,
  readingStyle,
  refusedPlain,
  thrownBy,
  watched,
} from '../../support/planning-sets.ts';
import { AUTHOR } from '../../support/scene-state.ts';
import {
  expectIndexesAgree,
  expectNoneWritten,
  expectUnchanged,
} from '../../support/store-model.ts';
import { edit, fixtureId, fixtureStore, present } from '../../support/stores.ts';

// A change set with a value that runs code while the store plans it (issue 45). No change set holds
// one (ADR 0010 §2), and nothing decoded from JSON can; these tests show that such code neither
// changes what planning the set reports nor applies a set to the store that plans it.

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

describe('the scene store, planning a set whose value applies a set to the same store', () => {
  it.each(PATHS)(
    'refuses that apply for %s, and the set as it refuses the plain one',
    (_, setOf) => {
      const { store, held, told } = watched();
      const refusals: unknown[] = [];
      const style = readingStyle(
        present(store, 2).style,
        () => {
          refusals.push(
            thrownBy(() => {
              moveLine(store);
            }),
          );
        },
        true,
      );
      const thrown = thrownBy(() => {
        store.apply(setOf(store, style), 'local');
      });
      expect(thrown).toBeInstanceOf(ChangeSetError);
      expect((thrown as ChangeSetError).errors).toStrictEqual(refusedPlain(setOf));
      expectRefusedForPlanning(refusals);
      expectUnchanged(store, held);
      expectNoneWritten(held);
      const changed = [fixtureId(2), fixtureId(3)];
      expectIndexesAgree(store, held.document, { random: createRandom(45), changed });
      expect(told).toStrictEqual([]);
    },
  );

  it.each(PATHS)('refuses that apply for %s of a valid style, then applies the set', (_, setOf) => {
    const { store, told } = watched();
    const plain = fixtureStore();
    plain.apply(setOf(plain, present(plain, 2).style), 'local');
    const refusals: unknown[] = [];
    const style = readingStyle(
      present(store, 2).style,
      () => {
        refusals.push(
          thrownBy(() => {
            moveLine(store);
          }),
        );
      },
      false,
    );
    store.apply(setOf(store, style), 'local');
    expectRefusedForPlanning(refusals);
    expect(store.document()).toStrictEqual(plain.document());
    expect(told.map(({ rev }) => rev)).toStrictEqual([2]);
  });

  it.each(PATHS)('fails %s and changes nothing when the refusal leaves the getter', (_, setOf) => {
    const { store, held, told } = watched();
    const style = readingStyle(
      present(store, 2).style,
      () => {
        moveLine(store);
      },
      false,
    );
    expect(() => {
      store.apply(setOf(store, style), 'local');
    }).toThrow(PLANNING_REFUSAL);
    expectUnchanged(store, held);
    expect(told).toStrictEqual([]);
    moveLine(store);
    expect([store.rev, present(store, 3).x, told.length]).toStrictEqual([2, 301, 1]);
  });
});

describe('the planning guard of the scene store', () => {
  it('is lifted after a getter throws while the store plans, and refuses again in the next plan', () => {
    const { store, told } = watched();
    const failure = new Error('a getter failed');
    const failing = readingStyle(
      present(store, 2).style,
      () => {
        throw failure;
      },
      false,
    );
    expect(
      thrownBy(() => {
        store.apply(edit(store, 2, { style: failing }), 'local');
      }),
    ).toBe(failure);
    moveLine(store);
    expect([store.rev, told.length]).toStrictEqual([2, 1]);
    const refusals: unknown[] = [];
    const reading = readingStyle(
      present(store, 2).style,
      () => {
        refusals.push(
          thrownBy(() => {
            moveLine(store);
          }),
        );
      },
      false,
    );
    store.apply(edit(store, 2, { style: reading }), 'local');
    expectRefusedForPlanning(refusals);
    expect([store.rev, told.length]).toStrictEqual([3, 2]);
  });

  it('is lifted after a set that the planner cannot read, and after a refused set', () => {
    const { store } = watched();
    const unreadable = {
      elements: null,
      groups: [],
      author: AUTHOR,
      seq: 1,
    } as unknown as ChangeSet;
    expect(() => {
      store.apply(unreadable, 'local');
    }).toThrow(TypeError);
    moveLine(store);
    expect(() => {
      store.apply(edit(store, 2, { x: Number.NaN }), 'local');
    }).toThrow(ChangeSetError);
    moveLine(store);
    expect([store.rev, present(store, 3).x]).toStrictEqual([3, 302]);
  });

  it('is lifted before the listeners are told, whose own applies are refused as before', () => {
    const { store } = watched();
    const refusals: unknown[] = [];
    store.subscribe(() => {
      refusals.push(
        thrownBy(() => {
          moveLine(store);
        }),
      );
    });
    store.apply(edit(store, 2, { x: 5 }), 'local');
    expect(refusals).toHaveLength(1);
    expect((refusals[0] as Error).message).toBe(
      'A scene update listener cannot apply a change set while it is notified.',
    );
    expect([store.rev, present(store, 3).x]).toStrictEqual([2, 300]);
  });
});
