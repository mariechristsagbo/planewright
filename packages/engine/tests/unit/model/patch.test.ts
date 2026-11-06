import { describe, expect, it } from 'vitest';

import type { CodecError } from '../../../src/model/codec.ts';
import type { Element } from '../../../src/model/elements.ts';
import { INVALID } from '../../../src/model/json-check.ts';
import {
  UNPATCHED_FIELDS,
  applyPatch,
  matchesPatch,
  patchElement,
  patchValue,
} from '../../../src/model/patch.ts';
import type { ElementPatch } from '../../../src/model/patch.ts';
import { elementId, fixtureDocument, groupId } from '../../support/fixtures.ts';

/** The fixture's element at `index`: 0 is a labelled rectangle in a group with a link. */
const fixtureElement = (index: number): Element => {
  const element = fixtureDocument().elements.get(elementId(index) as Element['id']);
  if (element === undefined) throw new Error(`The fixture has no element ${String(index)}.`);
  return element;
};

/** A deep copy made through JSON, as a patch read from a file would be. */
const copyOf = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The patched element, or the errors that refused it. */
function patched(element: Element, patch: ElementPatch): Element | CodecError[] {
  const issues: CodecError[] = [];
  const result = patchElement(element, patch, 'after', issues);
  return result === INVALID ? issues : result;
}

describe('patchValue', () => {
  it('reads a field, or null when the element does not have it', () => {
    const rectangle = fixtureElement(0);
    expect(patchValue(rectangle, 'x')).toBe(0);
    expect(patchValue(rectangle, 'link')).toBe('https://example.test/a');
    expect(patchValue(fixtureElement(2), 'link')).toBeNull();
    expect(patchValue(rectangle, '__proto__')).toBeNull();
  });
});

describe('matchesPatch', () => {
  it('holds when every field of the patch has its current value', () => {
    const rectangle = fixtureElement(0);
    expect(matchesPatch(rectangle, {})).toBe(true);
    expect(matchesPatch(rectangle, { x: 0, y: 0, width: 120 })).toBe(true);
    expect(matchesPatch(rectangle, { style: copyOf(rectangle.style) })).toBe(true);
  });

  it('reads null as a field that is absent', () => {
    expect(matchesPatch(fixtureElement(2), { link: null, group: null, label: null })).toBe(true);
    expect(matchesPatch(fixtureElement(0), { link: null })).toBe(false);
  });

  it('fails on any other value, and on undefined, which is never written for an absent field', () => {
    const rectangle = fixtureElement(0);
    expect(matchesPatch(rectangle, { x: 1 })).toBe(false);
    expect(matchesPatch(rectangle, { x: 0, width: 121 })).toBe(false);
    expect(matchesPatch(fixtureElement(2), { link: undefined })).toBe(false);
  });
});

describe('applyPatch', () => {
  it('sets each field of the patch and removes the fields that it sets to null', () => {
    const result = applyPatch(fixtureElement(0), { x: 5, link: null, group: null });
    expect(result['x']).toBe(5);
    expect(Object.hasOwn(result, 'link')).toBe(false);
    expect(Object.hasOwn(result, 'group')).toBe(false);
    expect(result['width']).toBe(120);
  });

  it('keeps an own __proto__ field as data and never changes the prototype', () => {
    const result = applyPatch(
      fixtureElement(2),
      JSON.parse('{"__proto__":{"x":7}}') as ElementPatch,
    );
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, '__proto__')).toBe(true);
  });

  it('leaves the element as it was', () => {
    const rectangle = fixtureElement(0);
    const copy = copyOf(rectangle);
    applyPatch(rectangle, { x: 5, link: null });
    expect(rectangle).toStrictEqual(copy);
  });
});

describe('patchElement', () => {
  it('returns the patched element, checked like any decoded element', () => {
    const result = patched(fixtureElement(0), {
      x: -40,
      link: null,
      style: fixtureElement(3).style,
    });
    expect(result).toMatchObject({ x: -40, style: fixtureElement(3).style, rev: 3 });
    expect(Object.hasOwn(result, 'link')).toBe(false);
  });

  it.each([
    [0, ['group', 'link', 'label']],
    [4, ['pressures']],
    [6, ['start', 'end', 'label', 'link']],
    [8, ['crop']],
  ])('removes the optional fields that the patch sets to null: element %i, %j', (index, fields) => {
    const element = fixtureElement(index);
    const result = patched(element, Object.fromEntries(fields.map((field) => [field, null])));
    expect(Object.keys(result).sort()).toStrictEqual(
      Object.keys(element)
        .filter((key) => !fields.includes(key))
        .sort(),
    );
  });

  it.each(UNPATCHED_FIELDS)('refuses a patch that holds %s, which no patch changes', (key) => {
    expect(patched(fixtureElement(0), { [key]: fixtureElement(0)[key], x: 1 })).toStrictEqual([
      { path: `after.${key}`, problem: 'unknown-field' },
    ]);
  });

  it.each([
    ['a value out of range', { x: Number.NaN }, 'after.x', 'not-finite'],
    ['a field of another kind', { points: [] }, 'after.points', 'unknown-field'],
    ['null for a field that is required', { width: null }, 'after.width', 'missing'],
    ['undefined, which JSON would drop', { link: undefined }, 'after.link', 'not-string'],
    ['an unsafe link', { link: 'javascript:alert(1)' }, 'after.link', 'unsafe-link'],
    ['a malformed group identifier', { group: 'g' }, 'after.group', 'malformed-id'],
    [
      'an own __proto__ field',
      JSON.parse('{"__proto__":1}') as ElementPatch,
      'after.__proto__',
      'unknown-field',
    ],
  ])('refuses %s with its path', (_, patch, path, problem) => {
    expect(patched(fixtureElement(0), patch)).toStrictEqual([{ path, problem }]);
  });

  it('applies the per-kind rules that span fields', () => {
    expect(patched(fixtureElement(4), { pressures: [1] })).toStrictEqual([
      { path: 'after.pressures', problem: 'length-mismatch' },
    ]);
    expect(
      patched(fixtureElement(6), { end: { target: elementId(6), anchor: { x: 0, y: 0 } } }),
    ).toStrictEqual([{ path: 'after.end.target', problem: 'self-reference' }]);
    expect(
      patched(fixtureElement(3), {
        points: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
      }),
    ).toStrictEqual([{ path: 'after.points', problem: 'not-normalised' }]);
  });

  it('accepts a group that the field check knows the form of; whether it exists is the scene’s check', () => {
    expect(patched(fixtureElement(2), { group: groupId(9) })).toMatchObject({ group: groupId(9) });
  });
});
