import { describe, expect, it } from 'vitest';

import type { CodecError } from '../../../src/model/codec.ts';
import {
  INVALID,
  boolean,
  branded,
  fieldPath,
  integerIn,
  itemPath,
  listOf,
  nullable,
  numberIn,
  oneOf,
  record,
  refine,
  text,
} from '../../../src/model/json-check.ts';
import type { Check } from '../../../src/model/json-check.ts';

/** Runs a check at the path `at` and returns what it read and the errors it reported. */
function run<T>(check: Check<T>, value: unknown): { value: T | undefined; errors: CodecError[] } {
  const errors: CodecError[] = [];
  const read = check(value, 'at', errors);
  return { value: read === INVALID ? undefined : read, errors };
}

const refused = (path: string, problem: CodecError['problem']) => ({
  value: undefined,
  errors: [{ path, problem }],
});

describe('JSON paths', () => {
  it('join field names with dots and indexes with brackets', () => {
    expect(fieldPath('', 'elements')).toBe('elements');
    expect(fieldPath('elements[3].style', 'stroke')).toBe('elements[3].style.stroke');
    expect(itemPath('elements', 3)).toBe('elements[3]');
  });

  it('quote a field name that is not an identifier', () => {
    expect(fieldPath('at', 'x.y')).toBe('at["x.y"]');
    expect(fieldPath('', '1a')).toBe('["1a"]');
    expect(fieldPath('at', '')).toBe('at[""]');
    expect(fieldPath('at', 'a"]')).toBe('at["a\\"]"]');
  });
});

describe('numberIn', () => {
  const unit = numberIn({ min: 0, max: 1 });
  const open = numberIn({ min: 0, max: 1, above: true, below: true });

  it('accepts a number within its range, both ends included by default', () => {
    expect(run(unit, 0)).toStrictEqual({ value: 0, errors: [] });
    expect(run(unit, 1)).toStrictEqual({ value: 1, errors: [] });
    expect(run(open, 0.5)).toStrictEqual({ value: 0.5, errors: [] });
  });

  it.each([
    ['a string', '1', 'not-number'],
    ['null', null, 'not-number'],
    ['infinity', Number.POSITIVE_INFINITY, 'not-finite'],
    ['NaN', Number.NaN, 'not-finite'],
    ['a number below', -0.001, 'out-of-range'],
    ['a number above', 1.001, 'out-of-range'],
  ] as const)('refuses %s', (_, value, problem) => {
    expect(run(unit, value)).toStrictEqual(refused('at', problem));
  });

  it('excludes an end when asked', () => {
    expect(run(open, 0)).toStrictEqual(refused('at', 'out-of-range'));
    expect(run(open, 1)).toStrictEqual(refused('at', 'out-of-range'));
  });
});

describe('integerIn', () => {
  const count = integerIn(0, 10);

  it('accepts an integer within its range', () => {
    expect(run(count, 10)).toStrictEqual({ value: 10, errors: [] });
  });

  it.each([
    ['a fraction', 1.5, 'not-integer'],
    ['a string', '1', 'not-number'],
    ['infinity', Number.NEGATIVE_INFINITY, 'not-finite'],
    ['an integer out of range', 11, 'out-of-range'],
  ] as const)('refuses %s', (_, value, problem) => {
    expect(run(count, value)).toStrictEqual(refused('at', problem));
  });
});

describe('boolean, text, oneOf and branded', () => {
  it('check booleans', () => {
    expect(run(boolean, false)).toStrictEqual({ value: false, errors: [] });
    expect(run(boolean, 'false')).toStrictEqual(refused('at', 'not-boolean'));
  });

  it('check strings and their length in code units', () => {
    expect(run(text(2), 'ab')).toStrictEqual({ value: 'ab', errors: [] });
    expect(run(text(2), 'abc')).toStrictEqual(refused('at', 'too-long'));
    expect(run(text(1), '😀')).toStrictEqual(refused('at', 'too-long'));
    expect(run(text(), 'x'.repeat(10_000))).toStrictEqual({
      value: 'x'.repeat(10_000),
      errors: [],
    });
    expect(run(text(2), 12)).toStrictEqual(refused('at', 'not-string'));
  });

  it('check a closed set of values', () => {
    const dash = oneOf(['solid', 'dashed'] as const);
    expect(run(dash, 'solid')).toStrictEqual({ value: 'solid', errors: [] });
    expect(run(dash, 'dotted')).toStrictEqual(refused('at', 'unknown-value'));
    expect(run(oneOf([0, 1] as const), '0')).toStrictEqual(refused('at', 'unknown-value'));
  });

  it('check a branded string with its own problem', () => {
    const key = branded(
      (value): value is `k${string}` => value.startsWith('k'),
      'malformed-order-key',
    );
    expect(run(key, 'kV')).toStrictEqual({ value: 'kV', errors: [] });
    expect(run(key, 'V')).toStrictEqual(refused('at', 'malformed-order-key'));
    expect(run(key, 1)).toStrictEqual(refused('at', 'not-string'));
  });
});

describe('nullable', () => {
  it('accepts null as a value and checks anything else', () => {
    expect(run(nullable(boolean), null)).toStrictEqual({ value: null, errors: [] });
    expect(run(nullable(boolean), true)).toStrictEqual({ value: true, errors: [] });
    expect(run(nullable(boolean), 0)).toStrictEqual(refused('at', 'not-boolean'));
  });
});

describe('listOf', () => {
  const flags = listOf(boolean, { min: 1, max: 2 });

  it('checks each item at its index', () => {
    expect(run(flags, [true, false])).toStrictEqual({ value: [true, false], errors: [] });
    expect(run(flags, [1, false])).toStrictEqual(refused('at[0]', 'not-boolean'));
  });

  it('reports every bad item', () => {
    expect(run(flags, ['a', 'b']).errors).toStrictEqual([
      { path: 'at[0]', problem: 'not-boolean' },
      { path: 'at[1]', problem: 'not-boolean' },
    ]);
  });

  it('refuses too many items before checking any of them', () => {
    expect(run(flags, [1, 2, 3])).toStrictEqual(refused('at', 'too-many'));
  });

  it('refuses too few items and anything but an array', () => {
    expect(run(flags, [])).toStrictEqual(refused('at', 'too-few'));
    expect(run(flags, { 0: true, length: 1 })).toStrictEqual(refused('at', 'not-array'));
  });
});

describe('record', () => {
  interface Sample {
    readonly a: boolean;
    readonly b?: string;
  }
  const sample = record<Sample>({ a: boolean, b: { optional: text(3) } });

  it('reads the declared fields and only them', () => {
    expect(run(sample, { a: true, b: 'xy' })).toStrictEqual({
      value: { a: true, b: 'xy' },
      errors: [],
    });
    expect(run(sample, { a: false })).toStrictEqual({ value: { a: false }, errors: [] });
  });

  it('reports missing, unknown and bad fields at their paths', () => {
    expect(run(sample, { b: 'long', c: 1, 'd.e': 2 }).errors).toStrictEqual([
      { path: 'at.c', problem: 'unknown-field' },
      { path: 'at["d.e"]', problem: 'unknown-field' },
      { path: 'at.a', problem: 'missing' },
      { path: 'at.b', problem: 'too-long' },
    ]);
  });

  it('refuses an optional field that is present but null', () => {
    expect(run(sample, { a: true, b: null })).toStrictEqual(refused('at.b', 'not-string'));
  });

  it('refuses anything but a plain object', () => {
    expect(run(sample, [])).toStrictEqual(refused('at', 'not-object'));
    expect(run(sample, null)).toStrictEqual(refused('at', 'not-object'));
    expect(run(sample, 'a')).toStrictEqual(refused('at', 'not-object'));
  });

  it('treats an own __proto__ field as unknown and never copies it', () => {
    const value: unknown = JSON.parse('{"a": true, "__proto__": {"polluted": true}}');
    const result = run(sample, value);
    expect(result.errors).toStrictEqual([{ path: 'at.__proto__', problem: 'unknown-field' }]);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect('polluted' in {}).toBe(false);
  });
});

describe('refine', () => {
  const even = refine(integerIn(0, 100), (value, path, issues) => {
    if (value % 2 === 1) issues.push({ path, problem: 'out-of-range' });
  });

  it('runs the extra test on a value that passed its check', () => {
    expect(run(even, 4)).toStrictEqual({ value: 4, errors: [] });
    expect(run(even, 5)).toStrictEqual(refused('at', 'out-of-range'));
  });

  it('skips the extra test when the check fails', () => {
    expect(run(even, 1.5)).toStrictEqual(refused('at', 'not-integer'));
  });
});
