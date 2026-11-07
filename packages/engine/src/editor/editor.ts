import { resizeViewport } from '../camera/viewport.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import type { Command, CommandId, CommandOutcome, CommandTarget } from '../commands/registry.ts';
import type { InputEvent } from '../input/events.ts';
import { createGestureRecogniser } from '../input/recogniser.ts';
import type { GestureRecogniser } from '../input/recogniser.ts';
import { cameraForWheel, createViewportRouter } from '../input/viewport-routing.ts';
import { toColor } from '../model/color.ts';
import type { DocumentState } from '../model/document.ts';
import type { ElementId } from '../model/ids.ts';
import type { Cancel } from '../ports/ports.ts';
import { createCore, routeGesture, showSelection, targetOf } from './editor-core.ts';
import type { EditorCore, EditorPorts } from './editor-core.ts';
import type { RenderFrame } from './render-frame.ts';
import { createViewPublisher } from './view.ts';
import type { EditorView, ViewPublisher } from './view.ts';

// The editor façade (docs/architecture/engine/modules.md#public-surface), as far as the editor
// surface (ENG-08) and the selection (ENG-09) need it: input, commands, the selection, the
// viewport, frames and the view. Text editing and saving join with their issues.

export type { EditorPorts } from './editor-core.ts';
export type { EditorView } from './view.ts';

/** A command as a surface shows it: its identifier, label, shortcuts and tool. */
export type EditorCommand = Pick<Command, 'id' | 'label' | 'shortcuts' | 'tool'>;

export interface Editor {
  /** What the interface reads; a new object after every change. */
  readonly view: EditorView;
  /** The registry's commands, in tool bar order for the tools. */
  readonly commands: readonly EditorCommand[];
  /**
   * Feeds one event from the input adapter. Returns true for a wheel event and for a key press
   * that is a command's chord, whose browser default the host then prevents.
   */
  input(event: InputEvent): boolean;
  /** Runs a command, as the tool bar or a test does. */
  run(command: CommandId): CommandOutcome;
  /**
   * Replaces the selection with the given elements that the document holds, each once, in order;
   * never an undo step (REQ-S13).
   */
  select(ids: readonly ElementId[]): void;
  /** The canvas size in CSS pixels and the device pixel ratio, from the canvas host. */
  resize(size: ViewportSize): void;
  /** Hands the listener every frame built on an animation frame, starting with a full one. */
  onFrame(listener: (frame: RenderFrame) => void): Cancel;
  subscribe(listener: (view: EditorView) => void): Cancel;
  dispose(): void;
}

const commandOf = ({ id, label, shortcuts, tool }: Command): EditorCommand =>
  tool === undefined ? { id, label, shortcuts } : { id, label, shortcuts, tool };

/** A canvas that had no size yet keeps the camera; a resize keeps the viewport's centre in place. */
function resize(core: EditorCore, size: ViewportSize): void {
  const previous = core.loop.state().viewport;
  core.loop.update({ viewport: size });
  if (previous.width > 0 || previous.height > 0) {
    core.loop.update({ camera: resizeViewport(core.loop.state().camera, previous, size) });
  }
}

const EMPTY_DOCUMENT: DocumentState = {
  elements: new Map(),
  groups: new Map(),
  canvas: { background: toColor('#ffffff') },
  rev: 0,
};

/** An editor over an empty document on a white canvas; stored documents join with ENG-13. */
export function createEditor(ports: EditorPorts): Editor {
  return openEditor(ports, EMPTY_DOCUMENT);
}

/** The editor's parts, wired: gestures reach the tool, and each change ends in `publish`. */
interface Wiring {
  readonly core: EditorCore;
  readonly target: CommandTarget;
  readonly recogniser: GestureRecogniser;
  readonly views: ViewPublisher;
  /** Shows the selection on the overlay, then tells the view's listeners of any change. */
  readonly publish: () => void;
  readonly run: (id: CommandId) => CommandOutcome;
}

function wire(ports: EditorPorts, document: DocumentState): Wiring {
  const core = createCore(ports, document);
  const router = createViewportRouter();
  const views = createViewPublisher(core);
  const publish = (): void => {
    showSelection(core);
    views.publish();
  };
  const recogniser = createGestureRecogniser(ports.scheduler, (gesture) => {
    routeGesture(core, router, gesture);
    publish();
  });
  const target = targetOf(core);
  const run = (id: CommandId): CommandOutcome => {
    const outcome = core.registry.run(id, target);
    publish();
    return outcome;
  };
  return { core, target, recogniser, views, publish, run };
}

/** A wheel event goes to the camera; any other to the recogniser, and a chord runs its command. */
function input({ core, target, recogniser, publish, run }: Wiring, event: InputEvent): boolean {
  if (event.type === 'wheel') {
    target.setCamera(cameraForWheel(target.camera, event));
    publish();
    return true;
  }
  recogniser.input(event);
  const command = event.type === 'key-down' ? core.registry.forKey(event) : undefined;
  if (command !== undefined) run(command.id);
  return command !== undefined;
}

/**
 * An editor over a document, loaded without an undo step and with nothing selected. The entry
 * does not export it: the engine's tests open fixture documents with it until ENG-13 gives
 * `createEditor` a stored document.
 */
export function openEditor(ports: EditorPorts, document: DocumentState): Editor {
  const wiring = wire(ports, document);
  const { core, recogniser, views, publish, run } = wiring;
  let disposed = false;
  const alive = (): void => {
    if (disposed) throw new Error('This editor has been disposed.');
  };
  return {
    get view() {
      return views.view();
    },
    commands: core.registry.commands.map(commandOf),
    input(event) {
      alive();
      return input(wiring, event);
    },
    run(id) {
      alive();
      return run(id);
    },
    select(ids) {
      alive();
      core.selection.set(ids);
      publish();
    },
    resize(size) {
      alive();
      resize(core, size);
      publish();
    },
    onFrame(listener) {
      alive();
      return core.loop.onFrame(listener);
    },
    subscribe(listener) {
      alive();
      return views.subscribe(listener);
    },
    dispose() {
      disposed = true;
      recogniser.dispose();
      core.loop.dispose();
      views.clear();
    },
  };
}
