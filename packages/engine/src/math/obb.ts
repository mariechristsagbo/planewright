import { aabbCenter, aabbContainsPoint, aabbFromPoints } from './aabb.ts';
import type { Aabb } from './aabb.ts';
import { multiplyMatrices, rotationMatrix, translationMatrix } from './matrix.ts';
import type { Matrix } from './matrix.ts';
import { rotateAbout } from './vector.ts';
import type { Vec } from './vector.ts';

/**
 * An oriented box: an unrotated box, its top-left corner and size, turned by `rotation` radians
 * about its centre. Every element is placed this way (ADR 0005). Local coordinates are measured
 * from the unrotated box's top-left corner, along its own axes.
 */
export interface Obb extends Aabb {
  readonly rotation: number;
}

/** The centre, which the rotation leaves in place. */
export const obbCenter = (obb: Obb): Vec => aabbCenter(obb);

/** The transform from local coordinates to scene coordinates. */
export function obbMatrix(obb: Obb): Matrix {
  const center = obbCenter(obb);
  const fromCorner = translationMatrix(-obb.width / 2, -obb.height / 2);
  const turned = multiplyMatrices(rotationMatrix(obb.rotation), fromCorner);
  return multiplyMatrices(translationMatrix(center.x, center.y), turned);
}

export const obbToScene = (obb: Obb, local: Vec): Vec =>
  rotateAbout({ x: obb.x + local.x, y: obb.y + local.y }, obbCenter(obb), obb.rotation);

/** Subtracts the origin after turning back by the rotation about the centre. */
export function obbToLocal(obb: Obb, scene: Vec): Vec {
  const unturned = rotateAbout(scene, obbCenter(obb), -obb.rotation);
  return { x: unturned.x - obb.x, y: unturned.y - obb.y };
}

/** The scene positions of the local top-left, top-right, bottom-right and bottom-left corners. */
export function obbCorners(obb: Obb): readonly [Vec, Vec, Vec, Vec] {
  const { width, height } = obb;
  return [
    obbToScene(obb, { x: 0, y: 0 }),
    obbToScene(obb, { x: width, y: 0 }),
    obbToScene(obb, { x: width, y: height }),
    obbToScene(obb, { x: 0, y: height }),
  ];
}

/** The axis-aligned bounds of the turned box. */
export const obbBounds = (obb: Obb): Aabb => aabbFromPoints(obbCorners(obb));

/** Whether a scene point lies inside the turned box, edges included. */
export const obbContainsPoint = (obb: Obb, scene: Vec): boolean =>
  aabbContainsPoint({ x: 0, y: 0, width: obb.width, height: obb.height }, obbToLocal(obb, scene));
