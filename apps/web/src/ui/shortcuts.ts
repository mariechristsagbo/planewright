import type { KeyChord } from '@planewright/engine';

import type { Platform } from '../platform/platform.ts';

// How controls write the command registry's shortcuts, with the platform's Mod key (REQ-V05).

/**
 * The keys that the registry names in lower case, such as "escape": their `aria-keyshortcuts`
 * names, the UI Events key values, and the words people read.
 */
const NAMED_KEYS: Readonly<Partial<Record<string, readonly [aria: string, text: string]>>> = {
  escape: ['Escape', 'Esc'],
  enter: ['Enter', 'Enter'],
  delete: ['Delete', 'Delete'],
  backspace: ['Backspace', 'Backspace'],
  arrowleft: ['ArrowLeft', 'Left arrow'],
  arrowright: ['ArrowRight', 'Right arrow'],
  arrowup: ['ArrowUp', 'Up arrow'],
  arrowdown: ['ArrowDown', 'Down arrow'],
};

/** How a chord's modifiers and named keys are written: for `aria-keyshortcuts` or for people. */
interface Names {
  readonly mod: string;
  readonly alt: string;
  readonly named: 0 | 1;
}

/**
 * A physical chord names a digit or a letter key by its code; a named key goes by its name; another
 * produced key is shown upper case.
 */
function keyOf(chord: KeyChord, named: Names['named']): string {
  if (chord.physical === true) return chord.key.replace(/^(?:Digit|Key)/u, '');
  return NAMED_KEYS[chord.key]?.[named] ?? chord.key.toUpperCase();
}

function chordText(chord: KeyChord, names: Names): string {
  const parts = [
    ...(chord.mod === true ? [names.mod] : []),
    ...(chord.alt === true ? [names.alt] : []),
    ...(chord.shift === true ? ['Shift'] : []),
    keyOf(chord, names.named),
  ];
  return parts.join('+');
}

/** The value of `aria-keyshortcuts`: each chord's modifiers and key joined by +, chords by spaces. */
export const ariaKeyShortcuts = (chords: readonly KeyChord[], platform: Platform): string => {
  const names = { mod: platform === 'apple' ? 'Meta' : 'Control', alt: 'Alt', named: 0 } as const;
  return chords.map((chord) => chordText(chord, names)).join(' ');
};

/** The chords as people read them, such as "Ctrl+Shift+Z or Ctrl+Y". */
export const shortcutText = (chords: readonly KeyChord[], platform: Platform): string => {
  const names =
    platform === 'apple'
      ? ({ mod: 'Cmd', alt: 'Option', named: 1 } as const)
      : ({ mod: 'Ctrl', alt: 'Alt', named: 1 } as const);
  return chords.map((chord) => chordText(chord, names)).join(' or ');
};

/** "Shortcut H." or "Shortcuts V or 1.", the start of a control's description. */
export const shortcutSentence = (chords: readonly KeyChord[], platform: Platform): string =>
  `${chords.length === 1 ? 'Shortcut' : 'Shortcuts'} ${shortcutText(chords, platform)}.`;
