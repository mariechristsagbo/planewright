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
});
