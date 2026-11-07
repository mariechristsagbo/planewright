import type { Camera } from '../../src/camera/camera.ts';
import { randomBetween } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Vec } from '../../src/math/vector.ts';

/** A zoom spread evenly on a log scale over the limits [0.1, 30]. */
export const anyZoom = (random: Random): number =>
  Math.min(30, Math.max(0.1, Math.exp(randomBetween(random, Math.log(0.1), Math.log(30)))));

/** A coordinate whose magnitude is spread on a log scale up to `limit`, of either sign. */
export const anyCoordinate = (random: Random, limit: number): number =>
  randomBetween(random, -1, 1) * limit ** random.next();

/** A camera within the limits, with each coordinate of its position within `limit` of 0. */
export const anyCamera = (random: Random, limit: number): Camera => ({
  x: anyCoordinate(random, limit),
  y: anyCoordinate(random, limit),
  zoom: anyZoom(random),
});

/** A screen point anywhere on a canvas up to 4,000 CSS px wide and tall, or a little beyond it. */
export const anyScreenPoint = (random: Random): Vec => ({
  x: randomBetween(random, -500, 4500),
  y: randomBetween(random, -500, 4500),
});

/** How far apart two points are on either axis, the larger of the two. */
export const gap = (a: Vec, b: Vec): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
