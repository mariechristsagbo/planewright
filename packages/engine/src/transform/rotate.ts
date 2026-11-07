import { localBox } from '../geometry/world-bounds.ts';
import { aabbCenter } from '../math/aabb.ts';
import { degreesToRadians, normalizeAngle, snapAngle } from '../math/angle.ts';
import { angleOf, rotateAbout, subtract } from '../math/vector.ts';
import type { Element, Point } from '../model/elements.ts';

// Rotation (docs/architecture/engine/interaction.md#transforms, REQ-T06): the angle is the change
// in the pointer's direction around the outline's centre, and Shift rounds the total to 15° steps.

/** The step that Shift rounds a rotation to. */
export const ROTATION_STEP = degreesToRadians(15);

/**
 * The elements turned by the pointer's move from `from` to `to` around `center`. One element turns
 * about its own centre, which is `center`, and Shift rounds its own rotation; several turn their
 * centres about `center`, and Shift rounds the angle that they all turn by.
 */
export function rotateElements(
  elements: readonly Element[],
  center: Point,
  [from, to]: readonly [Point, Point],
  snap: boolean,
): Element[] {
  const turn = angleOf(subtract(to, center)) - angleOf(subtract(from, center));
  const [only, ...others] = elements;
  if (only !== undefined && others.length === 0) {
    const total = only.rotation + turn;
    return [{ ...only, rotation: snap ? snapAngle(total, ROTATION_STEP) : normalizeAngle(total) }];
  }
  const angle = snap ? snapAngle(turn, ROTATION_STEP) : turn;
  return elements.map((element) => {
    const box = localBox(element);
    const centre = rotateAbout(aabbCenter(box), center, angle);
    return {
      ...element,
      x: centre.x - box.width / 2,
      y: centre.y - box.height / 2,
      rotation: normalizeAngle(element.rotation + angle),
    };
  });
}
