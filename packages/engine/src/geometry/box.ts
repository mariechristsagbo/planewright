import type { Point, ShapeElement, TextElement } from '../model/elements.ts';
import { ARC_KAPPA, CLOSE, cornerRadius, cubicTo, lineTo, moveTo } from './path.ts';
import type { KindGeometry, PathCommand } from './path.ts';

// Box outlines: the rectangle, sharp or with round corners, and a text's box
// (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

function sharpOutline(width: number, height: number): readonly PathCommand[] {
  return [
    moveTo({ x: 0, y: 0 }),
    lineTo({ x: width, y: 0 }),
    lineTo({ x: width, y: height }),
    lineTo({ x: 0, y: height }),
    CLOSE,
  ];
}

/** Straight sides joined by quarter circles of radius `r`, each drawn as one cubic. */
function roundOutline(width: number, height: number, r: number): readonly PathCommand[] {
  // How far each control point lies from its corner along the side.
  const o = r - ARC_KAPPA * r;
  return [
    moveTo({ x: r, y: 0 }),
    lineTo({ x: width - r, y: 0 }),
    cubicTo({ x: width - o, y: 0 }, { x: width, y: o }, { x: width, y: r }),
    lineTo({ x: width, y: height - r }),
    cubicTo({ x: width, y: height - o }, { x: width - o, y: height }, { x: width - r, y: height }),
    lineTo({ x: r, y: height }),
    cubicTo({ x: o, y: height }, { x: 0, y: height - o }, { x: 0, y: height - r }),
    lineTo({ x: 0, y: r }),
    cubicTo({ x: 0, y: o }, { x: o, y: 0 }, { x: r, y: 0 }),
    CLOSE,
  ];
}

/**
 * The exact signed distance from a local point to a box whose corners are rounded with radius
 * `r`, at most half its shorter side: negative inside, 0 on the outline.
 */
export function boxDistance(width: number, height: number, r: number, local: Point): number {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const qx = Math.abs(local.x - halfWidth) - halfWidth + r;
  const qy = Math.abs(local.y - halfHeight) - halfHeight + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}

const radiusOf = ({ width, height, style }: ShapeElement): number =>
  style.corners === 'round' ? cornerRadius(width, height) : 0;

export const RECTANGLE: KindGeometry<ShapeElement> = {
  outline(element) {
    const r = radiusOf(element);
    return r > 0
      ? roundOutline(element.width, element.height, r)
      : sharpOutline(element.width, element.height);
  },
  distance: (element, local) =>
    boxDistance(element.width, element.height, radiusOf(element), local),
  isClosed: () => true,
};

/** A text's box, with sharp corners whatever its style says: the whole box counts as inside (REQ-S02). */
export const TEXT_BOX: KindGeometry<TextElement> = {
  outline: (element) => sharpOutline(element.width, element.height),
  distance: (element, local) => boxDistance(element.width, element.height, 0, local),
  isClosed: () => true,
};
