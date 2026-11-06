import { TAU } from '../../src/math/angle.ts';
import { randomBetween } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Vec } from '../../src/math/vector.ts';

/** A point with both coordinates in [−limit, limit). */
export const pointWithin = (random: Random, limit: number): Vec => ({
  x: randomBetween(random, -limit, limit),
  y: randomBetween(random, -limit, limit),
});

/** An angle in [0, 2π). */
export const anyAngle = (random: Random): number => randomBetween(random, 0, TAU);
