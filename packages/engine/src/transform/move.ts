import type { Element, Point } from '../model/elements.ts';

/** The elements moved by a scene delta: only their origins change (REQ-T01, REQ-T10). */
export const moveBy = (elements: readonly Element[], delta: Point): Element[] =>
  elements.map((element) => ({ ...element, x: element.x + delta.x, y: element.y + delta.y }));
