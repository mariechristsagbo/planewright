import type { Camera } from '../../src/camera/camera.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { SceneReader } from '../../src/scene/store.ts';
import { hitTest } from '../../src/selection/hit-test.ts';
import type { ToolContext } from '../../src/tools/tool.ts';

// What a tool reads, as the editor gives it: the camera, the scene, the selection and the hit test.

export const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };

/** A tool context over a scene with some elements selected, hit tested as the editor does. */
export function toolContext(
  scene: SceneReader,
  selected: readonly ElementId[],
  camera: Camera = ZOOM_1,
): ToolContext {
  return {
    camera,
    scene,
    selection: { ids: selected },
    hit: (at, pointer) => hitTest({ scene, selection: selected, camera }, at, pointer),
  };
}
