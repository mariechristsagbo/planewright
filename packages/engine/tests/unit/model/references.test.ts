import { describe, expect, it } from 'vitest';

import type { CodecError } from '../../../src/model/codec.ts';
import type { GroupRecord } from '../../../src/model/document.ts';
import type { Element } from '../../../src/model/elements.ts';
import { checkReferences } from '../../../src/model/references.ts';
import { elementId, fixtureJson, groupId } from '../../support/fixtures.ts';

interface Parts {
  groups: Record<string, unknown>[];
  elements: Record<string, unknown>[];
}

/** The fixture's groups and elements after `change`, and the errors that the check reports. */
function errorsAfter(change: (parts: Parts) => void): CodecError[] {
  const parts = fixtureJson() as unknown as Parts;
  change(parts);
  const issues: CodecError[] = [];
  checkReferences(
    parts as unknown as { groups: readonly GroupRecord[]; elements: readonly Element[] },
    issues,
  );
  return issues;
}

const at = <T>(items: readonly T[], index: number): T => items[index] as T;

describe('checkReferences', () => {
  it('accepts groups, parents and attachments that exist', () => {
    expect(errorsAfter(() => undefined)).toEqual([]);
  });

  it('REQ-K02 refuses an element or group identifier used twice, at its second use', () => {
    expect(
      errorsAfter(({ elements }) => {
        at(elements, 3)['id'] = elementId(0);
      }),
    ).toStrictEqual([{ path: 'elements[3].id', problem: 'duplicate-id' }]);
    expect(
      errorsAfter(({ groups }) => {
        groups.push({ id: groupId(1) });
      }),
    ).toStrictEqual([{ path: 'groups[2].id', problem: 'duplicate-id' }]);
  });

  it('refuses a parent, a group or a target that does not exist', () => {
    expect(
      errorsAfter(({ groups, elements }) => {
        at(groups, 1)['parent'] = groupId(7);
        at(elements, 1)['group'] = groupId(8);
        at(elements, 6)['start'] = { target: elementId(42), anchor: { x: 0, y: 0 } };
        at(elements, 6)['end'] = { target: elementId(43), anchor: { x: 0, y: 0 } };
      }),
    ).toStrictEqual([
      { path: 'groups[1].parent', problem: 'unknown-reference' },
      { path: 'elements[1].group', problem: 'unknown-reference' },
      { path: 'elements[6].start.target', problem: 'unknown-reference' },
      { path: 'elements[6].end.target', problem: 'unknown-reference' },
    ]);
  });

  it('refuses a group that is its own parent', () => {
    expect(
      errorsAfter(({ groups }) => {
        at(groups, 0)['parent'] = groupId(0);
      }),
    ).toStrictEqual([{ path: 'groups[0].parent', problem: 'group-cycle' }]);
  });

  it('refuses every group on a longer cycle, but not a group that only leads into it', () => {
    expect(
      errorsAfter(({ groups }) => {
        at(groups, 0)['parent'] = groupId(2);
        groups.push({ id: groupId(2), parent: groupId(1) }, { id: groupId(3), parent: groupId(2) });
      }),
    ).toStrictEqual([
      { path: 'groups[0].parent', problem: 'group-cycle' },
      { path: 'groups[1].parent', problem: 'group-cycle' },
      { path: 'groups[2].parent', problem: 'group-cycle' },
    ]);
  });

  it('accepts a deep chain of groups', () => {
    expect(
      errorsAfter(({ groups }) => {
        for (let index = 2; index < 1_000; index += 1) {
          groups.push({ id: groupId(index), parent: groupId(index - 1) });
        }
      }),
    ).toEqual([]);
  });
});
