import { describe, expect, it } from 'vitest';

import { DEFAULT_TOLERANCE, nearlyEqual, nearlyZero } from '../../../src/math/tolerance.ts';

describe('DEFAULT_TOLERANCE', () => {
  it('is far below anything visible yet above double rounding at unit scale', () => {
    expect(DEFAULT_TOLERANCE).toBe(1e-9);
    expect(DEFAULT_TOLERANCE).toBeGreaterThan(Number.EPSILON * 1_000);
  });
});

describe('nearlyEqual', () => {
  it('accepts rounding noise and rejects a real difference near unit scale', () => {
    expect(nearlyEqual(0.1 + 0.2, 0.3)).toBe(true);
    expect(nearlyEqual(1, 1 + 1e-10)).toBe(true);
    expect(nearlyEqual(1, 1 + 1e-8)).toBe(false);
    expect(nearlyEqual(0, -1e-10)).toBe(true);
  });

  it('scales the tolerance with the larger magnitude above 1', () => {
    expect(nearlyEqual(1e9, 1e9 + 0.5)).toBe(true);
    expect(nearlyEqual(1e9, 1e9 + 2)).toBe(false);
    expect(nearlyEqual(-1e9, -1e9 - 0.5)).toBe(true);
  });

  it('takes an explicit tolerance', () => {
    expect(nearlyEqual(10, 10.4, 0.05)).toBe(true);
    expect(nearlyEqual(10, 10.6, 0.05)).toBe(false);
    expect(nearlyEqual(0.5, 0.501, 0.01)).toBe(true);
  });

  it('compares infinities and NaN exactly', () => {
    expect(nearlyEqual(Infinity, Infinity)).toBe(true);
    expect(nearlyEqual(-Infinity, Infinity)).toBe(false);
    expect(nearlyEqual(Infinity, 1e300)).toBe(false);
    expect(nearlyEqual(1e300, -Infinity)).toBe(false);
    expect(nearlyEqual(Number.NaN, Number.NaN)).toBe(false);
    expect(nearlyEqual(Number.NaN, 0)).toBe(false);
  });
});

describe('nearlyZero', () => {
  it('uses an absolute tolerance, because zero has no scale', () => {
    expect(nearlyZero(0)).toBe(true);
    expect(nearlyZero(-0)).toBe(true);
    expect(nearlyZero(1e-10)).toBe(true);
    expect(nearlyZero(-1e-8)).toBe(false);
    expect(nearlyZero(0.004, 0.005)).toBe(true);
    expect(nearlyZero(Number.NaN)).toBe(false);
  });
});
