import { describe, expect, it } from 'vitest';

import type { Color } from '../../../src/model/color.ts';
import type { GroupRecord } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import type { ClientId, ElementId, GroupId } from '../../../src/model/ids.ts';
import { invertChangeSet } from '../../../src/scene/change-set.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';

const element = (index: number): Element => {
  const found = fixtureDocument().elements.get(elementId(index) as ElementId);
  if (found === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return found;
};

const group: GroupRecord = { id: groupId(5) as GroupId, parent: groupId(0) as GroupId };

/** A change set with every kind of change. */
const everyKind = (): ChangeSet => ({
  elements: [
    { type: 'add', element: element(2) },
    { type: 'remove', element: element(3) },
    {
      type: 'update',
      id: element(0).id,
      before: { x: 0, link: 'https://example.test/a' },
      after: { x: 9, link: null },
    },
  ],
  groups: [
    { type: 'add', group },
    { type: 'remove', group: { id: groupId(1) as GroupId, parent: groupId(0) as GroupId } },
  ],
  canvas: { before: { background: '#ffffff' as Color }, after: { background: '#000000' as Color } },
  author: 'C'.repeat(22) as ClientId,
  seq: 7,
});

describe('invertChangeSet', () => {
  it('swaps additions and removals, and before and after, and keeps the stamp', () => {
    expect(invertChangeSet(everyKind())).toStrictEqual({
      elements: [
        { type: 'remove', element: element(2) },
        { type: 'add', element: element(3) },
        {
          type: 'update',
          id: element(0).id,
          before: { x: 9, link: null },
          after: { x: 0, link: 'https://example.test/a' },
        },
      ],
      groups: [
        { type: 'remove', group },
        { type: 'add', group: { id: groupId(1), parent: groupId(0) } },
      ],
      canvas: { before: { background: '#000000' }, after: { background: '#ffffff' } },
      author: 'C'.repeat(22),
      seq: 7,
    });
  });

  it('gives back the change set when applied twice, and leaves its input as it was', () => {
    const changes = everyKind();
    const copy = JSON.parse(JSON.stringify(changes)) as unknown;
    expect(invertChangeSet(invertChangeSet(changes))).toStrictEqual(changes);
    expect(changes).toStrictEqual(copy);
  });

  it('writes no canvas change for a set without one', () => {
    const { elements, groups, author, seq } = everyKind();
    expect(Object.hasOwn(invertChangeSet({ elements, groups, author, seq }), 'canvas')).toBe(false);
  });

  it('is plain data that a JSON round trip keeps, null fields included', () => {
    const changes = everyKind();
    expect(JSON.parse(JSON.stringify(changes))).toStrictEqual(changes);
    expect(JSON.parse(JSON.stringify(invertChangeSet(changes)))).toStrictEqual(
      invertChangeSet(changes),
    );
  });
});
