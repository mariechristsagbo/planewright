import { describe, expect, it } from 'vitest';

import type { CodecError } from '../../../src/model/codec.ts';
import { checkElement } from '../../../src/model/element-checks.ts';
import type { Element } from '../../../src/model/elements.ts';
import { INVALID } from '../../../src/model/json-check.ts';
import { elementId, fixtureJson } from '../../support/fixtures.ts';
import type { JsonObject } from '../../support/fixtures.ts';

/** The fixture's element at `index`, or a copy of it with some fields replaced. */
function element(index: number, changes: JsonObject = {}): JsonObject {
  const elements = fixtureJson()['elements'] as JsonObject[];
  return { ...(elements[index] ?? {}), ...changes };
}

function check(value: unknown): { read: Element | undefined; errors: CodecError[] } {
  const errors: CodecError[] = [];
  const read = checkElement(value, 'elements[4]', errors);
  return { read: read === INVALID ? undefined : read, errors };
}

const refused = (path: string, problem: CodecError['problem']) => ({
  read: undefined,
  errors: [{ path: `elements[4]${path}`, problem }],
});

describe('checkElement', () => {
  it.each(Array.from({ length: 10 }, (_, index) => [element(index)['kind'], index] as const))(
    'reads a valid %s as a new object equal to its input',
    (_, index) => {
      const input = element(index);
      const { read, errors } = check(input);
      expect(errors).toEqual([]);
      expect(read).toStrictEqual(input);
      expect(read).not.toBe(input);
    },
  );

  it('refuses a value that is not an object, or has no known kind', () => {
    expect(check([])).toStrictEqual(refused('', 'not-object'));
    expect(check(element(0, { kind: 'circle' }))).toStrictEqual(refused('.kind', 'unknown-value'));
    const kindless = element(0);
    Reflect.deleteProperty(kindless, 'kind');
    expect(check(kindless)).toStrictEqual(refused('.kind', 'missing'));
  });

  it("checks each field against its kind's fields", () => {
    expect(check(element(3, { width: 10 }))).toStrictEqual(refused('.width', 'unknown-field'));
    expect(check(element(0, { points: [] }))).toStrictEqual(refused('.points', 'unknown-field'));
    const unlabelled = element(7);
    Reflect.deleteProperty(unlabelled, 'label');
    expect(check(unlabelled)).toStrictEqual(refused('.label', 'missing'));
  });

  it('reports every error of an element, each at its path', () => {
    const { errors } = check(element(0, { x: 2e9, style: null, link: 'ftp://x', rev: -1 }));
    expect(errors).toStrictEqual([
      { path: 'elements[4].x', problem: 'out-of-range' },
      { path: 'elements[4].style', problem: 'not-object' },
      { path: 'elements[4].link', problem: 'unsafe-link' },
      { path: 'elements[4].rev', problem: 'out-of-range' },
    ]);
  });

  it('needs enough points, normalised and within the size limit', () => {
    expect(check(element(3, { points: [{ x: 0, y: 0 }] }))).toStrictEqual(
      refused('.points', 'too-few'),
    );
    expect(check(element(4, { points: [], pressures: [] }))).toStrictEqual(
      refused('.points', 'too-few'),
    );
    const shifted = [
      { x: 1, y: 0 },
      { x: 3, y: 4 },
    ];
    expect(check(element(3, { points: shifted }))).toStrictEqual(
      refused('.points', 'not-normalised'),
    );
    const wide = [
      { x: -1e-9, y: 0 },
      { x: 1e7, y: 0 },
    ];
    expect(check(element(3, { points: wide }))).toStrictEqual(refused('.points', 'out-of-range'));
  });

  it('needs one pressure per point', () => {
    expect(check(element(4, { pressures: [0.5] }))).toStrictEqual(
      refused('.pressures', 'length-mismatch'),
    );
  });

  it('refuses an arrow attached to itself', () => {
    const self = { target: elementId(6), anchor: { x: 0, y: 0 } };
    expect(check(element(6, { start: self }))).toStrictEqual(
      refused('.start.target', 'self-reference'),
    );
    expect(check(element(6, { end: self }))).toStrictEqual(
      refused('.end.target', 'self-reference'),
    );
  });

  it('refuses a carriage return in a text', () => {
    const content = {
      text: 'a\r\nb',
      font: { family: 'sans', size: 20, lineHeight: 1.25 },
      align: 'left',
    };
    expect(check(element(5, { content }))).toStrictEqual(
      refused('.content.text', 'carriage-return'),
    );
  });
});
