import type { Point } from '../model/elements.ts';
import type { PointerKind } from '../selection/pointer.ts';

// Engine input events (docs/architecture/engine/interaction.md#input-pipeline): what the web app's
// input adapter makes of DOM pointer, wheel and key events, in canvas-relative screen pixels.

/** The modifier keys held during an event; `mod` is Cmd on macOS and Ctrl elsewhere (REQ-V05). */
export interface Modifiers {
  readonly shift: boolean;
  readonly alt: boolean;
  readonly mod: boolean;
}

export type PointerButton = 'primary' | 'middle' | 'secondary';

export interface PointerInput {
  readonly type: 'pointer-down' | 'pointer-move' | 'pointer-up' | 'pointer-cancel';
  readonly pointerId: number;
  readonly pointer: PointerKind;
  readonly button: PointerButton;
  /** Screen space, relative to the canvas. */
  readonly at: Point;
  /** In [0, 1], when the device reports it. */
  readonly pressure?: number;
  readonly modifiers: Modifiers;
  /** Milliseconds, on the same time line as the clock. */
  readonly time: number;
}

export interface WheelInput {
  readonly type: 'wheel';
  readonly at: Point;
  /** In screen pixels: the adapter turns lines and pages into pixels. */
  readonly delta: Point;
  /** Mod held, or Ctrl as browsers report a trackpad pinch. */
  readonly zoom: boolean;
  readonly modifiers: Modifiers;
  readonly time: number;
}

export interface KeyInput {
  readonly type: 'key-down' | 'key-up';
  /** The produced character or key name, as `KeyboardEvent.key`. */
  readonly key: string;
  /** The physical key, as `KeyboardEvent.code`. */
  readonly code: string;
  readonly repeat: boolean;
  readonly modifiers: Modifiers;
  readonly time: number;
}

/** The window lost focus: a held Space or an open gesture is released. */
export interface FocusLost {
  readonly type: 'focus-lost';
  readonly time: number;
}

export type InputEvent = PointerInput | WheelInput | KeyInput | FocusLost;
