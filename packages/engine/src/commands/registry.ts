import type { Camera } from '../camera/camera.ts';
import type { ViewportSize } from '../camera/viewport.ts';
import type { History } from '../history/history.ts';
import type { KeyInput } from '../input/events.ts';
import type { ElementId } from '../model/ids.ts';
import type { SceneReader } from '../scene/store.ts';
import type { ToolId } from '../tools/tool.ts';
import { chordMatches, sameChord } from './chords.ts';
import type { KeyChord } from './chords.ts';

// The command registry and keymap (docs/architecture/engine/interaction.md#commands-and-shortcuts,
// ADR 0008 decision 6): the tool bar, the keymap and every later surface read one list.

export type CommandId =
  | 'tool.hand'
  | 'tool.selection'
  | 'history.undo'
  | 'history.redo'
  | 'selection.select-all'
  | 'selection.cancel'
  | 'view.zoom-in'
  | 'view.zoom-out'
  | 'view.zoom-reset'
  | 'view.zoom-to-fit';

/** What a command reads and changes: the editor's state, as the editor lends it. */
export interface CommandTarget {
  readonly tool: ToolId;
  readonly camera: Camera;
  readonly viewport: ViewportSize;
  readonly scene: SceneReader;
  readonly history: Pick<History, 'canUndo' | 'canRedo' | 'undo' | 'redo'>;
  setTool(tool: ToolId): void;
  setCamera(camera: Camera): void;
  /** Replaces the selection; never an undo step (REQ-S13). */
  select(ids: readonly ElementId[]): void;
  /** Cancels the tool's open gesture; false when none is open. */
  cancelGesture(): boolean;
}

export type CommandOutcome = 'done' | 'disabled';

export interface Command {
  readonly id: CommandId;
  /** The English name every surface shows, until the interface has message keys. */
  readonly label: string;
  readonly shortcuts: readonly KeyChord[];
  /** The tool that the command chooses, which makes it a tool bar button. */
  readonly tool?: ToolId;
  isEnabled(target: CommandTarget): boolean;
  run(target: CommandTarget): void;
}

export interface CommandRegistry {
  readonly commands: readonly Command[];
  /** The command with an identifier; an unregistered one is refused. */
  get(id: CommandId): Command;
  /** The keymap: the command whose shortcut a key press is, if any. */
  forKey(event: KeyInput): Command | undefined;
  /** Runs a command if it is enabled. */
  run(id: CommandId, target: CommandTarget): CommandOutcome;
}

const shareShortcut = (a: Command, b: Command): boolean =>
  a.shortcuts.some((chord) => b.shortcuts.some((other) => sameChord(chord, other)));

/** Refuses a repeated identifier, and a shortcut that two commands would share. */
function checkCommands(commands: readonly Command[]): void {
  commands.forEach((command, index) => {
    const earlier = commands.slice(0, index);
    if (earlier.some(({ id }) => id === command.id)) {
      throw new Error(`The command ${command.id} is registered twice.`);
    }
    const clash = earlier.find((other) => shareShortcut(other, command));
    if (clash !== undefined) {
      throw new Error(`The commands ${clash.id} and ${command.id} share a shortcut.`);
    }
  });
}

export function createCommandRegistry(commands: readonly Command[]): CommandRegistry {
  checkCommands(commands);
  const get = (id: CommandId): Command => {
    const command = commands.find((candidate) => candidate.id === id);
    if (command === undefined) throw new Error(`No command ${id} is registered.`);
    return command;
  };
  return {
    commands,
    get,
    forKey: (event) =>
      event.type === 'key-down'
        ? commands.find(({ shortcuts }) => shortcuts.some((chord) => chordMatches(chord, event)))
        : undefined,
    run(id, target) {
      const command = get(id);
      if (!command.isEnabled(target)) return 'disabled';
      command.run(target);
      return 'done';
    },
  };
}
