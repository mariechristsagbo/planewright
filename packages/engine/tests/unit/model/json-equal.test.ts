import { describe, expect, it } from 'vitest';

import { jsonEqual } from '../../../src/model/json-equal.ts';
import { anyDocument } from '../../support/documents.ts';
import { checkProperty } from '../../support/property.ts';

describe('jsonEqual', () => {
  it.each([
    ['equal numbers', 2, 2],
    ['zero and minus zero, which JSON writes alike', 0, -0],
    ['equal strings', 'a', 'a'],
    ['equal booleans', false, false],
    ['null and null', null, null],
    ['equal arrays', [1, [2, { a: 3 }]], [1, [2, { a: 3 }]]],
    ['empty arrays', [], []],
    ['objects with their keys in another order', { a: 1, b: { c: [2] } }, { b: { c: [2] }, a: 1 }],
    ['empty objects', {}, {}],
  ])('holds for %s', (_, a, b) => {
    expect(jsonEqual(a, b)).toBe(true);
    expect(jsonEqual(b, a)).toBe(true);
  });

  it.each([
    ['different numbers', 1, 2],
    ['a number and its string', 1, '1'],
    ['null and an empty object', null, {}],
    ['null and false', null, false],
    ['null and an absent value', null, undefined],
    ['an array and an object with index keys', [1], { 0: 1 }],
    ['arrays of different lengths', [1, 2], [1, 2, 3]],
    ['arrays with one item changed', [1, { a: 2 }], [1, { a: 3 }]],
    ['objects with one value changed', { a: 1, b: 2 }, { a: 1, b: 3 }],
    ['an object with an extra key', { a: 1 }, { a: 1, b: 2 }],
    ['objects with the same number of different keys', { a: 1 }, { b: 1 }],
    ['an object with an own __proto__ key', JSON.parse('{"__proto__":1}') as unknown, {}],
  ])('fails for %s', (_, a, b) => {
    expect(jsonEqual(a, b)).toBe(false);
    expect(jsonEqual(b, a)).toBe(false);
  });

  it('holds between a document and its JSON round trip, element by element', () => {
    checkProperty({ seed: 3001 }, anyDocument, (document) => {
      for (const element of document.elements.values()) {
        expect(jsonEqual(element, JSON.parse(JSON.stringify(element)))).toBe(true);
      }
    });
  });
});
