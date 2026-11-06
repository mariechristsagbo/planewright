import { normalizeAngle } from './angle.ts';
import { nearlyEqual } from './tolerance.ts';

/**
 * A point or a displacement in a plane. Scene space and screen space both have x to the right and
 * y downwards, so a positive angle turns clockwise on screen.
 */
export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const ZERO: Vec = { x: 0, y: 0 };

export const vec = (x: number, y: number): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });

export const subtract = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });

export const scale = (v: Vec, factor: number): Vec => ({ x: v.x * factor, y: v.y * factor });

export const negate = (v: Vec): Vec => ({ x: -v.x, y: -v.y });

export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;

/** The z component of the 3D cross product: positive when `b` turns clockwise from `a`. */
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;

export const magnitude = (v: Vec): number => Math.hypot(v.x, v.y);

export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The unit vector in the direction of `v`, or the zero vector when `v` has no direction. */
export function normalize(v: Vec): Vec {
  const length = magnitude(v);
  return length === 0 ? ZERO : { x: v.x / length, y: v.y / length };
}

/** The point at `t` along the way from `a` (t = 0) to `b` (t = 1). */
export const lerp = (a: Vec, b: Vec, t: number): Vec => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const midpoint = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Turns a vector by an angle in radians, from +x towards +y. */
export function rotate(v: Vec, radians: number): Vec {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Turns a point about a centre by an angle in radians. */
export const rotateAbout = (point: Vec, center: Vec, radians: number): Vec =>
  add(center, rotate(subtract(point, center), radians));

/** The direction of a vector in [0, 2π); 0 for the zero vector. */
export const angleOf = (v: Vec): number => normalizeAngle(Math.atan2(v.y, v.x));

/** Whether both coordinates are equal within the tolerance of {@link nearlyEqual}. */
export const vecNearlyEqual = (a: Vec, b: Vec, tolerance?: number): boolean =>
  nearlyEqual(a.x, b.x, tolerance) && nearlyEqual(a.y, b.y, tolerance);
