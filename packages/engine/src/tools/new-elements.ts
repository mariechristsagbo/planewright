import { layoutText } from '../geometry/text-layout.ts';
import type { TextMeasurer } from '../geometry/text-measurer.ts';
import { subtract } from '../math/vector.ts';
import { DEFAULT_TEXT_FONT, styleForKind } from '../model/defaults.ts';
import type {
  ElementKind,
  FreehandElement,
  LineElement,
  Point,
  ShapeElement,
  TextElement,
} from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { LIMITS } from '../model/limits.ts';
import { keyBetween } from '../model/order-key.ts';
import type { OrderKey } from '../model/order-key.ts';
import { pointExtent } from '../model/points.ts';
import type { Style } from '../model/style.ts';
import type { SceneReader } from '../scene/store.ts';

// The elements that the creation tools make (docs/architecture/engine/interaction.md#p0-tools),
// from scene points: unrotated, unlocked, in the current default style (REQ-C12).

export type ShapeKind = ShapeElement['kind'];
/** The kinds that a drag draws over its box or between its ends. */
export type DrawnKind = ShapeKind | 'line';
export type CreatedElement = ShapeElement | LineElement | FreehandElement | TextElement;

/** The side of a tapped closed shape and the length of a tapped line (REQ-C03, REQ-C04). */
export const TAP_SIZE = 100;
/** The shortest side of a dragged closed shape, so that its box is never empty (REQ-C02). */
export const MIN_SHAPE_SIDE = 1;

/** What a gesture's new element keeps from its start: its identifier, order and style. */
export interface NewElement {
  readonly id: ElementId;
  readonly order: OrderKey;
  readonly defaults: Style;
}

/** A new element with an identifier and an order key above every element the scene holds. */
export const newElementOf = (scene: SceneReader, id: ElementId, defaults: Style): NewElement => ({
  id,
  order: keyBetween(scene.ordered().at(-1)?.order ?? null, null),
  defaults,
});

const common = (base: NewElement, kind: ElementKind, origin: Point) => ({
  id: base.id,
  order: base.order,
  x: origin.x,
  y: origin.y,
  rotation: 0,
  style: styleForKind(base.defaults, kind),
  locked: false,
  rev: 1,
});

/**
 * A closed shape over the box between two scene points, normalised whatever the drag's direction
 * (REQ-C01); a side shorter than {@link MIN_SHAPE_SIDE}, as a flat drag gives, gets that length,
 * so that the box is never empty and a resize can change it (REQ-C02).
 */
export function shapeBetween(
  kind: ShapeKind,
  base: NewElement,
  from: Point,
  to: Point,
): ShapeElement {
  return {
    ...common(base, kind, { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) }),
    kind,
    width: Math.max(Math.abs(to.x - from.x), MIN_SHAPE_SIDE),
    height: Math.max(Math.abs(to.y - from.y), MIN_SHAPE_SIDE),
  };
}

/** A two-point line from one scene point to another, its points measured from its box (REQ-C01). */
export function lineBetween(base: NewElement, from: Point, to: Point): LineElement {
  const origin = { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y) };
  return {
    ...common(base, 'line', origin),
    kind: 'line',
    points: [subtract(from, origin), subtract(to, origin)],
  };
}

/** The element that a drag draws: a closed shape over its box, or a line from press to pointer. */
export const drawnBetween = (kind: DrawnKind, base: NewElement, from: Point, to: Point) =>
  kind === 'line' ? lineBetween(base, from, to) : shapeBetween(kind, base, from, to);

/**
 * The element that a tap makes, centred on the tap: a {@link TAP_SIZE} square for a closed shape
 * (REQ-C04) or a horizontal line of that length (REQ-C03).
 */
export function tapped(kind: DrawnKind, base: NewElement, at: Point): ShapeElement | LineElement {
  const x = at.x - TAP_SIZE / 2;
  if (kind === 'line') {
    const points = [
      { x: 0, y: 0 },
      { x: TAP_SIZE, y: 0 },
    ];
    return { ...common(base, 'line', { x, y: at.y }), kind, points };
  }
  const origin = { x, y: at.y - TAP_SIZE / 2 };
  return { ...common(base, kind, origin), kind, width: TAP_SIZE, height: TAP_SIZE };
}

/**
 * A freehand stroke through scene points, at least one: its box is their extent (REQ-C07), and one
 * point is a dot of zero size.
 */
export function strokeThrough(base: NewElement, points: readonly Point[]): FreehandElement {
  let origin = points[0] ?? { x: 0, y: 0 };
  for (const { x, y } of points) origin = { x: Math.min(origin.x, x), y: Math.min(origin.y, y) };
  return {
    ...common(base, 'freehand', origin),
    kind: 'freehand',
    points: points.map((point) => subtract(point, origin)),
  };
}

/**
 * An empty left-aligned text in the default font whose left edge is at a scene point and whose
 * first line is centred vertically on it (REQ-C09), measured through the text measurer.
 */
export function textAt(base: NewElement, at: Point, measurer: TextMeasurer): TextElement {
  const content = { text: '', font: DEFAULT_TEXT_FONT, align: 'left' } as const;
  const { width, height, lineHeight } = layoutText(content, measurer);
  const origin = { x: at.x, y: at.y - lineHeight / 2 };
  return { ...common(base, 'text', origin), kind: 'text', width, height, content };
}

/**
 * Whether the scene has room for one more element: a document holds at most 100,000, so a creation
 * in a full one shows nothing (the ENG-11 review's m1).
 */
export const roomForOne = (scene: SceneReader): boolean => scene.ordered().length < LIMITS.elements;

/**
 * Whether a new element lies within the document's limits, which the scene store would refuse:
 * its origin within the coordinate limit, as a drag near the camera's own limit could leave it,
 * and its size within the size limit.
 */
export function withinLimits(element: CreatedElement): boolean {
  const size =
    element.kind === 'line' || element.kind === 'freehand' ? pointExtent(element.points) : element;
  return (
    Math.abs(element.x) <= LIMITS.coordinate &&
    Math.abs(element.y) <= LIMITS.coordinate &&
    size.width <= LIMITS.size &&
    size.height <= LIMITS.size
  );
}
