import { describe, expect, it } from 'vitest';

import type { Camera } from '../../../src/camera/camera.ts';
import type { ViewportSize } from '../../../src/camera/viewport.ts';
import { CULL_MARGIN, visibleElements } from '../../../src/editor/visible.ts';
import { aabbIntersects } from '../../../src/math/aabb.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import { worldBounds } from '../../../src/geometry/world-bounds.ts';
import { compareDrawingOrder } from '../../../src/model/order-key.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { anyCamera } from '../../support/cameras.ts';
import { anySceneLoad } from '../../support/edits.ts';
import { sceneOf, shapeElement } from '../../support/elements.ts';
import { checkProperty } from '../../support/property.ts';
import { color } from '../../support/scene-state.ts';

// Culling (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer): the
// scene layer draws the elements whose world bounds meet the viewport's scene box grown by 64
// screen pixels, found through the spatial index, in drawing order.

const VIEWPORT: ViewportSize = { width: 800, height: 600, pixelRatio: 1 };
const AT_ORIGIN: Camera = { x: 0, y: 0, zoom: 1 };

/** A 10 × 10 rectangle whose 2-unit stroke reaches 1 unit past its box on every side. */
const square = (id: number, x: number, y: number, order = 'V') =>
  shapeElement('rectangle', 10, 10, { id, x, y, order });

const ids = (elements: readonly { readonly id: string }[]) => elements.map(({ id }) => id);

describe('the visible elements of a render frame', () => {
  it('is 64 screen pixels around the viewport', () => {
    expect(CULL_MARGIN).toBe(64);
  });

  it('REQ-F01 keeps the elements that meet the viewport grown by the margin and drops the rest', () => {
    // The grown box runs from −64 to 864 across and from −64 to 664 down.
    const inside = square(1, 100, 100);
    // Their strokes end exactly on the grown edges.
    const edges = [
      square(2, -75, 100),
      square(3, 865, 100),
      square(4, 100, -75),
      square(5, 100, 665),
    ];
    // One unit further out on each side.
    const outside = [
      square(6, -76, 100),
      square(7, 866, 100),
      square(8, 100, -76),
      square(9, 100, 666),
    ];
    const scene = sceneOf(inside, ...edges, ...outside);
    expect(ids(visibleElements(scene, AT_ORIGIN, VIEWPORT)).sort()).toEqual(
      ids([inside, ...edges]).sort(),
    );
  });

  it('measures the margin in screen pixels, so it covers fewer scene units at a higher zoom', () => {
    // At zoom 2 the camera at (50, 50) shows scene x 50 to 450; 64 px are 32 units.
    const camera: Camera = { x: 50, y: 50, zoom: 2 };
    const near = square(1, 7, 100); // its stroke ends at x 18 = 50 − 32
    const far = square(2, 6, 100);
    const end = square(3, 483, 100); // its stroke starts at x 482 = 450 + 32
    const beyond = square(4, 484, 100);
    const scene = sceneOf(near, far, end, beyond);
    expect(ids(visibleElements(scene, camera, VIEWPORT)).sort()).toEqual(ids([near, end]).sort());
  });

  it('lists them bottom first in drawing order, equal keys by identifier', () => {
    const top = square(1, 10, 10, 'k');
    const bottom = square(2, 20, 20, 'a');
    const middleFirst = square(3, 30, 30, 'b');
    const middleSecond = square(4, 40, 40, 'b');
    const scene = sceneOf(top, middleSecond, bottom, middleFirst);
    expect(ids(visibleElements(scene, AT_ORIGIN, VIEWPORT))).toEqual(
      ids([bottom, middleFirst, middleSecond, top]),
    );
  });

  it('draws nothing from an empty scene', () => {
    expect(visibleElements(sceneOf(), AT_ORIGIN, VIEWPORT)).toEqual([]);
  });
});

function anyView(random: Random) {
  return {
    load: anySceneLoad(random, 30),
    camera: anyCamera(random, 5_000),
    viewport: {
      width: randomBetween(random, 0, 2_000),
      height: randomBetween(random, 0, 2_000),
      pixelRatio: 1,
    },
  };
}

describe('culling over the spatial index', () => {
  it('REQ-F01 finds what a scan of every element finds, in drawing order', () => {
    checkProperty({ seed: 7101, runs: 200 }, anyView, ({ load, camera, viewport }) => {
      const scene = createSceneStore({ background: color('#ffffff') });
      scene.apply(load, 'load');
      const margin = CULL_MARGIN / camera.zoom;
      const box = {
        x: camera.x - margin,
        y: camera.y - margin,
        width: viewport.width / camera.zoom + 2 * margin,
        height: viewport.height / camera.zoom + 2 * margin,
      };
      const expected = scene
        .ordered()
        .filter((element) => aabbIntersects(worldBounds(element), box))
        .sort(compareDrawingOrder);
      expect(ids(visibleElements(scene, camera, viewport))).toEqual(ids(expected));
    });
  });
});
