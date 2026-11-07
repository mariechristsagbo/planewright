import type { Vec } from '../math/vector.ts';
import type { HandleId } from '../selection/handles.ts';

// How a drag of a resize handle changes a box's size
// (docs/architecture/engine/interaction.md#transforms): the dragged edges follow the drag and the
// opposite corner or side stays fixed (REQ-T02); Shift keeps the aspect ratio by the larger ratio
// and Alt fixes the centre and doubles the change (REQ-T04). A ratio is a new size over the old one;
// an axis with no extent keeps the ratio 1 and its size 0, and sizes stop at their limits (REQ-T05).

export type ResizeHandle = Exclude<HandleId, 'rotate' | 'start' | 'end'>;

export interface ResizeOptions {
  /** Shift: the aspect ratio is kept, by the larger ratio of the dragged axes. */
  readonly keepAspect: boolean;
  /** Alt: the centre stays fixed and the change is doubled. */
  readonly fromCenter: boolean;
}

/** A drag of a resize handle: which handle, by how much in scene units, and with which keys. */
export interface ResizeDrag {
  readonly handle: ResizeHandle;
  readonly drag: Vec;
  readonly options: ResizeOptions;
}

export interface ResizeLimits {
  /** The smallest new size along each axis. */
  readonly least: Vec;
  /** The largest ratio on either axis. */
  readonly most: number;
}

export interface Resized {
  readonly width: number;
  readonly height: number;
  /** The new size over the old along each axis, 1 where the box has no extent. */
  readonly ratio: Vec;
  /** The point that stays in place, as fractions of the box's width and height. */
  readonly fixed: Vec;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where each handle sits on its box, as fractions of the width and the height. */
const PLACES: Readonly<Record<ResizeHandle, Vec>> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

export const isResizeHandle = (handle: HandleId): handle is ResizeHandle =>
  Object.hasOwn(PLACES, handle);

/** The smallest ratio that keeps a positive size at 1 unit, or at its own size below that. */
export const leastRatio = (size: number): number => (size > 0 ? Math.min(1, size) / size : 0);

/** The size that a drag gives one axis: its dragged side follows the drag, twice with Alt. */
function draggedSize(size: number, place: number, drag: number, fromCenter: boolean): number {
  if (size === 0 || place === 0.5) return size;
  return size + (place === 1 ? drag : -drag) * (fromCenter ? 2 : 1);
}

/** One axis resized freely, between its smallest size and its largest ratio. */
function freeAxis(size: number, next: number, least: number, most: number) {
  if (size === 0) return { size, ratio: 1 };
  if (next < least) return { size: least, ratio: least / size };
  if (next / size > most) return { size: size * most, ratio: most };
  return { size: next, ratio: next / size };
}

/** Both axes scaled by the larger ratio of the dragged axes that have extent. */
function keptAspect(size: Size, next: Size, place: Vec, limits: ResizeLimits) {
  const ratios = [
    ...(place.x !== 0.5 && size.width > 0 ? [next.width / size.width] : []),
    ...(place.y !== 0.5 && size.height > 0 ? [next.height / size.height] : []),
  ];
  const least = Math.max(
    size.width > 0 ? limits.least.x / size.width : 0,
    size.height > 0 ? limits.least.y / size.height : 0,
  );
  const ratio = ratios.length === 0 ? 1 : Math.min(limits.most, Math.max(least, ...ratios));
  const along = (extent: number): number => (extent > 0 ? ratio : 1);
  return {
    width: size.width * ratio,
    height: size.height * ratio,
    ratio: { x: along(size.width), y: along(size.height) },
  };
}

/** A box's new size and ratios after a drag of one of its handles by a drag in its own frame. */
export function resizeRatios(
  size: Size,
  handle: ResizeHandle,
  drag: Vec,
  { options, limits }: { readonly options: ResizeOptions; readonly limits: ResizeLimits },
): Resized {
  const place = PLACES[handle];
  const fixed = options.fromCenter ? { x: 0.5, y: 0.5 } : { x: 1 - place.x, y: 1 - place.y };
  const next = {
    width: draggedSize(size.width, place.x, drag.x, options.fromCenter),
    height: draggedSize(size.height, place.y, drag.y, options.fromCenter),
  };
  if (options.keepAspect) return { ...keptAspect(size, next, place, limits), fixed };
  const x = freeAxis(size.width, next.width, limits.least.x, limits.most);
  const y = freeAxis(size.height, next.height, limits.least.y, limits.most);
  return { width: x.size, height: y.size, ratio: { x: x.ratio, y: y.ratio }, fixed };
}
