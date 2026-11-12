import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useSurface, useViewValue } from '../editor/surface.ts';
import { MoreTools } from '../shell/MoreTools.tsx';
import type { MoreControls } from '../shell/MoreTools.tsx';
import { MORE, dockCommands } from '../shell/more-tools.ts';
import { PaletteButton } from './PaletteButton.tsx';
import { itemsOf } from './tool-items.ts';
import type { ToolItem, ToolState } from './tool-items.ts';

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
 * The roving tab stop, kept by identifier: the stop last focused while the tool bar shows it, else
 * its first, so that a window that turns leaves exactly one stop. A button that leaves the page
 * with the focus on it, as Tool lock does when the palette becomes the dock, or More's popover when
 * it closes on a press outside, has the focus given to the stop.
 */
function useRovingStop(stops: readonly string[]) {
  const [focused, setFocused] = useState<string | null>(null);
  const stop = focused !== null && stops.includes(focused) ? focused : (stops[0] ?? '');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const lost = useRef(false);
  const onLost = useCallback(() => {
    lost.current = true;
  }, []);
  useLayoutEffect(() => {
    if (!lost.current) return;
    lost.current = false;
    buttons.current.get(stop)?.focus();
  });
  const refOf =
    (id: string) =>
    (button: HTMLButtonElement | null): void => {
      if (button === null) buttons.current.delete(id);
      else buttons.current.set(id, button);
    };
  const focus = (id: string): void => {
    setFocused(id);
    buttons.current.get(id)?.focus();
  };
  return { stop, setFocused, focus, onLost, refOf };
}

/**
 * The tool bar's keys: the arrow keys, Home and End move the stop through the shown stops, Enter
 * and Space are left to the focused button, and every other key reaches the editor's keymap.
 */
function useToolbarKeys(stops: readonly string[], roving: ReturnType<typeof useRovingStop>) {
  const { editor, platform } = useSurface();
  return (event: KeyboardEvent<HTMLDivElement>): void => {
    if (BUTTON_KEYS.has(event.key)) return;
    const move = MOVES[event.key];
    if (move === undefined) {
      sendKeyDown(editor, platform, event);
      return;
    }
    event.preventDefault();
    const at = stops.indexOf(roving.stop);
    const target = move === 'first' ? 0 : move === 'last' ? stops.length - 1 : at + move;
    roving.focus(stops[(target + stops.length) % stops.length] ?? roving.stop);
  };
}

/** Whether a hairline goes before a palette button: between two groups, never in the dock. */
const divided = (items: readonly ToolItem[], index: number, dock: boolean): boolean =>
  !dock && index > 0 && items[index - 1]?.group !== items[index]?.group;

/**
 * The tool bar (REQ-Y03): one tab stop, the arrow keys, Home and End to move between its buttons,
 * each tool a toggle button exposing its shortcut (REQ-C14), and tool lock a toggle exposing its
 * state as a state (REQ-Y01). It is the palette, with hairlines between the groups, or, given More's
 * controls on a phone in portrait, the dock: the tools that More does not hold, then More (the v0.2
 * plan's S8). Enter and Space press the focused button; other keys pressed in it reach the editor's
 * keymap, as on the canvas.
 */
export function Toolbar({ more }: { readonly more?: MoreControls | undefined }) {
  const { editor, platform } = useSurface();
  const state = useToolState();
  const dock = more !== undefined;
  const items = itemsOf(dock ? dockCommands(editor.commands) : editor.commands, state);
  const stops = [...items.map(({ command }) => command.id), ...(dock ? [MORE] : [])];
  const roving = useRovingStop(stops);
  const onKeyDown = useToolbarKeys(stops, roving);

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
          {divided(items, index, dock) ? (
            <span className="tool-divider" aria-hidden="true" />
          ) : null}
          <PaletteButton
            item={item}
            platform={platform}
            tabStop={item.command.id === roving.stop}
            onRef={roving.refOf(item.command.id)}
            onFocus={() => {
              roving.setFocused(item.command.id);
            }}
            onPress={() => {
              editor.run(item.command.id);
            }}
            onLost={roving.onLost}
          />
        </Fragment>
      ))}
      {more === undefined ? null : (
        <MoreTools
          controls={more}
          state={state}
          tabStop={roving.stop === MORE}
          onRef={roving.refOf(MORE)}
          onFocus={() => {
            roving.setFocused(MORE);
          }}
          onLost={roving.onLost}
        />
      )}
    </div>
  );
}
