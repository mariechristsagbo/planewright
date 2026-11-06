import { describe, expect, it } from 'vitest';

import { decodeDocument } from '../../../src/model/decode.ts';
import { changed, elementId, groupId } from '../../support/fixtures.ts';
import { expectRefused } from '../../support/refusals.ts';
import type { Refusal } from '../../support/refusals.ts';

// Each limit and invariant of the domain model, broken once in the valid fixture: the decoder must
// return exactly one error with the path of the broken value, and no document at all (REQ-P07).
// Fixture elements: 0 rectangle, 1 ellipse, 2 diamond, 3 line, 4 freehand, 5 text, 6 arrow,
// 7 note, 8 image, 9 frame.

describe('identifiers, keys and colours', () => {
  it.each<Refusal>([
    ['a short element identifier', ['elements', 0, 'id'], 'E1', 'elements[0].id', 'malformed-id'],
    [
      'an identifier with +',
      ['elements', 0, 'id'],
      'E00000000000000000000+',
      'elements[0].id',
      'malformed-id',
    ],
    ['a numeric identifier', ['elements', 0, 'id'], 42, 'elements[0].id', 'not-string'],
    ['a short group identifier', ['groups', 0, 'id'], 'G0', 'groups[0].id', 'malformed-id'],
    ['a malformed parent', ['groups', 1, 'parent'], 'G0', 'groups[1].parent', 'malformed-id'],
    [
      'a malformed element group',
      ['elements', 0, 'group'],
      'G',
      'elements[0].group',
      'malformed-id',
    ],
    [
      'a malformed target',
      ['elements', 6, 'start', 'target'],
      'E',
      'elements[6].start.target',
      'malformed-id',
    ],
    [
      'an upper-case file',
      ['elements', 8, 'file'],
      'AB'.repeat(32),
      'elements[8].file',
      'malformed-file-id',
    ],
    [
      'a short file',
      ['elements', 8, 'file'],
      'ab'.repeat(31),
      'elements[8].file',
      'malformed-file-id',
    ],
    [
      'a key ending with 0',
      ['elements', 0, 'order'],
      'V0',
      'elements[0].order',
      'malformed-order-key',
    ],
    ['an empty key', ['elements', 0, 'order'], '', 'elements[0].order', 'malformed-order-key'],
    [
      'a key with a hyphen',
      ['elements', 0, 'order'],
      'a-',
      'elements[0].order',
      'malformed-order-key',
    ],
    [
      'an upper-case background',
      ['canvas', 'background'],
      '#FFFFFF',
      'canvas.background',
      'malformed-color',
    ],
    [
      'a short background',
      ['canvas', 'background'],
      '#fff',
      'canvas.background',
      'malformed-color',
    ],
    [
      'a stroke colour of 5 digits',
      ['elements', 0, 'style', 'stroke', 'color'],
      '#12345',
      'elements[0].style.stroke.color',
      'malformed-color',
    ],
    [
      'a named fill colour',
      ['elements', 0, 'style', 'fill', 'color'],
      'red',
      'elements[0].style.fill.color',
      'malformed-color',
    ],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });
});

describe('identifiers that must be unique or exist', () => {
  it.each<Refusal>([
    [
      'a duplicate element identifier',
      ['elements', 3, 'id'],
      elementId(0),
      'elements[3].id',
      'duplicate-id',
    ],
    [
      'a duplicate group identifier',
      ['groups', 2],
      { id: groupId(0) },
      'groups[2].id',
      'duplicate-id',
    ],
    [
      'an unknown parent',
      ['groups', 1, 'parent'],
      groupId(5),
      'groups[1].parent',
      'unknown-reference',
    ],
    [
      'an unknown element group',
      ['elements', 0, 'group'],
      groupId(5),
      'elements[0].group',
      'unknown-reference',
    ],
    [
      'an unknown start target',
      ['elements', 6, 'start', 'target'],
      elementId(42),
      'elements[6].start.target',
      'unknown-reference',
    ],
    [
      'an unknown end target',
      ['elements', 6, 'end', 'target'],
      elementId(42),
      'elements[6].end.target',
      'unknown-reference',
    ],
    [
      'an arrow starting on itself',
      ['elements', 6, 'start', 'target'],
      elementId(6),
      'elements[6].start.target',
      'self-reference',
    ],
    [
      'an arrow ending on itself',
      ['elements', 6, 'end', 'target'],
      elementId(6),
      'elements[6].end.target',
      'self-reference',
    ],
    [
      'a group that is its own parent',
      ['groups', 0, 'parent'],
      groupId(0),
      'groups[0].parent',
      'group-cycle',
    ],
  ])('refuses %s', (...row) => {
    expectRefused(row);
  });

  it('refuses both groups of a cycle of two', () => {
    expect(decodeDocument(changed(['groups', 0, 'parent'], groupId(1)))).toStrictEqual({
      ok: false,
      errors: [
        { path: 'groups[0].parent', problem: 'group-cycle' },
        { path: 'groups[1].parent', problem: 'group-cycle' },
      ],
    });
  });
});
