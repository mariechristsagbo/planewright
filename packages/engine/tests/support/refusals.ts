import { expect } from 'vitest';

import { decodeDocument } from '../../src/model/decode.ts';
import { changed } from './fixtures.ts';
import type { Json } from './fixtures.ts';

/** A broken fixture: a label, the changed path and value, then the one error's path and problem. */
export type Refusal = readonly [
  string,
  readonly (string | number)[],
  Json | undefined,
  string,
  string,
];

/** A change that keeps the fixture valid: a label, the changed path and the value. */
export type Acceptance = readonly [string, readonly (string | number)[], Json | undefined];

/** The decoder returns exactly this one error and no document (REQ-P07). */
export function expectRefused([, path, value, errorPath, problem]: Refusal): void {
  expect(decodeDocument(changed(path, value))).toStrictEqual({
    ok: false,
    errors: [{ path: errorPath, problem }],
  });
}

export function expectAccepted([, path, value]: Acceptance): void {
  expect(decodeDocument(changed(path, value)).ok).toBe(true);
}
