import type { Camera } from '../../src/camera/camera.ts';
import { INITIAL_DEFAULT_STYLE } from '../../src/model/defaults.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { Style } from '../../src/model/style.ts';
import type { SceneReader } from '../../src/scene/store.ts';
import { hitTest } from '../../src/selection/hit-test.ts';
import type { ToolContext } from '../../src/tools/tool.ts';
import { testId } from './elements.ts';
import { createFixedAdvanceMeasurer } from './fakes.ts';

// What a tool reads, as the editor gives it: the camera, the scene, the selection and the hit test,
// the default style, tool lock, new identifiers and a text measurer with a fixed advance.

export const ZOOM_1: Camera = { x: 0, y: 0, zoom: 1 };

export interface ContextOptions {
  readonly toolLock?: boolean;
  readonly defaults?: Style;
}

/** Identifiers 101, 102, 103… as test identifiers. */
export function newIds(): () => ElementId {
  let count = 100;
  return () => testId((count += 1));
}

/** A tool context over a scene with some elements selected, hit tested as the editor does. */
export function toolContext(
  scene: SceneReader,
  selected: readonly ElementId[],
  camera: Camera = ZOOM_1,
  options: ContextOptions & { readonly newId?: () => ElementId } = {},
): ToolContext {
  return {
    camera,
    scene,
    selection: { ids: selected },
    hit: (at, pointer) => hitTest({ scene, selection: selected, camera }, at, pointer),
    defaults: options.defaults ?? INITIAL_DEFAULT_STYLE,
    toolLock: options.toolLock ?? false,
    newId: options.newId ?? newIds(),
    measurer: createFixedAdvanceMeasurer(),
  };
}
