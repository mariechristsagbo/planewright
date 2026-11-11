// How the interface rounds an element's figures (docs/architecture/engine/quality.md#accessibility):
// the element list's names and rows and the selection's figures read their numbers here, so that
// they never disagree (ADR 0012; the v0.2 plan's S5 and S6).

/** One decimal place, and never "-0". */
export const decimal = (value: number): string => String(Math.round(value * 10) / 10 + 0);

/** A turn in degrees in [0, 360), to a tenth; a turn that rounds to 360 is 0. */
export function normalizedDegrees(rotation: number): number {
  const degrees = Math.round((((((rotation * 180) / Math.PI) % 360) + 360) % 360) * 10) / 10;
  return degrees === 360 ? 0 : degrees;
}
