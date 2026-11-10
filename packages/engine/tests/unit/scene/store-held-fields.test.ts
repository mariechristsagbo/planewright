import { describe, expect, it } from 'vitest';

import { edit, fixtureStore, present } from '../../support/stores.ts';

// An update of fields that its element holds (issue 36): the store's next version of the element
// is a new object that shares every field the update leaves with the version before it, which the
// store checked when it took it, and holds its own copy of every value that the update writes.

describe('the scene store, updating fields that an element holds', () => {
  it('shares the fields that the update leaves with the previous version', () => {
    const store = fixtureStore();
    const before = present(store, 4);
    const style = { ...before.style, opacity: 0.25 };
    store.apply(edit(store, 4, { x: 9, style }), 'local');
    const after = present(store, 4);
    if (after.kind !== 'freehand' || before.kind !== 'freehand') throw new Error('A freehand.');
    expect(after).not.toBe(before);
    expect(after.points).toBe(before.points);
    expect(after.pressures).toBe(before.pressures);
    expect(after.style).toStrictEqual(style);
    expect(after.style).not.toBe(style);
    expect(after.style.stroke).not.toBe(style.stroke);
    expect({ x: after.x, rev: after.rev }).toStrictEqual({ x: 9, rev: before.rev + 1 });
  });

  it('shares them after a move of an arrow too, and keeps it attached', () => {
    const store = fixtureStore();
    const before = present(store, 6);
    store.apply(edit(store, 6, { x: 3, y: 4 }), 'local');
    const after = present(store, 6);
    if (after.kind !== 'arrow' || before.kind !== 'arrow') throw new Error('An arrow.');
    expect([after.points, after.start, after.end, after.label, after.style]).toStrictEqual([
      before.points,
      before.start,
      before.end,
      before.label,
      before.style,
    ]);
    expect(after.start).toBe(before.start);
    expect(after.label).toBe(before.label);
    expect(store.connectorsOf(before.start?.target ?? before.id)).toContain(before.id);
  });
});
