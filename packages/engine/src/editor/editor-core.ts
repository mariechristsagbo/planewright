import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { panBy } from '../camera/pan.ts';
import { DEFAULT_COMMANDS } from '../commands/defaults.ts';
import { createCommandRegistry } from '../commands/registry.ts';
import type { CommandRegistry, CommandTarget, EditOptions } from '../commands/registry.ts';
import { createHistory } from '../history/history.ts';
import type { History } from '../history/history.ts';
import type { Transaction } from '../history/transaction.ts';
import type { Gesture } from '../input/gestures.ts';
import type { ViewportRouter } from '../input/viewport-routing.ts';
import type { HistoryLabel } from '../history/entry.ts';
import { INITIAL_DEFAULT_STYLE } from '../model/defaults.ts';
import type { DocumentState } from '../model/document.ts';
import { newClientId, newElementId } from '../model/ids.ts';
import type { ElementId } from '../model/ids.ts';
import type { Style } from '../model/style.ts';
import type { Clock, IdSource, Scheduler } from '../ports/ports.ts';
import { isEmptyChangeSet } from '../scene/change-set.ts';
import type { ChangeSet, ChangeStamp, UnstampedChangeSet } from '../scene/change-set.ts';
import { createSceneStore } from '../scene/store.ts';
import type { SceneStore } from '../scene/store.ts';
import { hitTest } from '../selection/hit-test.ts';
import { createSelection, sameIds } from '../selection/selection.ts';
import type { Selection } from '../selection/selection.ts';
import { activeTool, isCreationTool } from '../tools/active.ts';
import type { ActiveTool } from '../tools/active.ts';
import type { CursorKind, GestureEvent, ToolContext, ToolEffect, ToolId } from '../tools/tool.ts';
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
  /** The stamp of the session's next local change set. */
  readonly stamp: () => ChangeStamp;
  readonly newId: () => ElementId;
  /** Counts the key presses and runs that start commands; a held key's repeats count once. */
  keyPresses: number;
  tool: ActiveTool;
  cursor: CursorKind;
  /** Whether a creation tool stays active after a creation (REQ-C05). */
  toolLock: boolean;
  /** The current default style, which new elements take (REQ-C12). */
  readonly defaults: Style;
  /** The transaction of the tool's gesture: open from its first preview to its commit or cancel. */
  transaction: Transaction | null;
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
    stamp,
    newId: () => newElementId(ports.ids),
    keyPresses: 0,
    tool,
    cursor: tool.cursor,
    toolLock: false,
    defaults: INITIAL_DEFAULT_STYLE,
    transaction: null,
  };
}

/**
 * A command's change: one transaction, so one undo step, with the selection after it. The
 * selection is set before the commit, which records it for redo, and again after it, because the
 * commit's transient revert drops elements that the preview added from the selection (the ENG-06
 * review's m2, open until the selection layer keeps them).
 */
function edit(
  core: EditorCore,
  label: HistoryLabel,
  changes: UnstampedChangeSet,
  options: EditOptions = {},
): void {
  const transaction = core.history.begin();
  try {
    transaction.preview({ ...changes, ...core.stamp() });
    if (options.select !== undefined) core.selection.set(options.select);
  } catch (error) {
    transaction.cancel();
    throw error;
  }
  transaction.commit(label, options.mergeKey === undefined ? {} : { mergeKey: options.mergeKey });
  if (options.select !== undefined) core.selection.set(options.select);
}

/**
 * Makes a tool active in its initial state with its cursor. Choosing a creation tool clears the
 * selection (docs/architecture/engine/interaction.md#p0-tools).
 */
function switchTool(core: EditorCore, tool: ToolId): void {
  core.tool = activeTool(tool);
  core.cursor = core.tool.cursor;
  if (isCreationTool(tool)) core.selection.set([]);
}

/**
 * The editor's state as commands read and change it, with the recogniser's gesture cancel; a tool
 * change cancels the old tool's gesture first.
 */
export function targetOf(core: EditorCore, cancelGesture: () => boolean): CommandTarget {
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
      // As Escape does, so the old tool removes what its gesture shows, such as a marquee, and the
      // pointer does nothing until it lifts.
      cancelGesture();
      switchTool(core, tool);
    },
    setCamera(camera) {
      core.loop.update({ camera });
    },
    select(ids) {
      core.selection.set(ids);
    },
    cancelGesture,
    get selection() {
      return core.selection.get();
    },
    newId: core.newId,
    get keyPress() {
      return core.keyPresses;
    },
    edit(label, changes, options) {
      edit(core, label, changes, options);
    },
  };
}

/** A tool's view of a gesture, with the scene point under the pointer; null for the camera's. */
export function toolEventOf(gesture: Gesture, camera: Camera): GestureEvent | null {
  if (gesture.type === 'cancel') return gesture;
  if (!('modifiers' in gesture)) return null;
  return { ...gesture, scene: sceneFromScreen(gesture.at, camera) };
}

type EditEffect = Extract<ToolEffect, { readonly type: 'preview' | 'commit' | 'cancel' }>;

/**
 * Commits a gesture's transaction. Its selection after is set before the commit, which records it
 * for redo, and again after it, because the commit's transient revert drops the elements that its
 * previews added from the selection (the ENG-06 review's m2), as `edit` does for commands.
 */
function commit(
  core: EditorCore,
  transaction: Transaction,
  effect: { readonly label: HistoryLabel; readonly select?: readonly ElementId[] },
): void {
  if (effect.select !== undefined) core.selection.set(effect.select);
  transaction.commit(effect.label);
  if (effect.select !== undefined) core.selection.set(effect.select);
}

/**
 * A gesture's document changes: its first preview opens its transaction, so undo and redo are
 * ignored until it closes (REQ-H06); its commit records one undo step and its cancel reverts it.
 */
function applyEdit(core: EditorCore, effect: EditEffect): void {
  if (effect.type === 'preview') {
    core.transaction ??= core.history.begin();
    if (!isEmptyChangeSet(effect.changes)) {
      core.transaction.preview({ ...effect.changes, ...core.stamp() });
    }
    return;
  }
  const { transaction } = core;
  core.transaction = null;
  if (transaction === null) return;
  if (effect.type === 'commit') commit(core, transaction, effect);
  else transaction.cancel();
}

function applyEffect(core: EditorCore, effect: ToolEffect): void {
  switch (effect.type) {
    case 'pan':
      core.loop.update({ camera: panBy(core.loop.state().camera, effect.delta) });
      break;
    case 'cursor':
      core.cursor = effect.cursor;
      break;
    case 'select':
      core.selection.set(effect.ids);
      break;
    case 'marquee':
      core.loop.update({ marquee: effect.box });
      break;
    case 'set-tool':
      // The gesture has ended, so there is nothing to cancel.
      switchTool(core, effect.tool);
      break;
    case 'preview':
    case 'commit':
    case 'cancel':
      applyEdit(core, effect);
      break;
  }
}

/**
 * What the active tool reads: the camera, the scene, the selection and the hit test over them, the
 * default style, tool lock and the identifier source.
 */
function contextOf(core: EditorCore, camera: Camera): ToolContext {
  const ids = core.selection.get();
  const view = { scene: core.scene, selection: ids, camera };
  return {
    camera,
    scene: core.scene,
    selection: { ids },
    hit: (at, pointer) => hitTest(view, at, pointer),
    defaults: core.defaults,
    toolLock: core.toolLock,
    newId: core.newId,
  };
}

/** The handles are drawn for the pointer that pressed last: 8 px for a mouse or pen, 12 for touch. */
function sizeHandlesFor(core: EditorCore, event: GestureEvent): void {
  if (event.type === 'press' && event.pointer !== core.loop.state().pointer) {
    core.loop.update({ pointer: event.pointer });
  }
}

/** A camera gesture moves the camera; any other but a long press goes to the active tool. */
export function routeGesture(core: EditorCore, router: ViewportRouter, gesture: Gesture): void {
  const camera = core.loop.state().camera;
  const moved = router.gesture(camera, gesture);
  const event = toolEventOf(gesture, camera);
  if (moved !== null) {
    core.loop.update({ camera: moved });
  } else if (event !== null) {
    sizeHandlesFor(core, event);
    for (const effect of core.tool.reduce(event, contextOf(core, camera)))
      applyEffect(core, effect);
  }
}

/** Shows the selection on the overlay once it changed, by a tool, a command, the history or a removal. */
export function showSelection(core: EditorCore): void {
  const ids = core.selection.get();
  if (!sameIds(ids, core.loop.state().selection)) core.loop.update({ selection: ids });
}
