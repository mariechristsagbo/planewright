import type { KeyInput } from '../input/events.ts';

// Key chords and how a key press matches one
// (docs/architecture/engine/interaction.md#commands-and-shortcuts, ADR 0008 decision 7).

export interface KeyChord {
  /** The produced character in lower case or, with `physical`, a `KeyboardEvent.code`. */
  readonly key: string;
  readonly physical?: true;
  readonly mod?: true;
  readonly shift?: true;
  readonly alt?: true;
}

const LATIN_LETTER = /^[a-z]$/u;

const sameModifiers = (chord: KeyChord, event: KeyInput): boolean =>
  (chord.mod === true) === event.modifiers.mod &&
  (chord.shift === true) === event.modifiers.shift &&
  (chord.alt === true) === event.modifiers.alt;

/**
 * Whether a key press is the chord. The modifiers must be exactly the chord's, so `1` and `Shift+1`
 * stay apart by Shift alone. A physical chord matches the key's code, so digits work on layouts
 * where they need Shift. Any other chord matches the produced character in lower case, and a
 * letter falls back to its physical key when the layout produces no Latin letter.
 */
export function chordMatches(chord: KeyChord, event: KeyInput): boolean {
  if (!sameModifiers(chord, event)) return false;
  if (chord.physical === true) return event.code === chord.key;
  const produced = event.key.toLowerCase();
  if (produced === chord.key) return true;
  return (
    LATIN_LETTER.test(chord.key) &&
    !LATIN_LETTER.test(produced) &&
    event.code === `Key${chord.key.toUpperCase()}`
  );
}

/** Whether two chords are the same keys with the same modifiers. */
export const sameChord = (a: KeyChord, b: KeyChord): boolean =>
  a.key === b.key &&
  a.physical === b.physical &&
  a.mod === b.mod &&
  a.shift === b.shift &&
  a.alt === b.alt;
