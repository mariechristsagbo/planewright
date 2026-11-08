import { sceneFromScreen } from '../../src/camera/camera.ts';
import type { Camera } from '../../src/camera/camera.ts';
import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import type { GestureEvent, Tool, ToolEffect } from '../../src/tools/tool.ts';
import { sceneOf } from './elements.ts';
import { NO_MODIFIERS } from './inputs.ts';
import { changeSet } from './scene-state.ts';
import { ZOOM_1, newIds, toolContext } from './tool-contexts.ts';
import type { ContextOptions } from './tool-contexts.ts';

// A tool driven by gestures over a real scene store, as the editor would drive it: previews are
// applied to the store, so a later step sees what the earlier ones showed, and selections replace
// the selection. Points are screen points; the camera turns them into scene points.

export interface RunOptions extends ContextOptions {
  readonly camera?: Camera;
  readonly elements?: readonly Element[];
  readonly selected?: readonly ElementId[];
  readonly pointer?: PointerKind;
}

type PointerType = 'press' | 'drag-start' | 'drag' | 'release' | 'tap' | 'double-tap';

export function toolRun<State>(tool: Tool<State>, options: RunOptions = {}) {
  const camera = options.camera ?? ZOOM_1;
  const scene = sceneOf(...(options.elements ?? []));
  const newId = newIds();
  const run = { selection: [...(options.selected ?? [])], effects: [] as ToolEffect[] };
  let state = tool.initial;
  let seq = 1;
  const apply = (effect: ToolEffect): void => {
    run.effects.push(effect);
    if (effect.type === 'select') run.selection = [...effect.ids];
    if (effect.type === 'commit' && effect.select !== undefined) run.selection = [...effect.select];
    if (effect.type === 'preview') {
      scene.apply({ ...changeSet(effect.changes.elements), seq: (seq += 1) }, 'local');
    }
  };
  const feed = (event: GestureEvent): readonly ToolEffect[] => {
    const context = toolContext(scene, run.selection, camera, { ...options, newId });
    const step = tool.reduce(state, event, context);
    state = step.state;
    step.effects.forEach(apply);
    return step.effects;
  };
  const at = (type: PointerType, x: number, y: number) =>
    feed({
      type,
      at: { x, y },
      scene: sceneFromScreen({ x, y }, camera),
      pointer: options.pointer ?? 'mouse',
      modifiers: NO_MODIFIERS,
    });
  return {
    scene,
    run,
    state: () => state,
    at,
    cancel: () => feed({ type: 'cancel' }),
    /** A press, a drag through the points, then the release at the last one. */
    drag: (...points: readonly (readonly [number, number])[]) => {
      const [first, ...rest] = points;
      if (first === undefined) return;
      at('press', ...first);
      rest.forEach(([x, y], index) => at(index === 0 ? 'drag-start' : 'drag', x, y));
      const last = rest.at(-1) ?? first;
      at('release', ...last);
    },
  };
}
