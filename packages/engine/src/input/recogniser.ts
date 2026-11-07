import type { PointerPair } from '../camera/pinch.ts';
import { distance, subtract } from '../math/vector.ts';
import type { Point } from '../model/elements.ts';
import type { Cancel, Scheduler } from '../ports/ports.ts';
import type { PointerKind } from '../selection/pointer.ts';
import type { InputEvent, PointerInput } from './events.ts';
import { DOUBLE_TAP_DISTANCE, DOUBLE_TAP_MS, DRAG_THRESHOLD, LONG_PRESS_MS } from './gestures.ts';
import { TAP_MAX_MS } from './gestures.ts';
import type { Gesture } from './gestures.ts';

// The gesture recogniser (docs/architecture/engine/interaction.md#gesture-recogniser).

export interface GestureRecogniser {
  /** Feeds one input event; wheel events belong to the viewport and pass untouched. */
  input(event: InputEvent): void;
  /**
   * Ends the tool's open gesture as a cancelled pointer would, so the tool is told and the pointer
   * does nothing until it lifts; false when no tool gesture is open, as during a camera drag.
   */
  cancel(): boolean;
  /** Drops a pending long press; the recogniser then ignores all input. */
  dispose(): void;
}

/** The one pressed pointer whose gesture goes to the tool, or to the camera. */
interface Press {
  readonly id: number;
  readonly pointer: PointerKind;
  readonly camera: boolean;
  readonly start: Point;
  readonly time: number;
  last: Point;
  dragging: boolean;
  held: boolean;
}

interface Pinch {
  readonly ids: readonly [number, number];
  readonly from: PointerPair;
  to: PointerPair;
}

interface Recogniser {
  readonly emit: (gesture: Gesture) => void;
  readonly scheduler: Scheduler;
  /** Every touch pointer down, where it is now. */
  readonly touches: Map<number, Point>;
  press: Press | null;
  pinch: Pinch | null;
  lastTap: { readonly at: Point; readonly time: number } | null;
  space: boolean;
  timer: Cancel | null;
}

const toolGesture = (type: 'press' | 'drag-start' | 'drag' | 'release', event: PointerInput) =>
  ({
    type,
    at: event.at,
    pointer: event.pointer,
    modifiers: event.modifiers,
    ...(event.pressure === undefined ? {} : { pressure: event.pressure }),
  }) as const;

function stopTimer(r: Recogniser): void {
  r.timer?.();
  r.timer = null;
}

/** Ends the press; a tool's gesture is told it was cancelled, a camera drag just stops. */
function cancelPress(r: Recogniser): void {
  const press = r.press;
  stopTimer(r);
  r.press = null;
  if (press !== null && !press.camera) r.emit({ type: 'cancel' });
}

function startPress(r: Recogniser, event: PointerInput): void {
  const camera = event.button === 'middle' || r.space;
  const press: Press = {
    id: event.pointerId,
    pointer: event.pointer,
    camera,
    start: event.at,
    time: event.time,
    last: event.at,
    dragging: false,
    held: false,
  };
  r.press = press;
  if (camera) return;
  r.emit(toolGesture('press', event));
  if (event.pointer === 'mouse') return;
  r.timer = r.scheduler.after(LONG_PRESS_MS, () => {
    r.timer = null;
    press.held = true;
    r.emit({ type: 'long-press', at: press.start, pointer: press.pointer });
  });
}

/** A second touch pointer cancels the tool's gesture and starts a two-pointer one. */
function startPinch(r: Recogniser, [other, from]: [number, Point], event: PointerInput): void {
  if (r.pinch !== null) return;
  cancelPress(r);
  r.pinch = { ids: [other, event.pointerId], from: [from, event.at], to: [from, event.at] };
  r.emit({ type: 'pinch-start', from: r.pinch.from });
}

function pointerDown(r: Recogniser, event: PointerInput): void {
  if (event.pointer === 'touch') {
    const [other] = r.touches;
    r.touches.set(event.pointerId, event.at);
    if (other !== undefined) {
      startPinch(r, other, event);
      return;
    }
  }
  if (r.press === null && r.pinch === null && event.button !== 'secondary') startPress(r, event);
}

function panTo(r: Recogniser, press: Press, at: Point): void {
  const delta = subtract(at, press.last);
  press.last = at;
  if (delta.x !== 0 || delta.y !== 0) r.emit({ type: 'pan', delta });
}

/** Moves one pointer of the pinch, if it is one, and reports the pinch. */
function pinchMove(r: Recogniser, event: PointerInput): boolean {
  const pinch = r.pinch;
  const index = pinch?.ids.indexOf(event.pointerId) ?? -1;
  if (pinch === null || index === -1) return false;
  pinch.to = index === 0 ? [event.at, pinch.to[1]] : [pinch.to[0], event.at];
  r.emit({ type: 'pinch', from: pinch.from, to: pinch.to });
  return true;
}

function pointerMove(r: Recogniser, event: PointerInput): void {
  if (r.touches.has(event.pointerId)) r.touches.set(event.pointerId, event.at);
  const press = r.press;
  if (pinchMove(r, event) || press?.id !== event.pointerId) return;
  if (press.camera) {
    panTo(r, press, event.at);
  } else if (press.dragging) {
    r.emit(toolGesture('drag', event));
  } else if (distance(press.start, event.at) > DRAG_THRESHOLD[press.pointer]) {
    press.dragging = true;
    stopTimer(r);
    r.emit(toolGesture('drag-start', event));
  }
}

/** Ends the pinch if the pointer is one of its two; the other finger then does nothing. */
function endPinch(r: Recogniser, id: number): boolean {
  if (r.pinch?.ids.includes(id) !== true) return false;
  r.pinch = null;
  return true;
}

function tap(r: Recogniser, press: Press, event: PointerInput): void {
  const last = r.lastTap;
  const double =
    last !== null &&
    event.time - last.time <= DOUBLE_TAP_MS &&
    distance(last.at, press.start) <= DOUBLE_TAP_DISTANCE;
  r.lastTap = double ? null : { at: press.start, time: event.time };
  const type = double ? 'double-tap' : 'tap';
  r.emit({ type, at: press.start, pointer: press.pointer, modifiers: event.modifiers });
}

function pointerUp(r: Recogniser, event: PointerInput): void {
  r.touches.delete(event.pointerId);
  const press = r.press;
  if (endPinch(r, event.pointerId) || press?.id !== event.pointerId) return;
  stopTimer(r);
  r.press = null;
  if (press.camera) {
    panTo(r, press, event.at);
  } else if (
    press.dragging ||
    press.held ||
    (press.pointer !== 'mouse' && event.time - press.time >= TAP_MAX_MS)
  ) {
    r.emit(toolGesture('release', event));
  } else {
    tap(r, press, event);
  }
}

function pointerCancel(r: Recogniser, event: PointerInput): void {
  r.touches.delete(event.pointerId);
  if (!endPinch(r, event.pointerId) && r.press?.id === event.pointerId) cancelPress(r);
}

function reset(r: Recogniser): void {
  cancelPress(r);
  r.pinch = null;
  r.touches.clear();
  r.lastTap = null;
  r.space = false;
}

function route(r: Recogniser, event: InputEvent): void {
  switch (event.type) {
    case 'pointer-down':
      pointerDown(r, event);
      break;
    case 'pointer-move':
      pointerMove(r, event);
      break;
    case 'pointer-up':
      pointerUp(r, event);
      break;
    case 'pointer-cancel':
      pointerCancel(r, event);
      break;
    case 'key-down':
    case 'key-up':
      if (event.code === 'Space') r.space = event.type === 'key-down';
      break;
    case 'focus-lost':
      reset(r);
      break;
    case 'wheel':
      break;
  }
}

/** A recogniser that emits each gesture as it completes; long presses come from the scheduler. */
export function createGestureRecogniser(
  scheduler: Scheduler,
  emit: (gesture: Gesture) => void,
): GestureRecogniser {
  const r: Recogniser = {
    emit,
    scheduler,
    touches: new Map(),
    press: null,
    pinch: null,
    lastTap: null,
    space: false,
    timer: null,
  };
  let disposed = false;
  return {
    input(event) {
      if (!disposed) route(r, event);
    },
    cancel() {
      const open = r.press !== null && !r.press.camera;
      if (open) cancelPress(r);
      return open;
    },
    dispose() {
      disposed = true;
      stopTimer(r);
    },
  };
}
