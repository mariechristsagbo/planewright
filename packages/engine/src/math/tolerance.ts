/**
 * The default tolerance for comparing scene coordinates and other engine numbers: far below
 * anything a user can see or point at, yet above the rounding of a few double operations.
 */
export const DEFAULT_TOLERANCE = 1e-9;

/**
 * Whether two numbers are equal within a tolerance that scales with their magnitude above 1, so
 * that coordinates near the ±10⁹ limit compare as well as those near 0. Infinities equal only
 * themselves and NaN equals nothing.
 */
export function nearlyEqual(a: number, b: number, tolerance = DEFAULT_TOLERANCE): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return a === b;
  }
  return Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Whether a number is within an absolute tolerance of zero. */
export function nearlyZero(value: number, tolerance = DEFAULT_TOLERANCE): boolean {
  return Math.abs(value) <= tolerance;
}
