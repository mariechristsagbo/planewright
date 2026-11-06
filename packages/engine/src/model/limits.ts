/**
 * The limits that the codec enforces on every untrusted document
 * (docs/architecture/engine/domain-model.md#invariants-and-limits), so that a hostile file cannot
 * make the editor allocate without bound.
 */
export const LIMITS = {
  /** The largest |x| and |y| of an element, a crop or a point, in scene units. */
  coordinate: 1e9,
  /** The largest width or height, given or derived from points. */
  size: 1e7,
  /** The largest stroke width; the smallest is above 0. */
  strokeWidth: 100,
  fontSize: { min: 1, max: 1_000 },
  lineHeight: { min: 1, max: 3 },
  /** The most points of a line or an arrow. */
  linePoints: 10_000,
  freehandPoints: 50_000,
  /** The longest text, in UTF-16 code units. */
  text: 100_000,
  link: 2_048,
  elements: 100_000,
  /** The largest encoded document, in UTF-8 bytes, refused before it is parsed. */
  encodedBytes: 50_000_000,
} as const;
