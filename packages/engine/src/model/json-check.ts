import type { CodecError, CodecProblem } from './codec.ts';

/** The errors found so far; a check appends to it and never removes anything. */
export type Issues = CodecError[];

/** What a check returns once it has reported at least one error. */
export const INVALID: unique symbol = Symbol('invalid');

export type Invalid = typeof INVALID;

/**
 * Reads an untrusted JSON value at a path: the value when it is valid, otherwise {@link INVALID}
 * after reporting at least one error. A check never repairs or drops part of its input.
 */
export type Check<T> = (value: unknown, path: string, issues: Issues) => T | Invalid;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const fieldPath = (path: string, key: string): string => {
  if (!IDENTIFIER.test(key)) {
    return `${path}[${JSON.stringify(key)}]`;
  }
  return path === '' ? key : `${path}.${key}`;
};

export const itemPath = (path: string, index: number): string => `${path}[${String(index)}]`;

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function refuse(issues: Issues, path: string, problem: CodecProblem): Invalid {
  issues.push({ path, problem });
  return INVALID;
}

export interface Range {
  readonly min: number;
  readonly max: number;
  /** Excludes `min`. */
  readonly above?: boolean;
  /** Excludes `max`. */
  readonly below?: boolean;
}

const finiteNumber = (value: unknown, path: string, issues: Issues): number | Invalid => {
  if (typeof value !== 'number') {
    return refuse(issues, path, 'not-number');
  }
  return Number.isFinite(value) ? value : refuse(issues, path, 'not-finite');
};

const within = (value: number, range: Range): boolean =>
  (range.above === true ? value > range.min : value >= range.min) &&
  (range.below === true ? value < range.max : value <= range.max);

export const numberIn =
  (range: Range): Check<number> =>
  (value, path, issues) => {
    const number = finiteNumber(value, path, issues);
    if (number === INVALID || within(number, range)) {
      return number;
    }
    return refuse(issues, path, 'out-of-range');
  };

export const integerIn =
  (min: number, max: number): Check<number> =>
  (value, path, issues) => {
    const number = finiteNumber(value, path, issues);
    if (number === INVALID) {
      return INVALID;
    }
    return Number.isInteger(number)
      ? numberIn({ min, max })(number, path, issues)
      : refuse(issues, path, 'not-integer');
  };

export const boolean: Check<boolean> = (value, path, issues) =>
  typeof value === 'boolean' ? value : refuse(issues, path, 'not-boolean');

/** A string of at most `maxLength` UTF-16 code units. */
export const text =
  (maxLength = Number.POSITIVE_INFINITY): Check<string> =>
  (value, path, issues) => {
    if (typeof value !== 'string') {
      return refuse(issues, path, 'not-string');
    }
    return value.length <= maxLength ? value : refuse(issues, path, 'too-long');
  };

export const oneOf =
  <T extends string | number>(values: readonly T[]): Check<T> =>
  (value, path, issues) =>
    values.find((allowed) => allowed === value) ?? refuse(issues, path, 'unknown-value');

/** A string that a model helper accepts, which brands it; anything else is `problem`. */
export const branded =
  <T extends string>(accepts: (text: string) => text is T, problem: CodecProblem): Check<T> =>
  (value, path, issues) => {
    if (typeof value !== 'string') {
      return refuse(issues, path, 'not-string');
    }
    return accepts(value) ? value : refuse(issues, path, problem);
  };

export const nullable =
  <T>(check: Check<T>): Check<T | null> =>
  (value, path, issues) =>
    value === null ? null : check(value, path, issues);

/** Runs `verify` on a value that passed `check`; the value fails if `verify` reports anything. */
export const refine =
  <T>(check: Check<T>, verify: (value: T, path: string, issues: Issues) => void): Check<T> =>
  (value, path, issues) => {
    const read = check(value, path, issues);
    if (read === INVALID) {
      return INVALID;
    }
    const before = issues.length;
    verify(read, path, issues);
    return issues.length === before ? read : INVALID;
  };

/** An array of `min` to `max` items; one that is too long is refused before any item is read. */
export const listOf =
  <T>(
    item: Check<T>,
    { min, max }: { readonly min: number; readonly max: number },
  ): Check<readonly T[]> =>
  (value, path, issues) => {
    if (!Array.isArray(value)) {
      return refuse(issues, path, 'not-array');
    }
    if (value.length > max) {
      return refuse(issues, path, 'too-many');
    }
    if (value.length < min) {
      return refuse(issues, path, 'too-few');
    }
    const before = issues.length;
    const items = value.map((entry: unknown, index) => item(entry, itemPath(path, index), issues));
    // No item reported an error, so none of them is INVALID.
    return issues.length === before ? (items as T[]) : INVALID;
  };

/** An optional field: absence is valid, and a present value must pass the check. */
export interface Optional<T> {
  readonly optional: Check<T>;
}

type OptionalKeys<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? never : K;
}[keyof T];

/** One check per field of `T`, with each optional field wrapped in {@link Optional}. */
export type Fields<T> = {
  readonly [K in keyof T]-?: K extends OptionalKeys<T>
    ? Optional<Exclude<T[K], undefined>>
    : Check<T[K]>;
};

type AnyField = Check<unknown> | Optional<unknown>;

interface Place {
  readonly path: string;
  readonly issues: Issues;
}

function readField(
  value: Readonly<Record<string, unknown>>,
  key: string,
  field: AnyField,
  at: Place,
): unknown {
  const path = fieldPath(at.path, key);
  const optional = typeof field !== 'function';
  if (!Object.hasOwn(value, key)) {
    return optional ? undefined : refuse(at.issues, path, 'missing');
  }
  return (optional ? field.optional : field)(value[key], path, at.issues);
}

/**
 * A plain object with exactly the given fields: an unknown field is refused, never dropped, and
 * the result is a new object that holds only the declared fields.
 */
export function record<T>(fields: Fields<T>): Check<T> {
  const entries = Object.entries<AnyField>(fields);
  const known = new Set(entries.map(([key]) => key));
  return (value, path, issues) => {
    if (!isRecord(value)) {
      return refuse(issues, path, 'not-object');
    }
    const before = issues.length;
    for (const key of Object.keys(value)) {
      if (!known.has(key)) {
        issues.push({ path: fieldPath(path, key), problem: 'unknown-field' });
      }
    }
    const read: Record<string, unknown> = {};
    for (const [key, field] of entries) {
      const entry = readField(value, key, field, { path, issues });
      if (entry !== undefined && entry !== INVALID) {
        read[key] = entry;
      }
    }
    // Every declared field passed its check, so the object has the shape of T.
    return issues.length === before ? (read as T) : INVALID;
  };
}
