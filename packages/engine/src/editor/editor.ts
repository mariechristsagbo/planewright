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
import type { StoredDocument } from '../persistence/repository.ts';
import type { Cancel } from '../ports/ports.ts';
import { createCore, finishText, routeGesture, showSelection, targetOf } from './editor-core.ts';
import type { EditorCore, EditorPorts } from './editor-core.ts';
import { showSession } from './load.ts';
import { measureTexts, measureWaiting } from './measure.ts';
import type { RenderFrame } from './render-frame.ts';
import { createSaving } from './saving.ts';
import type { Saving, StaleChoice } from './saving.ts';
import { editSession } from './text-session.ts';
import type { TextEdit } from './text-session.ts';
import { createViewPublisher } from './view.ts';
import type { EditorView, ViewPublisher } from './view.ts';

// The editor façade (docs/architecture/engine/modules.md#public-surface), as far as the editor
// surface (ENG-08), the selection (ENG-09), text editing (ENG-12) and saving (ENG-13) need it:
// input, commands, the selection, text edits, the viewport, frames, saving and the view.

export type { EditorPorts } from './editor-core.ts';
export type { EditorView } from './view.ts';
export type { TextEdit, TextEditView } from './text-session.ts';
export type { StaleChoice } from './saving.ts';

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
  /**
   * Takes the text area's value, which the edited text shows measured again, or ends the session
   * on Escape or Mod+Enter (REQ-C09, REQ-C10); nothing happens when no text is edited.
   */
  editText(edit: TextEdit): void;
  /** The canvas size in CSS pixels and the device pixel ratio, from the canvas host. */
  resize(size: ViewportSize): void;
  /**
   * Measures every text again through the text port, as the web app asks when a font finishes
   * loading: a text whose size changed is updated, with no undo step, and saved. While a gesture
   * or a text session is open, it waits until that ends.
   */
  measureTexts(): void;
  /**
   * Starts a waiting save at once, as the web app asks when the page is hidden or unloaded
   * (REQ-P01); nothing happens without a repository.
   */
  saveNow(): void;
  /**
   * The user's answer to another tab's newer save (REQ-P06): `load` shows the stored version as a
   * reload would, dropping what this editor had not saved; `keep` writes this whole document over
   * it. Nothing happens unless the last save was refused as stale.
   */
  resolveStale(choice: StaleChoice): Promise<void>;
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

/**
 * An editor over a stored document, with its camera and selection, the Selection tool and an
 * empty history (REQ-P02, REQ-H03), or over an empty document on a white canvas. With a
 * repository among its ports it saves the document there (REQ-P01).
 */
export function createEditor(ports: EditorPorts, stored?: StoredDocument): Editor {
  return openEditor(ports, stored?.document ?? EMPTY_DOCUMENT, stored);
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
    measureWaiting(core);
    showSelection(core);
    views.publish();
  };
  const recogniser = createGestureRecogniser(ports.scheduler, (gesture) => {
    routeGesture(core, router, gesture);
    publish();
  });
  const target = targetOf(core, () => recogniser.cancel());
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
  if (event.type === 'key-down' && !event.repeat) core.keyPresses += 1;
  const command = event.type === 'key-down' ? core.registry.forKey(event) : undefined;
  if (command !== undefined) run(command.id);
  return command !== undefined;
}

/** Shows the stored session, if there is one, then starts saving where the ports allow it. */
function savingFor(ports: EditorPorts, wiring: Wiring, stored: StoredDocument | undefined): Saving {
  if (stored !== undefined) {
    showSession(wiring.core, stored.session);
    wiring.publish();
  }
  return createSaving(ports, stored, wiring);
}

/** What the editor does for the document as a whole: measuring texts again and saving. */
const documentMethods = (
  { core, publish }: Wiring,
  saving: Saving,
  alive: () => void,
): Pick<Editor, 'measureTexts' | 'saveNow' | 'resolveStale'> => ({
  measureTexts() {
    alive();
    measureTexts(core);
    publish();
  },
  saveNow() {
    alive();
    saving.saveNow();
  },
  resolveStale(choice) {
    alive();
    return saving.resolveStale(choice);
  },
});

/**
 * An editor over a document, loaded without an undo step, with the stored session if there is one
 * and nothing selected otherwise. The entry does not export it: the engine's tests open fixture
 * documents with it.
 */
export function openEditor(
  ports: EditorPorts,
  document: DocumentState,
  stored?: StoredDocument,
): Editor {
  const wiring = wire(ports, document);
  const { core, recogniser, views, publish, run } = wiring;
  const saving = savingFor(ports, wiring, stored);
  let disposed = false;
  const alive = (): void => {
    if (disposed) throw new Error('This editor has been disposed.');
  };
  return {
    ...documentMethods(wiring, saving, alive),
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
      core.keyPresses += 1;
      return run(id);
    },
    select(ids) {
      alive();
      core.selection.set(ids);
      publish();
    },
    editText(edit) {
      alive();
      if (edit.type === 'commit') finishText(core);
      else editSession(core, edit.text);
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
      saving.dispose();
      recogniser.dispose();
      core.loop.dispose();
      views.clear();
    },
  };
}
