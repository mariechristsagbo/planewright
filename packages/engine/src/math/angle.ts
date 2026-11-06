// Angles are in radians. A rotation is stored in [0, 2π) (docs/architecture/engine/domain-model.md).

/** A full turn. */
export const TAU = 2 * Math.PI;

/** The same direction as an angle in [0, 2π), never -0; NaN when the angle is not finite. */
export function normalizeAngle(radians: number): number {
  const turned = radians % TAU;
  const positive = turned < 0 ? turned + TAU : turned;
  // A tiny negative angle rounds up to a full turn, and -0 stays -0; both mean 0.
  return positive === 0 || positive >= TAU ? 0 : positive;
}

/** The shortest signed turn from one direction to another, in (−π, π]. */
export function angleDelta(from: number, to: number): number {
  const turn = normalizeAngle(to - from);
  return turn > Math.PI ? turn - TAU : turn;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** The multiple of `step` nearest to an angle, normalised; Shift snaps rotation to 15° steps. */
export function snapAngle(radians: number, step: number): number {
  if (!(step > 0 && Number.isFinite(step))) {
    throw new RangeError(`An angle step must be positive and finite, not ${String(step)}.`);
  }
  return normalizeAngle(Math.round(radians / step) * step);
}
