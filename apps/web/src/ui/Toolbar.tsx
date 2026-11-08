import type { EditorCommand, EditorView, ToolId } from '@planewright/engine';
import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useEditorView, useSurface } from '../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from './shortcuts.ts';

/** What each tool does, after its shortcut in the button's description. */
const NOTES: Readonly<Record<ToolId, string>> = {
  hand: 'Drag to pan the canvas.',
  selection: 'Selects, moves, resizes and rotates the drawn elements.',
  rectangle: 'Drag to draw a rectangle; a tap draws a 100 by 100 one.',
  ellipse: 'Drag to draw an ellipse; a tap draws a 100 by 100 one.',
  diamond: 'Drag to draw a diamond; a tap draws a 100 by 100 one.',
  line: 'Drag to draw a line; a tap draws a horizontal line 100 long.',
  freehand: 'Drag to draw a freehand stroke; a tap draws a dot. The tool stays active.',
  text: 'Tap to place a text; the text area to type it in is not here yet.',
};

const LOCK_NOTE =
  'Keeps the rectangle, ellipse, diamond and line tools active after drawing, with nothing selected.';

/** A tool bar button: a tool, pressed while it is active, or tool lock, pressed while it is on. */
interface Item {
  readonly command: EditorCommand;
  readonly pressed: boolean;
  readonly note: string;
}

/** The tool bar's buttons in the registry's order: the tools, then tool lock. */
const itemsOf = (commands: readonly EditorCommand[], view: EditorView): Item[] =>
  commands.flatMap((command): Item[] => {
    if (command.tool !== undefined) {
      return [{ command, pressed: view.tool === command.tool, note: NOTES[command.tool] }];
    }
    return command.id === 'tool.lock' ? [{ command, pressed: view.toolLock, note: LOCK_NOTE }] : [];
  });

/** The keys that move focus within the tool bar, as steps or ends. */
const MOVES: Readonly<Partial<Record<string, number | 'first' | 'last'>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: 'first',
  End: 'last',
};

/**
 * The tool bar (REQ-Y03): one tab stop, the arrow keys, Home and End to move between its buttons,
 * each tool a toggle button exposing its shortcut (REQ-C14), and tool lock a toggle exposing its
 * state as a state (REQ-Y01). Other keys pressed in it reach the editor's keymap, as on the canvas.
 */
export function Toolbar() {
  const { editor, platform } = useSurface();
  const view = useEditorView();
  const items = itemsOf(editor.commands, view);
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = MOVES[event.key];
    if (move === undefined) {
      sendKeyDown(editor, platform, event);
      return;
    }
    event.preventDefault();
    const last = items.length - 1;
    const target = move === 'first' ? 0 : move === 'last' ? last : focused + move;
    const next = (target + items.length) % items.length;
    setFocused(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      className="toolbar"
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        editor.input(keyInput('key-up', event, platform));
      }}
    >
      {items.map(({ command, pressed, note }, index) => (
        <Fragment key={command.id}>
          <button
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type="button"
            tabIndex={index === focused ? 0 : -1}
            aria-pressed={pressed}
            aria-keyshortcuts={ariaKeyShortcuts(command.shortcuts, platform)}
            aria-describedby={`${command.id}-description`}
            onClick={() => {
              editor.run(command.id);
            }}
            onFocus={() => {
              setFocused(index);
            }}
          >
            {command.label}
            <kbd aria-hidden="true">{shortcutText(command.shortcuts, platform)}</kbd>
          </button>
          <span id={`${command.id}-description`} className="visually-hidden">
            {shortcutSentence(command.shortcuts, platform)} {note}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
