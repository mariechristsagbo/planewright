import type { PointerPair } from '../camera/pinch.ts';
import type { Point } from '../model/elements.ts';
import type { PointerKind } from '../selection/pointer.ts';
import type { Modifiers } from './events.ts';

// What the gesture recogniser makes of input events
// (docs/architecture/engine/interaction.md#gesture-recogniser). Tool gestures are in screen space;
// the editor adds the scene point before a tool sees them.

/** How far, in screen pixels, a pressed pointer must move to start a drag (strictly more). */
export const DRAG_THRESHOLD: Readonly<Record<PointerKind, number>> = { mouse: 3, pen: 3, touch: 6 };
/** A touch or pen tap must be shorter than this. */
export const TAP_MAX_MS = 500;
/** A touch or pen press held this long without a drag is a long press. */
export const LONG_PRESS_MS = 500;
/** Two taps at most this far apart in time and space make a double tap. */
export const DOUBLE_TAP_MS = 400;
export const DOUBLE_TAP_DISTANCE = 8;

export type Gesture =
  | {
      readonly type: 'press' | 'drag-start' | 'drag' | 'release';
      readonly at: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
      readonly pressure?: number;
    }
  | {
      readonly type: 'tap' | 'double-tap';
      readonly at: Point;
      readonly pointer: PointerKind;
      readonly modifiers: Modifiers;
    }
  /** Opens the context menu in P1 (REQ-S14); nothing acts on it yet. */
  | { readonly type: 'long-press'; readonly at: Point; readonly pointer: PointerKind }
  /** The tool's gesture ends without effect: a second touch, a cancelled pointer or focus loss. */
  | { readonly type: 'cancel' }
  /** A camera drag moved by a screen delta: a middle-button or Space+primary drag. */
  | { readonly type: 'pan'; readonly delta: Point }
  /** A second touch pointer went down: a two-pointer camera gesture starts. */
  | { readonly type: 'pinch-start'; readonly from: PointerPair }
  | { readonly type: 'pinch'; readonly from: PointerPair; readonly to: PointerPair };
