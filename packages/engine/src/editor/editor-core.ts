import { sceneFromScreen } from '../camera/camera.ts';
import type { Camera } from '../camera/camera.ts';
import { panBy } from '../camera/pan.ts';
import type { TextMeasurer } from '../geometry/text-measurer.ts';
import { DEFAULT_COMMANDS } from '../commands/defaults.ts';
import { createCommandRegistry } from '../commands/registry.ts';
import type { CommandRegistry, CommandTarget } from '../commands/registry.ts';
import { createHistory } from '../history/history.ts';
import type { History } from '../history/history.ts';
import type { Transaction } from '../history/transaction.ts';
import type { Gesture } from '../input/gestures.ts';
import type { ViewportRouter } from '../input/viewport-routing.ts';
import { INITIAL_DEFAULT_STYLE } from '../model/defaults.ts';
import type { DocumentState } from '../model/document.ts';
import { newClientId, newElementId } from '../model/ids.ts';
import type { ElementId } from '../model/ids.ts';
import type { Style } from '../model/style.ts';
import type { SaveStatus } from '../persistence/autosave.ts';
import type { DocumentRepository } from '../persistence/repository.ts';
import type { Clock, IdSource, Scheduler } from '../ports/ports.ts';
import type { ChangeSet, ChangeStamp } from '../scene/change-set.ts';
import { createSceneStore } from '../scene/store.ts';
import type { SceneStore } from '../scene/store.ts';
import { hitTest } from '../selection/hit-test.ts';
import { createSelection, sameIds } from '../selection/selection.ts';
import type { Selection } from '../selection/selection.ts';
import { activeTool, isCreationTool } from '../tools/active.ts';
import type { ActiveTool } from '../tools/active.ts';
import type { CursorKind, GestureEvent, ToolContext, ToolEffect, ToolId } from '../tools/tool.ts';
import type { Announcer } from './announcer.ts';
import { notingHistory } from './announcing.ts';
import type { Note } from './announcing.ts';
import { applyEdit, edit } from './edits.ts';
import { createRenderLoop } from './render-loop.ts';
import type { RenderLoop } from './render-loop.ts';
import { endSession, startSession } from './text-session.ts';
import type { TextSession } from './text-session.ts';

// What the editor composes (docs/architecture/engine/modules.md#public-surface): the scene store,
// the selection, the history, the render loop, the command registry, the active tool and the text
// session.

/** The ports that the editor's parts use so far; the others join with the parts that need them. */
export interface EditorPorts {
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly ids: IdSource;
  /** Measures texts in their fonts (docs/architecture/engine/modules.md#ports). */
  readonly text: TextMeasurer;
  /** Where documents are saved; without one, the editor saves nothing. */
  readonly repository?: DocumentRepository;
  /** Where announcements go (REQ-Y04); without one, the editor announces nothing. */
  readonly announcer?: Announcer;
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
  readonly measurer: TextMeasurer;
  /** The text being edited, which holds its own transaction. */
  session: TextSession | null;
  /** What saving reports, or null for an editor without a repository. */
  saveStatus: SaveStatus | null;
  /** Texts are to be measured again once the open transaction ends. */
  measureLater: boolean;
  /** The history entries committed, undone or redone since the last announcement. */
  readonly notes: Note[];
}

/** The change set that loads a document into an empty scene store. */
export const loadOf = (document: DocumentState, stamp: ChangeStamp): ChangeSet => ({
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
  const notes: Note[] = [];
  const history = notingHistory(
    createHistory({ store: scene, clock: ports.clock, selection, stamp }),
    notes,
  );
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
    measurer: ports.text,
    session: null,
    saveStatus: null,
    measureLater: false,
    notes,
  };
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
 * Ends the text session, if one is open; the Selection tool then becomes active, unless tool lock
 * is on (docs/architecture/engine/interaction.md#text-editing).
 */
export function finishText(core: EditorCore): void {
  if (endSession(core) && !core.toolLock && core.tool.id !== 'selection') {
    switchTool(core, 'selection');
  }
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
      finishText(core);
      switchTool(core, tool);
    },
    get toolLock() {
      return core.toolLock;
    },
    setToolLock(on) {
      core.toolLock = on;
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
    tapCentre() {
      tapCentre(core);
    },
    editText(id) {
      startSession(core, id);
    },
  };
}

/** A tool's view of a gesture, with the scene point under the pointer; null for the camera's. */
export function toolEventOf(gesture: Gesture, camera: Camera): GestureEvent | null {
  if (gesture.type === 'cancel') return gesture;
  if (!('modifiers' in gesture)) return null;
  return { ...gesture, scene: sceneFromScreen(gesture.at, camera) };
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
    case 'edit-text':
      startSession(core, effect.id);
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
    measurer: core.measurer,
  };
}

/**
 * Gives the active tool a tap at the centre of the viewport, with no modifier, as the keyboard's
 * Enter does (docs/architecture/engine/quality.md#accessibility).
 */
function tapCentre(core: EditorCore): void {
  const { camera, viewport } = core.loop.state();
  const at = { x: viewport.width / 2, y: viewport.height / 2 };
  const modifiers = { shift: false, alt: false, mod: false };
  const scene = sceneFromScreen(at, camera);
  const tap: GestureEvent = { type: 'tap', at, scene, pointer: 'mouse', modifiers };
  for (const effect of core.tool.reduce(tap, contextOf(core, camera))) {
    applyEffect(core, effect);
  }
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
    // A press outside the text area commits the text being edited.
    if (event.type === 'press') finishText(core);
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
