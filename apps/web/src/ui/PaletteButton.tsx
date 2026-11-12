import type { Platform } from '../platform/platform.ts';
import { Icon } from '../shell/icons.tsx';
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
}

/**
 * One palette button (ADR 0012, decision 3): the command's glyph, named by its label, and its first
 * key in the corner, hidden from assistive technology, since aria-keyshortcuts and the description
 * that follows the button carry every key, as its tooltip repeats them with the label.
 */
export function PaletteButton({
  item,
  platform,
  tabStop,
  onRef,
  onFocus,
  onPress,
}: PaletteButtonProps) {
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
