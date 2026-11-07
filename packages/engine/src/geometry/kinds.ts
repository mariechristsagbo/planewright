import { obbToLocal } from '../math/obb.ts';
import type { Element, ElementKind, Point } from '../model/elements.ts';
import { RECTANGLE, TEXT_BOX } from './box.ts';
import { DIAMOND } from './diamond.ts';
import { ELLIPSE } from './ellipse.ts';
import type { KindGeometry } from './path.ts';
import { FREEHAND, LINE } from './polyline.ts';
import { localBox } from './world-bounds.ts';

// Which geometry each kind has, and the local frame that every geometry works in
// (docs/architecture/engine/rendering-and-hit-testing.md#geometry).

const GEOMETRIES: Partial<Record<ElementKind, KindGeometry<Element>>> = {
  rectangle: RECTANGLE,
  ellipse: ELLIPSE,
  diamond: DIAMOND,
  line: LINE,
  freehand: FREEHAND,
  text: TEXT_BOX,
};

/**
 * The geometry of an element's kind. The arrow, note, image and frame, which P0 neither creates
 * nor draws, have none until the issue that adds each of them, so nothing hits or encloses them.
 */
export function geometryOf(element: Element): KindGeometry<Element> | undefined {
  return GEOMETRIES[element.kind];
}

/**
 * A scene point in an element's local frame: turned back by the element's rotation about its box
 * centre, then measured from its origin (REQ-T02). Without a rotation it is only measured from the
 * origin, so that no rounding through the centre moves it.
 */
export function toLocal(element: Element, scene: Point): Point {
  if (element.rotation === 0) return { x: scene.x - element.x, y: scene.y - element.y };
  return obbToLocal({ ...localBox(element), rotation: element.rotation }, scene);
}
