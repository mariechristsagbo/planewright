import type { KeyChord } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { ariaKeyShortcuts, shortcutText } from '../../src/ui/shortcuts.ts';

// How controls write the registry's shortcuts: `aria-keyshortcuts` values and readable text, with
// the platform's Mod key (REQ-V05, REQ-C14).

const REDO = [
  { key: 'z', mod: true, shift: true },
  { key: 'y', mod: true },
] as const;

describe('shortcuts', () => {
  it('are written for aria-keyshortcuts with the platform’s Mod key', () => {
    expect(ariaKeyShortcuts(REDO, 'other')).toBe('Control+Shift+Z Control+Y');
    expect(ariaKeyShortcuts(REDO, 'apple')).toBe('Meta+Shift+Z Meta+Y');
    expect(
      ariaKeyShortcuts([{ key: 'Digit0', physical: true, mod: true, alt: true }], 'other'),
    ).toBe('Control+Alt+0');
  });

  it('are written for people with Ctrl or Cmd, and Alt or Option', () => {
    expect(shortcutText(REDO, 'other')).toBe('Ctrl+Shift+Z or Ctrl+Y');
    expect(shortcutText(REDO, 'apple')).toBe('Cmd+Shift+Z or Cmd+Y');
    expect(
      shortcutText(
        [
          { key: 'h', alt: true },
          { key: 'Digit1', physical: true },
        ],
        'apple',
      ),
    ).toBe('Option+H or 1');
    expect(shortcutText([{ key: 'h', alt: true }], 'other')).toBe('Alt+H');
  });

  it('name the named keys: aria-keyshortcuts by their key values, people by their words', () => {
    const chords: readonly KeyChord[] = [
      { key: 'escape' },
      { key: 'enter' },
      { key: 'delete' },
      { key: 'backspace' },
      { key: 'arrowleft', shift: true },
      { key: 'arrowright' },
      { key: 'arrowup' },
      { key: 'arrowdown', alt: true },
    ];
    expect(ariaKeyShortcuts(chords, 'other')).toBe(
      'Escape Enter Delete Backspace Shift+ArrowLeft ArrowRight ArrowUp Alt+ArrowDown',
    );
    expect(shortcutText(chords, 'apple')).toBe(
      'Esc or Enter or Delete or Backspace or Shift+Left arrow or Right arrow or Up arrow or Option+Down arrow',
    );
  });
});
