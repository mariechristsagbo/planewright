import { useRef } from 'react';

import type { Platform } from '../platform/platform.ts';
import { Icon } from '../shell/icons.tsx';
import { useFocusLost } from './focus-lost.ts';
import { ariaKeyShortcuts, shortcutSentence, shortcutText } from './shortcuts.ts';
import type { ToolItem } from './tool-items.ts';

/** What a palette button needs from the tool bar around it. */
export interface PaletteButtonProps {
  readonly item: ToolItem;
  readonly platform: Platform;
  readonly tabStop: boolean;
  readonly onRef: (button: HTMLButtonElement | null) => void;
  readonly onFocus: () => void;
  readonly onPress: () => void;
  /** Called when the button leaves the page with the focus on it. */
  readonly onLost?: (() => void) | undefined;
}

/**
 * One palette button (ADR 0012, decision 3): the command's glyph, named by its label, and its first
 * key in the corner, hidden from assistive technology, since aria-keyshortcuts and the description
 * that follows the button carry every key, as its tooltip repeats them with the label. A button that
 * leaves the page with the focus on it says so, for the tool bar to keep the focus.
 */
export function PaletteButton({
  item,
  platform,
  tabStop,
  onRef,
  onFocus,
  onPress,
  onLost,
}: PaletteButtonProps) {
  const { command, pressed, note, glyph } = item;
  const own = useRef<HTMLButtonElement | null>(null);
  useFocusLost(own, onLost);
  return (
    <>
      <button
        ref={(button) => {
          own.current = button;
          onRef(button);
        }}
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
