import type {
  KeyInput,
  Modifiers,
  PointerButton,
  PointerInput,
  WheelInput,
} from '@planewright/engine';

import type { Platform } from '../platform/platform.ts';

// The input adapter (docs/architecture/engine/interaction.md#input-pipeline, ADR 0008): DOM
// events become engine input events in canvas-relative screen pixels.

type ModifierSource = Pick<MouseEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

export type PointerSource = ModifierSource &
  Pick<
    PointerEvent,
    | 'pointerId'
    | 'pointerType'
    | 'button'
    | 'buttons'
    | 'clientX'
    | 'clientY'
    | 'pressure'
    | 'timeStamp'
  >;

export type WheelSource = ModifierSource &
  Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'clientX' | 'clientY' | 'timeStamp'>;

export type KeySource = ModifierSource &
  Pick<KeyboardEvent, 'key' | 'code' | 'repeat' | 'timeStamp'>;

/** Where the canvas is in the page, and its size, in CSS pixels. */
export interface CanvasBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Mod is Cmd on Apple platforms and Ctrl elsewhere (REQ-V05). */
export const modifiersOf = (event: ModifierSource, platform: Platform): Modifiers => ({
  shift: event.shiftKey,
  alt: event.altKey,
  mod: platform === 'apple' ? event.metaKey : event.ctrlKey,
});

const BUTTONS: readonly PointerButton[] = ['primary', 'middle', 'secondary'];

/** The button that the pressed buttons stand for: middle, then secondary, else primary. */
function heldButton(buttons: number): PointerButton {
  if ((buttons & 4) !== 0) return 'middle';
  return (buttons & 2) !== 0 ? 'secondary' : 'primary';
}

/** A press or release names its button; a move (button −1) takes the buttons held. */
const buttonOf = ({ button, buttons }: PointerSource): PointerButton | undefined =>
  button === -1 ? heldButton(buttons) : BUTTONS[button];

/**
 * The engine event for a pointer event, or null for a press of a button the editor does not use.
 * A move, release or cancel of such a button, as the back and forward buttons give, takes the
 * buttons still held instead, so that the press it belongs to always ends (REQ-S06).
 */
export function pointerInput(
  type: PointerInput['type'],
  event: PointerSource,
  canvas: CanvasBox,
  platform: Platform,
): PointerInput | null {
  const button =
    buttonOf(event) ?? (type === 'pointer-down' ? undefined : heldButton(event.buttons));
  if (button === undefined) return null;
  const pointer =
    event.pointerType === 'pen' || event.pointerType === 'touch' ? event.pointerType : 'mouse';
  return {
    type,
    pointerId: event.pointerId,
    pointer,
    button,
    at: { x: event.clientX - canvas.left, y: event.clientY - canvas.top },
    ...(pointer === 'pen' ? { pressure: event.pressure } : {}),
    modifiers: modifiersOf(event, platform),
    time: event.timeStamp,
  };
}

/** `WheelEvent.DOM_DELTA_LINE` and `DOM_DELTA_PAGE`. */
const LINE = 1;
const PAGE = 2;
const LINE_PIXELS = 16;

/** Deltas in pixels: a line counts 16 px and a page one viewport (scene-and-viewport.md). */
export function wheelInput(event: WheelSource, canvas: CanvasBox, platform: Platform): WheelInput {
  const page = event.deltaMode === PAGE;
  const line = event.deltaMode === LINE ? LINE_PIXELS : 1;
  const modifiers = modifiersOf(event, platform);
  return {
    type: 'wheel',
    at: { x: event.clientX - canvas.left, y: event.clientY - canvas.top },
    delta: {
      x: event.deltaX * (page ? canvas.width : line),
      y: event.deltaY * (page ? canvas.height : line),
    },
    // Browsers report a trackpad pinch as a wheel event with Ctrl, on macOS too.
    zoom: modifiers.mod || event.ctrlKey,
    modifiers,
    time: event.timeStamp,
  };
}

export const keyInput = (
  type: KeyInput['type'],
  event: KeySource,
  platform: Platform,
): KeyInput => ({
  type,
  key: event.key,
  code: event.code,
  repeat: event.repeat,
  modifiers: modifiersOf(event, platform),
  time: event.timeStamp,
});
