import { describe, expect, it } from 'vitest';

import { sceneFromScreen, screenFromScene } from '../../../src/camera/camera.ts';
import { worldBounds } from '../../../src/geometry/world-bounds.ts';
import { randomBetween } from '../../../src/math/random.ts';
import type { Random } from '../../../src/math/random.ts';
import type { ChangeSet } from '../../../src/scene/change-set.ts';
import { createSceneStore } from '../../../src/scene/store.ts';
import { hitsElement } from '../../../src/selection/element-hit.ts';
import { hitTest } from '../../../src/selection/hit-test.ts';
import { HIT_TOLERANCE } from '../../../src/selection/pointer.ts';
import { anyCamera } from '../../support/cameras.ts';
import { anySceneLoad } from '../../support/edits.ts';
import { SOLID } from '../../support/elements.ts';
import { checkProperty } from '../../support/property.ts';
import { color } from '../../support/scene-state.ts';
import { chance, pick } from '../../support/scenes.ts';

/** A random scene, half of whose elements are filled, and a press near one of its elements. */
function anyPress(random: Random) {
  const load = anySceneLoad(random, 30);
  const changes: ChangeSet = {
    ...load,
    elements: load.elements.map((change) =>
      change.type === 'add' && chance(random, 0.5)
        ? {
            ...change,
            element: { ...change.element, style: { ...change.element.style, fill: SOLID } },
          }
        : change,
    ),
  };
  const targets = changes.elements.flatMap((change) =>
    change.type === 'add' ? [change.element] : [],
  );
  const around =
    targets.length === 0
      ? { x: 0, y: 0, width: 100, height: 100 }
      : worldBounds(pick(random, targets));
  const point = {
    x: randomBetween(random, around.x - 20, around.x + around.width + 20),
    y: randomBetween(random, around.y - 20, around.y + around.height + 20),
  };
  const camera = anyCamera(random, 5_000);
  const pointer = pick(random, ['mouse', 'pen', 'touch'] as const);
  return { changes, camera, screen: screenFromScene(point, camera), pointer };
}

describe('hit testing over the spatial index', () => {
  it('REQ-S04 finds what a scan of every element finds: the topmost one that the press hits', () => {
    checkProperty({ seed: 6103, runs: 300 }, anyPress, ({ changes, camera, screen, pointer }) => {
      const scene = createSceneStore({ background: color('#ffffff') });
      scene.apply(changes, 'load');
      const point = sceneFromScreen(screen, camera);
      const tolerance = HIT_TOLERANCE[pointer] / camera.zoom;
      const top = [...scene.ordered()]
        .reverse()
        .find((element) => hitsElement(element, point, tolerance));
      const expected = top === undefined ? { type: 'none' } : { type: 'element', id: top.id };
      expect(hitTest({ scene, selection: [], camera }, screen, pointer)).toStrictEqual(expected);
    });
  });
});
