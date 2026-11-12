import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useSurface, useViewValue } from '../editor/surface.ts';
import { PaletteButton } from './PaletteButton.tsx';
import { itemsOf } from './tool-items.ts';
import type { ToolState } from './tool-items.ts';

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

/**
 * The active tool and tool lock, read value by value, so that a pan or zoom step, which keeps both,
 * renders the tool bar not at all (ADR 0012, decision 14).
 */
function useToolState(): ToolState {
  const tool = useViewValue((view) => view.tool);
  const toolLock = useViewValue((view) => view.toolLock);
  return { tool, toolLock };
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
  const items = itemsOf(editor.commands, useToolState());
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
