import { describe, expect, expectTypeOf, it } from 'vitest';

import { randomInt } from '../../../src/math/random.ts';
import {
  isClientId,
  isElementId,
  isFileId,
  isGroupId,
  newClientId,
  newElementId,
  newGroupId,
} from '../../../src/model/ids.ts';
import type { ClientId, ElementId, FileId, GroupId } from '../../../src/model/ids.ts';
import { createCountingIds } from '../../support/fakes.ts';
import { randomText } from '../../support/generators.ts';
import { checkProperty } from '../../support/property.ts';

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const HEX = '0123456789abcdef';

describe('element, group and client identifiers', () => {
  it.each([
    'pW3xK9vT2mQe7LhR0aZc5Q',
    '0000000000000000000001',
    '-_-_-_-_-_-_-_-_-_-_-_',
    'zzzzzzzzzzzzzzzzzzzzzz',
  ])('REQ-K02 accepts the 22 base64url characters of %s', (text) => {
    expect(isElementId(text)).toBe(true);
    expect(isGroupId(text)).toBe(true);
    expect(isClientId(text)).toBe(true);
  });

  it.each([
    ['21 characters', 'pW3xK9vT2mQe7LhR0aZc5'],
    ['23 characters', 'pW3xK9vT2mQe7LhR0aZc5QA'],
    ['a + of standard base64', 'pW3xK9vT2mQe7LhR0aZc5+'],
    ['a / of standard base64', 'pW3xK9vT2mQe7LhR0aZc5/'],
    ['base64 padding', 'pW3xK9vT2mQe7LhR0aZc=='],
    ['a trailing line break', 'pW3xK9vT2mQe7LhR0aZc5Q\n'],
    ['a space', 'pW3xK9vT2mQe7LhR0aZc Q'],
    ['a letter outside ASCII', 'pW3xK9vT2mQe7LhR0aZc5é'],
    ['the empty string', ''],
  ])('refuses %s', (_, text) => {
    expect(isElementId(text)).toBe(false);
    expect(isGroupId(text)).toBe(false);
    expect(isClientId(text)).toBe(false);
  });

  it('accepts a generated base64url string exactly when it has 22 characters', () => {
    checkProperty(
      { seed: 0x1d5 },
      (random) => randomText(random, BASE64URL, randomInt(random, 0, 30)),
      (text) => {
        expect(isElementId(text)).toBe(text.length === 22);
      },
    );
  });

  it('refuses 22 characters as soon as one is outside base64url', () => {
    checkProperty(
      { seed: 0x1d6 },
      (random) => {
        const text = randomText(random, BASE64URL, 22);
        const at = randomInt(random, 0, 21);
        const outside = randomText(random, '+/=.~ !#$%&*:;é\u0000\t', 1);
        return `${text.slice(0, at)}${outside}${text.slice(at + 1)}`;
      },
      (text) => {
        expect(isElementId(text)).toBe(false);
      },
    );
  });
});

describe('file identifiers', () => {
  it.each(['a'.repeat(64), HEX.repeat(4)])(
    'accept 64 lower-case hexadecimal characters, a SHA-256 digest: %s',
    (text) => {
      expect(isFileId(text)).toBe(true);
    },
  );

  it.each([
    ['upper case', HEX.toUpperCase().repeat(4)],
    ['63 characters', 'a'.repeat(63)],
    ['65 characters', 'a'.repeat(65)],
    ['a letter beyond f', `${'a'.repeat(63)}g`],
    ['an element identifier', 'pW3xK9vT2mQe7LhR0aZc5Q'],
  ])('refuse %s', (_, text) => {
    expect(isFileId(text)).toBe(false);
  });
});

describe('new identifiers', () => {
  it('REQ-K02 come from the IdSource port, one per call', () => {
    const ids = createCountingIds();
    expect(newElementId(ids)).toBe('0000000000000000000001');
    expect(newGroupId(ids)).toBe('0000000000000000000002');
    expect(newClientId(ids)).toBe('0000000000000000000003');
  });

  it.each([
    ['an element', newElementId],
    ['a group', newGroupId],
    ['a client', newClientId],
  ])('fail fast when the source returns a malformed identifier for %s', (_, create) => {
    const source = { next: () => 'not an identifier' };
    expect(() => create(source)).toThrow(
      new RangeError(
        'The identifier source returned "not an identifier", not 22 base64url characters.',
      ),
    );
  });
});

describe('identifier types', () => {
  it('keep plain strings and the other identifier kinds apart', () => {
    expectTypeOf<ElementId>().toExtend<string>();
    expectTypeOf<string>().not.toExtend<ElementId>();
    expectTypeOf<ElementId>().not.toExtend<GroupId>();
    expectTypeOf<GroupId>().not.toExtend<ClientId>();
    expectTypeOf<ClientId>().not.toExtend<ElementId>();
    expectTypeOf<FileId>().not.toExtend<ElementId>();
  });

  it.each(['pW3xK9vT2mQe7LhR0aZc5Q'])('narrow a checked string such as %s', (text) => {
    expect(isElementId(text)).toBe(true);
    if (isElementId(text)) {
      expectTypeOf(text).toEqualTypeOf<ElementId>();
    }
    if (isFileId(text)) {
      expectTypeOf(text).toEqualTypeOf<FileId>();
    }
  });
});
