import { screenFromScene } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { obbToScene } from '../math/obb.ts';
import { add, rotate } from '../math/vector.ts';
import type { Point } from '../model/elements.ts';
import type { SelectionFrame } from './frame.ts';
import type { PointerKind } from './pointer.ts';

// Handle layout and hit squares (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-overlay-layer).

export type HandleId =
  'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'rotate' | 'start' | 'end';

/** A handle in screen space: its centre, the square it is drawn as and the square it is hit by. */
export interface Handle {
  readonly handle: HandleId;
  readonly center: Point;
  readonly size: number;
  readonly hitSize: number;
}

/** The drawn size of a handle in screen pixels: 8 for a mouse or pen, 12 for touch. */
export const HANDLE_SIZE: Readonly<Record<PointerKind, number>> = { mouse: 8, pen: 8, touch: 12 };

/** The side of a handle's hit square in screen pixels: 12 for a mouse or pen, 24 for touch (REQ-Y06). */
export const HANDLE_HIT_SIZE: Readonly<Record<PointerKind, number>> = {
  mouse: 12,
  pen: 12,
  touch: 24,
};

/** How far above the box's top centre the rotation handle sits, in screen pixels. */
export const ROTATION_HANDLE_OFFSET = 24;

const CORNERS = [
  ['nw', 0, 0],
  ['ne', 1, 0],
  ['se', 1, 1],
  ['sw', 0, 1],
] as const;

const SIDES = [
  ['n', 0.5, 0, 'width'],
  ['e', 1, 0.5, 'height'],
  ['s', 0.5, 1, 'width'],
  ['w', 0, 0.5, 'height'],
] as const;

/**
 * The handles of a selection frame in screen space, in the order in which they are hit: the four
 * corners, the rotation handle 24 px above the top centre in the box's own orientation, then the
 * side handles, each hidden when its side is shorter on screen than three hit squares, so that the
 * corners stay reachable (REQ-S12). A lone two-point line has its start and end handles instead.
 */
export function layoutHandles(
  frame: SelectionFrame,
  camera: Camera,
  pointer: PointerKind,
): readonly Handle[] {
  const sized = { size: HANDLE_SIZE[pointer], hitSize: HANDLE_HIT_SIZE[pointer] };
  const place = (handle: HandleId, scene: Point): Handle => ({
    handle,
    center: screenFromScene(scene, camera),
    ...sized,
  });
  if (frame.type === 'ends') return [place('start', frame.start), place('end', frame.end)];
  const { box } = frame;
  const at = (fx: number, fy: number): Point =>
    obbToScene(box, { x: fx * box.width, y: fy * box.height });
  const above = rotate({ x: 0, y: -ROTATION_HANDLE_OFFSET }, box.rotation);
  const rotation: Handle = {
    handle: 'rotate',
    center: add(screenFromScene(at(0.5, 0), camera), above),
    ...sized,
  };
  const sides = SIDES.filter(([, , , side]) => box[side] * camera.zoom >= 3 * sized.hitSize);
  return [
    ...CORNERS.map(([handle, fx, fy]) => place(handle, at(fx, fy))),
    rotation,
    ...sides.map(([handle, fx, fy]) => place(handle, at(fx, fy))),
  ];
}

/** The first handle whose hit square, centred on it, holds a screen point, edges included. */
export function handleAt(handles: readonly Handle[], at: Point): HandleId | undefined {
  return handles.find(
    ({ center, hitSize }) =>
      Math.abs(at.x - center.x) <= hitSize / 2 && Math.abs(at.y - center.y) <= hitSize / 2,
  )?.handle;
}
