import type { Vec } from '../math/vector.ts';
import type { Element, Point } from '../model/elements.ts';
import { LIMITS } from '../model/limits.ts';

// An element given a new origin and size: a point kind scales its points, which stay normalised
// because scaling keeps their smallest x and y at 0, and a text scales its font size with its
// height (docs/architecture/engine/interaction.md#transforms). The ratio limits stop a font at the
// document's limits, but they come from divisions, so the scaled size is clamped to the limits as
// well: one rounding step past them would make the scene store refuse the element.

export interface Size {
  readonly width: number;
  readonly height: number;
}

const { min, max } = LIMITS.fontSize;

/** The element at a new origin and size, its points or font scaled by the ratios along its axes. */
export function scaledTo(element: Element, origin: Point, size: Size, ratio: Vec): Element {
  if ('points' in element) {
    const points = element.points.map(({ x, y }) => ({ x: x * ratio.x, y: y * ratio.y }));
    return { ...element, ...origin, points };
  }
  if (element.kind === 'text') {
    const scaled = Math.min(max, Math.max(min, element.content.font.size * ratio.y));
    const font = { ...element.content.font, size: scaled };
    return { ...element, ...origin, ...size, content: { ...element.content, font } };
  }
  return { ...element, ...origin, ...size };
}
