import type { KeyInput, Modifiers } from '../../src/input/events.ts';

// What some physical keys produce on three keyboard layouts, without and with Shift, as
// `KeyboardEvent.key` reports them, for the keymap's tests.

export type Layout = Readonly<Record<string, readonly [string, string]>>;

export const US: Layout = {
  Digit0: ['0', ')'],
  Digit1: ['1', '!'],
  Digit6: ['6', '^'],
  Digit8: ['8', '*'],
  Equal: ['=', '+'],
  Minus: ['-', '_'],
  KeyH: ['h', 'H'],
  KeyV: ['v', 'V'],
  KeyW: ['w', 'W'],
  KeyY: ['y', 'Y'],
  KeyZ: ['z', 'Z'],
  NumpadAdd: ['+', '+'],
  NumpadSubtract: ['-', '-'],
  Space: [' ', ' '],
};

/** French AZERTY: digits need Shift, `-` and `_` sit on the 6 and 8 keys, Z and W swap places. */
export const AZERTY: Layout = {
  Digit0: ['à', '0'],
  Digit1: ['&', '1'],
  Digit6: ['-', '6'],
  Digit8: ['_', '8'],
  Equal: ['=', '+'],
  Minus: [')', '°'],
  KeyH: ['h', 'H'],
  KeyV: ['v', 'V'],
  KeyW: ['z', 'Z'],
  KeyY: ['y', 'Y'],
  KeyZ: ['w', 'W'],
  NumpadAdd: ['+', '+'],
  NumpadSubtract: ['-', '-'],
  Space: [' ', ' '],
};

/** A layout without Latin letters. */
export const RUSSIAN: Layout = {
  Digit1: ['1', '!'],
  KeyH: ['р', 'Р'],
  KeyV: ['м', 'М'],
  KeyZ: ['я', 'Я'],
};

/** A key press of a physical key on a layout, with the given modifiers. */
export function press(layout: Layout, code: string, modifiers: Partial<Modifiers> = {}): KeyInput {
  const keys = layout[code];
  if (keys === undefined) throw new Error(`The test layout has no ${code} key.`);
  return {
    type: 'key-down',
    key: modifiers.shift === true ? keys[1] : keys[0],
    code,
    repeat: false,
    modifiers: { shift: false, alt: false, mod: false, ...modifiers },
    time: 0,
  };
}
