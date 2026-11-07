import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { panBy } from '../camera/pan.ts';
import { DEFAULT_COMMANDS } from '../commands/defaults.ts';
import { createCommandRegistry } from '../commands/registry.ts';
import type { CommandRegistry, CommandTarget } from '../commands/registry.ts';
import { createHistory } from '../history/history.ts';
import type { History } from '../history/history.ts';
import type { Gesture } from '../input/gestures.ts';
import type { ViewportRouter } from '../input/viewport-routing.ts';
import type { DocumentState } from '../model/document.ts';
import { newClientId } from '../model/ids.ts';
import type { Clock, IdSource, Scheduler } from '../ports/ports.ts';
import type { ChangeSet, ChangeStamp } from '../scene/change-set.ts';
import { createSceneStore } from '../scene/store.ts';
import type { SceneStore } from '../scene/store.ts';
import { createSelection, sameIds } from '../selection/selection.ts';
import type { Selection } from '../selection/selection.ts';
import { activeTool } from '../tools/active.ts';
import type { ActiveTool } from '../tools/active.ts';
import type { CursorKind, GestureEvent, ToolEffect } from '../tools/tool.ts';
import { createRenderLoop } from './render-loop.ts';
import type { RenderLoop } from './render-loop.ts';

// What the editor composes (docs/architecture/engine/modules.md#public-surface): the scene store,
// the selection, the history, the render loop, the command registry and the active tool.

/** The ports that the editor's parts use so far; the others join with the parts that need them. */
export interface EditorPorts {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly ids: IdSource;
}

export interface EditorCore {
  readonly scene: SceneStore;
  readonly selection: Selection;
  readonly history: History;
  readonly loop: RenderLoop;
  readonly registry: CommandRegistry;
  tool: ActiveTool;
  cursor: CursorKind;
}

/** The change set that loads a document into an empty scene store. */
const loadOf = (document: DocumentState, stamp: ChangeStamp): ChangeSet => ({
  elements: [...document.elements.values()].map((element) => ({ type: 'add', element })),
  groups: [...document.groups.values()].map((group) => ({ type: 'add', group })),
  ...stamp,
});

/** A document loaded without an undo step and with nothing selected, its history and render loop. */
export function createCore(ports: EditorPorts, document: DocumentState): EditorCore {
  const scene = createSceneStore(document.canvas);
  const author = newClientId(ports.ids);
  let seq = 0;
  const stamp = (): ChangeStamp => ({ author, seq: (seq += 1) });
  if (document.elements.size > 0 || document.groups.size > 0) {
    scene.apply(loadOf(document, stamp()), 'load');
  }
  const selection = createSelection(scene);
  const history = createHistory({ store: scene, clock: ports.clock, selection, stamp });
  const tool = activeTool('selection');
  return {
    scene,
    selection,
    history,
    loop: createRenderLoop(scene, ports.scheduler),
    registry: createCommandRegistry(DEFAULT_COMMANDS),
    tool,
    cursor: tool.cursor,
  };
}

/** The editor's state as commands read and change it. */
export function targetOf(core: EditorCore): CommandTarget {
  return {
    get tool() {
      return core.tool.id;
    },
    get camera() {
      return core.loop.state().camera;
    },
    get viewport() {
      return core.loop.state().viewport;
    },
    scene: core.scene,
    history: core.history,
    setTool(tool) {
      if (tool === core.tool.id) return;
      core.tool = activeTool(tool);
      core.cursor = core.tool.cursor;
    },
    setCamera(camera) {
      core.loop.update({ camera });
    },
  };
}

/** A tool's view of a gesture, with the scene point under the pointer; null for the camera's. */
export function toolEventOf(gesture: Gesture, camera: Camera): GestureEvent | null {
  if (gesture.type === 'cancel') return gesture;
  if (!('modifiers' in gesture)) return null;
  return { ...gesture, scene: sceneFromScreen(gesture.at, camera) };
}

export function applyEffects(core: EditorCore, effects: readonly ToolEffect[]): void {
  for (const effect of effects) {
    if (effect.type === 'pan') {
      core.loop.update({ camera: panBy(core.loop.state().camera, effect.delta) });
    } else {
      core.cursor = effect.cursor;
    }
  }
}

/** A camera gesture moves the camera; any other but a long press goes to the active tool. */
export function routeGesture(core: EditorCore, router: ViewportRouter, gesture: Gesture): void {
  const camera = core.loop.state().camera;
  const moved = router.gesture(camera, gesture);
  const event = toolEventOf(gesture, camera);
  if (moved !== null) core.loop.update({ camera: moved });
  else if (event !== null) applyEffects(core, core.tool.reduce(event, { camera }));
}

/** Shows the selection on the overlay once it changed, by a tool, a command, the history or a removal. */
export function showSelection(core: EditorCore): void {
  const ids = core.selection.get();
  if (!sameIds(ids, core.loop.state().selection)) core.loop.update({ selection: ids });
}
