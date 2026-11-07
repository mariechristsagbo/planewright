import type { KeyChord } from '@planewright/engine';

import type { Platform } from '../platform/platform.ts';

// How controls write the command registry's shortcuts, with the platform's Mod key (REQ-V05).

/** A physical chord names a digit or a letter key by its code; a produced key is shown upper case. */
const keyOf = (chord: KeyChord): string =>
  chord.physical === true ? chord.key.replace(/^(?:Digit|Key)/u, '') : chord.key.toUpperCase();

function chordText(chord: KeyChord, names: readonly [mod: string, alt: string]): string {
  const parts = [
    ...(chord.mod === true ? [names[0]] : []),
    ...(chord.alt === true ? [names[1]] : []),
    ...(chord.shift === true ? ['Shift'] : []),
    keyOf(chord),
  ];
  return parts.join('+');
}

/** The value of `aria-keyshortcuts`: each chord's modifiers and key joined by +, chords by spaces. */
export const ariaKeyShortcuts = (chords: readonly KeyChord[], platform: Platform): string =>
  chords
    .map((chord) => chordText(chord, [platform === 'apple' ? 'Meta' : 'Control', 'Alt']))
    .join(' ');

/** The chords as people read them, such as "Ctrl+Shift+Z or Ctrl+Y". */
export const shortcutText = (chords: readonly KeyChord[], platform: Platform): string =>
  chords
    .map((chord) => chordText(chord, platform === 'apple' ? ['Cmd', 'Option'] : ['Ctrl', 'Alt']))
    .join(' or ');

/** "Shortcut H." or "Shortcuts V or 1.", the start of a control's description. */
export const shortcutSentence = (chords: readonly KeyChord[], platform: Platform): string =>
  `${chords.length === 1 ? 'Shortcut' : 'Shortcuts'} ${shortcutText(chords, platform)}.`;
