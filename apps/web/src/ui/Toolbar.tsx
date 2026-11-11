import type { EditorCommand, EditorView, ToolId } from '@planewright/engine';
import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useEditorView, useSurface } from '../editor/surface.ts';
import type { Platform } from '../platform/platform.ts';
import type { IconName } from '../shell/glyphs.ts';
import { Icon } from '../shell/icons.tsx';
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
  text: 'Tap to place a text and type it; Escape or a tap elsewhere ends it.',
};

const LOCK_NOTE =
  'Keeps the rectangle, ellipse, diamond and line tools active after drawing, with nothing selected.';

/** Each tool's original glyph (ADR 0012, decision 3), so that every registry tool has one. */
const TOOL_GLYPHS: Readonly<Record<ToolId, IconName>> = {
  hand: 'hand',
  selection: 'selection',
  rectangle: 'rectangle',
  ellipse: 'ellipse',
  diamond: 'diamond',
  line: 'line',
  freehand: 'freehand',
  text: 'text',
};

/** The palette's groups, which hairlines split: moving the view or selecting, then drawing. */
const TOOL_GROUPS: Readonly<Record<ToolId, 'view' | 'draw'>> = {
  hand: 'view',
  selection: 'view',
  rectangle: 'draw',
  ellipse: 'draw',
  diamond: 'draw',
  line: 'draw',
  freehand: 'draw',
  text: 'draw',
};

/**
 * A tool bar button: a tool, pressed while it is active, or tool lock, pressed while it is on and
 * showing a padlock that is closed while it is on and open otherwise.
 */
interface Item {
  readonly command: EditorCommand;
  readonly pressed: boolean;
  readonly note: string;
  readonly glyph: IconName;
  readonly group: 'view' | 'draw' | 'lock';
}

/** The tool bar's buttons in the registry's order: the tools, then tool lock. */
const itemsOf = (commands: readonly EditorCommand[], view: EditorView): Item[] =>
  commands.flatMap((command): Item[] => {
    const { tool } = command;
    if (tool !== undefined) {
      const glyph = TOOL_GLYPHS[tool];
      return [
        {
          command,
          pressed: view.tool === tool,
          note: NOTES[tool],
          glyph,
          group: TOOL_GROUPS[tool],
        },
      ];
    }
    if (command.id !== 'tool.lock') return [];
    const glyph = view.toolLock ? 'lock-closed' : 'lock-open';
    return [{ command, pressed: view.toolLock, note: LOCK_NOTE, glyph, group: 'lock' }];
  });

/** The keys that a focused button takes for itself, which never reach the editor's keymap. */
const BUTTON_KEYS = new Set(['Enter', ' ']);

/** The keys that move focus within the tool bar, as steps or ends. */
const MOVES: Readonly<Partial<Record<string, number | 'first' | 'last'>>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: 'first',
  End: 'last',
};

/** What a palette button needs from the tool bar around it. */
interface ButtonProps {
  readonly item: Item;
  readonly platform: Platform;
  readonly tabStop: boolean;
  readonly onRef: (button: HTMLButtonElement | null) => void;
  readonly onFocus: () => void;
  readonly onPress: () => void;
}

/**
 * One palette button (ADR 0012, decision 3): the command's glyph, named by its label, and its first
 * key in the corner, hidden from assistive technology, since aria-keyshortcuts and the description
 * that follows the button carry every key, as its tooltip repeats them with the label.
 */
function PaletteButton({ item, platform, tabStop, onRef, onFocus, onPress }: ButtonProps) {
  const { command, pressed, note, glyph } = item;
  return (
    <>
      <button
        ref={onRef}
        type="button"
        className="glyph-button"
        tabIndex={tabStop ? 0 : -1}
        aria-label={command.label}
        aria-pressed={pressed}
        aria-keyshortcuts={ariaKeyShortcuts(command.shortcuts, platform)}
        aria-describedby={`${command.id}-description`}
        data-chrome-tip={command.label}
        data-chrome-keys={shortcutText(command.shortcuts, platform)}
        onClick={onPress}
        onFocus={onFocus}
      >
        <Icon name={glyph} />
        <kbd className="tool-key" aria-hidden="true">
          {shortcutText(command.shortcuts.slice(0, 1), platform)}
        </kbd>
      </button>
      <span id={`${command.id}-description`} className="visually-hidden">
        {shortcutSentence(command.shortcuts, platform)} {note}
      </span>
    </>
  );
}

/**
 * The tool bar (REQ-Y03), shown as the palette: one tab stop, the arrow keys, Home and End to move
 * between its buttons, each tool a toggle button exposing its shortcut (REQ-C14), and tool lock a
 * toggle exposing its state as a state (REQ-Y01), with hairlines between the groups. Enter and
 * Space press the focused button; other keys pressed in it reach the editor's keymap, as on the
 * canvas.
 */
export function Toolbar() {
  const { editor, platform } = useSurface();
  const view = useEditorView();
  const items = itemsOf(editor.commands, view);
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (BUTTON_KEYS.has(event.key)) return;
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
      {items.map((item, index) => (
        <Fragment key={item.command.id}>
          {index > 0 && items[index - 1]?.group !== item.group ? (
            <span className="tool-divider" aria-hidden="true" />
          ) : null}
          <PaletteButton
            item={item}
            platform={platform}
            tabStop={index === focused}
            onRef={(button) => {
              buttons.current[index] = button;
            }}
            onFocus={() => {
              setFocused(index);
            }}
            onPress={() => {
              editor.run(item.command.id);
            }}
          />
        </Fragment>
      ))}
    </div>
  );
}
