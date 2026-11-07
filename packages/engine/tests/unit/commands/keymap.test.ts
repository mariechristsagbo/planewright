import { describe, expect, it } from 'vitest';

import { DEFAULT_COMMANDS } from '../../../src/commands/defaults.ts';
import { createCommandRegistry } from '../../../src/commands/registry.ts';
import type { KeyInput } from '../../../src/input/events.ts';
import { keyEvent } from '../../support/inputs.ts';
import { AZERTY, press, RUSSIAN, US } from '../../support/layouts.ts';

// The keymap (docs/architecture/engine/interaction.md#commands-and-shortcuts): letters match the
// produced character, digits the physical key, and the zoom keys whatever the layout makes them.

const registry = createCommandRegistry(DEFAULT_COMMANDS);
const commandFor = (event: KeyInput) => registry.forKey(event)?.id ?? null;
const MOD = { mod: true } as const;

describe.each([
  ['US', US],
  ['French AZERTY', AZERTY],
] as const)('on a %s layout', (_, layout) => {
  it('AC digit shortcuts match the physical key, Mod+0 included', () => {
    expect(commandFor(press(layout, 'Digit1'))).toBe('tool.selection');
    expect(commandFor(press(layout, 'Digit0', MOD))).toBe('view.zoom-reset');
  });

  it('AC 1 and Shift+1 stay distinct', () => {
    expect(commandFor(press(layout, 'Digit1'))).toBe('tool.selection');
    expect(commandFor(press(layout, 'Digit1', { shift: true }))).toBe('view.zoom-to-fit');
  });

  it('AC Mod with = or +, with or without Shift, zooms in', () => {
    expect(commandFor(press(layout, 'Equal', MOD))).toBe('view.zoom-in');
    expect(commandFor(press(layout, 'Equal', { mod: true, shift: true }))).toBe('view.zoom-in');
    expect(commandFor(press(layout, 'NumpadAdd', MOD))).toBe('view.zoom-in');
    expect(commandFor(press(layout, 'Equal'))).toBeNull();
  });

  it('AC Mod with - from the number pad zooms out', () => {
    expect(commandFor(press(layout, 'NumpadSubtract', MOD))).toBe('view.zoom-out');
  });

  it('REQ-C14 letters match the produced character: H is the Hand tool and V the Selection tool', () => {
    expect(commandFor(press(layout, 'KeyH'))).toBe('tool.hand');
    expect(commandFor(press(layout, 'KeyV'))).toBe('tool.selection');
  });

  it('REQ-V05 Undo and Redo need Mod', () => {
    const z = layout === AZERTY ? 'KeyW' : 'KeyZ';
    expect(commandFor(press(layout, z))).toBeNull();
    expect(commandFor(press(layout, z, MOD))).toBe('history.undo');
    expect(commandFor(press(layout, z, { mod: true, shift: true }))).toBe('history.redo');
    expect(commandFor(press(layout, 'KeyY', MOD))).toBe('history.redo');
  });
});

describe('the zoom-out keys wherever the layout puts them', () => {
  it('AC on a US layout Mod with - or _ zooms out', () => {
    expect(commandFor(press(US, 'Minus', MOD))).toBe('view.zoom-out');
    expect(commandFor(press(US, 'Minus', { mod: true, shift: true }))).toBe('view.zoom-out');
  });

  it('AC on an AZERTY layout Mod with - or _ zooms out, from the 6 and 8 keys', () => {
    expect(commandFor(press(AZERTY, 'Digit6', MOD))).toBe('view.zoom-out');
    expect(commandFor(press(AZERTY, 'Digit8', MOD))).toBe('view.zoom-out');
    expect(commandFor(press(AZERTY, 'Minus', MOD))).toBeNull();
  });

  it('accepts the minus sign as well as the hyphen', () => {
    expect(commandFor(keyEvent('key-down', '−', 'Minus', MOD))).toBe('view.zoom-out');
  });
});

describe('letters', () => {
  it('follow the produced letter, so AZERTY’s physical Z key, which makes w, is not Undo', () => {
    expect(commandFor(press(AZERTY, 'KeyZ', MOD))).toBeNull();
  });

  it('fall back to the physical key on a layout without Latin letters', () => {
    expect(commandFor(press(RUSSIAN, 'KeyH'))).toBe('tool.hand');
    expect(commandFor(press(RUSSIAN, 'KeyZ', MOD))).toBe('history.undo');
    expect(commandFor(press(RUSSIAN, 'Digit1'))).toBe('tool.selection');
  });
});

describe('modifiers and event types', () => {
  it('need exactly the chord’s modifiers', () => {
    expect(commandFor(press(US, 'KeyH', { alt: true }))).toBeNull();
    expect(commandFor(press(US, 'KeyH', MOD))).toBeNull();
    expect(commandFor(press(US, 'KeyH', { shift: true }))).toBeNull();
    expect(commandFor(press(US, 'Digit0', { mod: true, alt: true }))).toBeNull();
  });

  it('match key presses only, and nothing for Space or an unbound key', () => {
    expect(commandFor({ ...press(US, 'KeyH'), type: 'key-up' })).toBeNull();
    expect(commandFor(press(US, 'Space'))).toBeNull();
    expect(commandFor(press(US, 'KeyW'))).toBeNull();
  });
});
