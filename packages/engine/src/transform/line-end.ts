import { add, rotate } from '../math/vector.ts';
import type { LineElement, Point } from '../model/elements.ts';
import { normalizePoints } from '../model/points.ts';

/**
 * A two-point line with one end moved by a scene delta and the other where it was
 * (docs/architecture/engine/interaction.md#transforms): the delta is turned into the line's own
 * frame, and the points are normalised again without moving the drawing.
 */
export function moveLineEnd(line: LineElement, end: 'start' | 'end', delta: Point): LineElement {
  const index = end === 'start' ? 0 : line.points.length - 1;
  const local = line.rotation === 0 ? delta : rotate(delta, -line.rotation);
  const points = line.points.map((point, at) => (at === index ? add(point, local) : point));
  return { ...line, ...normalizePoints(line, points) };
}
