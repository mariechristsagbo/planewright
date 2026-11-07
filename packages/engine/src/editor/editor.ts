import { resizeViewport } from '../camera/viewport.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import type { Command, CommandId, CommandOutcome } from '../commands/registry.ts';
import type { InputEvent } from '../input/events.ts';
import { createGestureRecogniser } from '../input/recogniser.ts';
import { cameraForWheel, createViewportRouter } from '../input/viewport-routing.ts';
import type { Cancel } from '../ports/ports.ts';
import { createCore, routeGesture, targetOf } from './editor-core.ts';
import type { EditorCore, EditorPorts } from './editor-core.ts';
import type { RenderFrame } from './render-frame.ts';
import { createViewPublisher } from './view.ts';
import type { EditorView } from './view.ts';

// The editor façade (docs/architecture/engine/modules.md#public-surface), as far as the editor
// surface (ENG-08) needs it: input, commands, the viewport, frames and the view. Selection, text
// editing and saving join with their issues.

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

export function createEditor(ports: EditorPorts): Editor {
  const core = createCore(ports);
  const target = targetOf(core);
  const router = createViewportRouter();
  const { view, publish, subscribe, clear } = createViewPublisher(core);
  let disposed = false;

  const alive = (): void => {
    if (disposed) throw new Error('This editor has been disposed.');
  };
  const recogniser = createGestureRecogniser(ports.scheduler, (gesture) => {
    routeGesture(core, router, gesture);
    publish();
  });
  const run = (id: CommandId): CommandOutcome => {
    const outcome = core.registry.run(id, target);
    publish();
    return outcome;
  };

  return {
    get view() {
      return view();
    },
    commands: core.registry.commands.map(commandOf),
    input(event) {
      alive();
      if (event.type === 'wheel') {
        target.setCamera(cameraForWheel(target.camera, event));
        publish();
        return true;
      }
      recogniser.input(event);
      const command = event.type === 'key-down' ? core.registry.forKey(event) : undefined;
      if (command !== undefined) run(command.id);
      return command !== undefined;
    },
    run(id) {
      alive();
      return run(id);
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
      return subscribe(listener);
    },
    dispose() {
      disposed = true;
      recogniser.dispose();
      core.loop.dispose();
      clear();
    },
  };
}
