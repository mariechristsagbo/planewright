import type { Gesture } from '../../src/input/gestures.ts';
import type { KeyInput, Modifiers, PointerInput, WheelInput } from '../../src/input/events.ts';
import { createGestureRecogniser } from '../../src/input/recogniser.ts';
import type { GestureRecogniser } from '../../src/input/recogniser.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { createManualClock, createQueueScheduler } from './fakes.ts';
import type { QueueScheduler } from './fakes.ts';

// Engine input events as the web app's input adapter makes them, and a gesture recogniser over a
// queue scheduler that keeps what it emits.

export const NO_MODIFIERS: Modifiers = { shift: false, alt: false, mod: false };

export interface PointerOptions {
  readonly id?: number;
  readonly pointer?: PointerKind;
  readonly button?: PointerInput['button'];
  readonly time?: number;
  readonly pressure?: number;
  readonly modifiers?: Partial<Modifiers>;
}

export function pointerEvent(
  type: PointerInput['type'],
  x: number,
  y: number,
  options: PointerOptions = {},
): PointerInput {
  return {
    type,
    pointerId: options.id ?? 1,
    pointer: options.pointer ?? 'mouse',
    button: options.button ?? 'primary',
    at: { x, y },
    ...(options.pressure === undefined ? {} : { pressure: options.pressure }),
    modifiers: { ...NO_MODIFIERS, ...options.modifiers },
    time: options.time ?? 0,
  };
}

export const down = (x: number, y: number, options?: PointerOptions): PointerInput =>
  pointerEvent('pointer-down', x, y, options);
export const move = (x: number, y: number, options?: PointerOptions): PointerInput =>
  pointerEvent('pointer-move', x, y, options);
export const up = (x: number, y: number, options?: PointerOptions): PointerInput =>
  pointerEvent('pointer-up', x, y, options);

export function keyEvent(
  type: KeyInput['type'],
  key: string,
  code: string,
  modifiers: Partial<Modifiers> = {},
): KeyInput {
  return { type, key, code, repeat: false, modifiers: { ...NO_MODIFIERS, ...modifiers }, time: 0 };
}

export function wheelEvent(
  at: { readonly x: number; readonly y: number },
  delta: { readonly x: number; readonly y: number },
  options: { readonly zoom?: boolean; readonly shift?: boolean } = {},
): WheelInput {
  return {
    type: 'wheel',
    at,
    delta,
    zoom: options.zoom ?? false,
    modifiers: { ...NO_MODIFIERS, shift: options.shift ?? false },
    time: 0,
  };
}

export interface RecogniserHarness {
  readonly scheduler: QueueScheduler;
  readonly recogniser: GestureRecogniser;
  /** Feeds the events and returns the gestures emitted since the last call. */
  readonly feed: (...events: readonly Parameters<GestureRecogniser['input']>[0][]) => Gesture[];
  /** The gestures emitted since the last call, for example by a long-press timer. */
  readonly take: () => Gesture[];
}

export function recogniserHarness(): RecogniserHarness {
  const scheduler = createQueueScheduler(createManualClock());
  const gestures: Gesture[] = [];
  const recogniser = createGestureRecogniser(scheduler, (gesture) => gestures.push(gesture));
  return {
    scheduler,
    recogniser,
    feed: (...events) => {
      for (const event of events) recogniser.input(event);
      return gestures.splice(0);
    },
    take: () => gestures.splice(0),
  };
}

/** The types of some gestures, in order. */
export const typesOf = (gestures: readonly Gesture[]): string[] => gestures.map(({ type }) => type);
