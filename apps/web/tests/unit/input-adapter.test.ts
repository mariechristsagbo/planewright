import { describe, expect, it } from 'vitest';

import { keyInput, pointerInput, wheelInput } from '../../src/editor/input-adapter.ts';
import type { PointerSource, WheelSource } from '../../src/editor/input-adapter.ts';
import { platformOf } from '../../src/platform/platform.ts';

// The input adapter (docs/architecture/engine/interaction.md#input-pipeline): DOM pointer, wheel
// and key events become engine input events in canvas-relative screen pixels, with Mod as Cmd on
// macOS and Ctrl elsewhere (REQ-V05).

const NO_KEYS = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false };
const NONE = { shift: false, alt: false, mod: false };
const CANVAS = { left: 100, top: 50, width: 800, height: 600 };

const pointer = (over: Partial<PointerSource> = {}): PointerSource => ({
  pointerId: 7,
  pointerType: 'mouse',
  button: 0,
  buttons: 1,
  clientX: 110,
  clientY: 70,
  pressure: 0.5,
  timeStamp: 1234.5,
  ...NO_KEYS,
  ...over,
});

const wheel = (over: Partial<WheelSource> = {}): WheelSource => ({
  deltaX: 3,
  deltaY: 10,
  deltaMode: 0,
  clientX: 500,
  clientY: 350,
  timeStamp: 20,
  ...NO_KEYS,
  ...over,
});

describe('pointer events', () => {
  it('AC map to canvas-relative points with the pointer, button, modifiers and time', () => {
    expect(pointerInput('pointer-down', pointer(), CANVAS, 'other')).toEqual({
      type: 'pointer-down',
      pointerId: 7,
      pointer: 'mouse',
      button: 'primary',
      at: { x: 10, y: 20 },
      modifiers: NONE,
      time: 1234.5,
    });
  });

  it.each([
    [1, 'middle'],
    [2, 'secondary'],
  ] as const)('AC map button %d to %s, and ignore the back and forward buttons', (button, name) => {
    expect(pointerInput('pointer-down', pointer({ button }), CANVAS, 'other')?.button).toBe(name);
    expect(pointerInput('pointer-down', pointer({ button: 3 }), CANVAS, 'other')).toBeNull();
    expect(pointerInput('pointer-up', pointer({ button: 4 }), CANVAS, 'other')).toBeNull();
  });

  it.each([
    [4, 'middle'],
    [2, 'secondary'],
    [1, 'primary'],
    [0, 'primary'],
  ] as const)('AC take a move’s button from the pressed buttons %d: %s', (buttons, name) => {
    const move = pointerInput('pointer-move', pointer({ button: -1, buttons }), CANVAS, 'other');
    expect(move?.button).toBe(name);
  });

  it('AC keep a pen’s pressure, and read any other pointer type as a mouse', () => {
    const pen = pointerInput(
      'pointer-move',
      pointer({ pointerType: 'pen', pressure: 0.3 }),
      CANVAS,
      'other',
    );
    expect(pen).toMatchObject({ pointer: 'pen', pressure: 0.3 });
    const finger = pointerInput('pointer-down', pointer({ pointerType: 'touch' }), CANVAS, 'other');
    expect(finger?.pointer).toBe('touch');
    expect(finger).not.toHaveProperty('pressure');
    expect(pointerInput('pointer-up', pointer({ pointerType: '' }), CANVAS, 'other')?.pointer).toBe(
      'mouse',
    );
  });
});

describe('wheel events', () => {
  it('AC keep pixel deltas, count a line as 16 px and a page as one viewport', () => {
    expect(wheelInput(wheel(), CANVAS, 'other')).toEqual({
      type: 'wheel',
      at: { x: 400, y: 300 },
      delta: { x: 3, y: 10 },
      zoom: false,
      modifiers: NONE,
      time: 20,
    });
    expect(wheelInput(wheel({ deltaMode: 1 }), CANVAS, 'other').delta).toEqual({ x: 48, y: 160 });
    expect(wheelInput(wheel({ deltaMode: 2 }), CANVAS, 'other').delta).toEqual({
      x: 2400,
      y: 6000,
    });
  });

  it('AC REQ-V05 zoom with Mod, Cmd on macOS and Ctrl elsewhere, and with Ctrl for a trackpad pinch', () => {
    expect(wheelInput(wheel({ metaKey: true }), CANVAS, 'apple')).toMatchObject({
      zoom: true,
      modifiers: { mod: true },
    });
    expect(wheelInput(wheel({ ctrlKey: true }), CANVAS, 'apple')).toMatchObject({
      zoom: true,
      modifiers: { mod: false },
    });
    expect(wheelInput(wheel({ ctrlKey: true }), CANVAS, 'other')).toMatchObject({
      zoom: true,
      modifiers: { mod: true },
    });
    expect(wheelInput(wheel({ metaKey: true }), CANVAS, 'other')).toMatchObject({
      zoom: false,
      modifiers: { mod: false },
    });
  });

  it('AC carry Shift, which pans horizontally', () => {
    expect(wheelInput(wheel({ shiftKey: true }), CANVAS, 'other').modifiers).toEqual({
      ...NONE,
      shift: true,
    });
  });
});

describe('key events', () => {
  const key = { key: 'Z', code: 'KeyZ', repeat: true, timeStamp: 99, ...NO_KEYS, shiftKey: true };

  it('AC map the produced key, the physical code, the repeat flag and the time', () => {
    expect(keyInput('key-down', key, 'other')).toEqual({
      type: 'key-down',
      key: 'Z',
      code: 'KeyZ',
      repeat: true,
      modifiers: { ...NONE, shift: true },
      time: 99,
    });
    expect(keyInput('key-up', { ...key, altKey: true }, 'other')).toMatchObject({
      type: 'key-up',
      modifiers: { alt: true },
    });
  });

  it('AC REQ-V05 read Mod as Cmd on macOS and as Ctrl elsewhere', () => {
    expect(keyInput('key-down', { ...key, metaKey: true }, 'apple').modifiers.mod).toBe(true);
    expect(keyInput('key-down', { ...key, ctrlKey: true }, 'apple').modifiers.mod).toBe(false);
    expect(keyInput('key-down', { ...key, ctrlKey: true }, 'other').modifiers.mod).toBe(true);
    expect(keyInput('key-down', { ...key, metaKey: true }, 'other').modifiers.mod).toBe(false);
  });
});

describe('the platform', () => {
  it.each([
    [{ platform: 'MacIntel' }, 'apple'],
    [{ platform: 'iPhone' }, 'apple'],
    [{ platform: 'iPad' }, 'apple'],
    [{ platform: 'Win32' }, 'other'],
    [{ platform: 'Linux x86_64' }, 'other'],
    [{ platform: 'Linux x86_64', userAgentData: { platform: 'macOS' } }, 'apple'],
    [{ platform: 'MacIntel', userAgentData: { platform: 'Windows' } }, 'other'],
  ] as const)('REQ-V05 reads %o as %s', (navigator, platform) => {
    expect(platformOf(navigator)).toBe(platform);
  });
});
