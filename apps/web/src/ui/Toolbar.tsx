import type { ToolId } from '@planewright/engine';
import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useEditorView, useSurface } from '../editor/surface.ts';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from './shortcuts.ts';

/** What each tool does so far, after its shortcut in the button's description. */
const NOTES: Readonly<Record<ToolId, string>> = {
  hand: 'Drag to pan the canvas.',
  selection:
    'Selects, moves, resizes and rotates elements; nothing can be drawn yet, so there is nothing to select.',
  rectangle: 'Drag to draw a rectangle; a tap draws a 100 by 100 one.',
  ellipse: 'Drag to draw an ellipse; a tap draws a 100 by 100 one.',
  diamond: 'Drag to draw a diamond; a tap draws a 100 by 100 one.',
  line: 'Drag to draw a line; a tap draws a horizontal line 100 long.',
};

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
 * The tool bar (REQ-Y03): one tab stop, the arrow keys, Home and End to move between tools, and
 * each tool a toggle button exposing its shortcut (REQ-C14). Other keys pressed in it reach the
 * editor's keymap, as on the canvas.
 */
export function Toolbar() {
  const { editor, platform } = useSurface();
  const view = useEditorView();
  const tools = editor.commands.flatMap((command) =>
    command.tool === undefined ? [] : [{ ...command, tool: command.tool }],
  );
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = MOVES[event.key];
    if (move === undefined) {
      sendKeyDown(editor, platform, event);
      return;
    }
    event.preventDefault();
    const last = tools.length - 1;
    const target = move === 'first' ? 0 : move === 'last' ? last : focused + move;
    const next = (target + tools.length) % tools.length;
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
      {tools.map((command, index) => (
        <Fragment key={command.id}>
          <button
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type="button"
            tabIndex={index === focused ? 0 : -1}
            aria-pressed={view.tool === command.tool}
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
            {shortcutSentence(command.shortcuts, platform)} {NOTES[command.tool]}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
