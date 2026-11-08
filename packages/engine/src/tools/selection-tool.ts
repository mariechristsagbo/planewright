import { aabbFromCorners } from '../math/aabb.ts';
import type { Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { HandleId } from '../selection/handles.ts';
import { enclosedBy } from '../selection/marquee.ts';
import type { GestureEvent, Tool, ToolContext, ToolStep } from './tool.ts';
import { commitOf, previewOf, startTransform } from './transform-gesture.ts';
import type { TransformGesture } from './transform-gesture.ts';

// The Selection tool (docs/architecture/engine/interaction.md#selection-tool). A drag from a
// handle resizes or rotates, and a drag from an element or the selection box moves the selection
// (docs/architecture/engine/interaction.md#transforms). Each effect reads the modifiers of the
// gesture that makes it: a press adds with Shift, a tap removes with Shift, a marquee adds with
// Shift at its release, and each move of a resize or rotation reads Shift and Alt.

export type SelectionToolState =
  | { readonly type: 'idle' }
  /** Pressed on a handle of the selection at a scene point: a drag resizes or rotates. */
  | { readonly type: 'pressing-handle'; readonly handle: HandleId; readonly from: Point }
  /** Pressed on an element; `added` when that press selected it, so a Shift+tap keeps it. */
  | {
      readonly type: 'pressing-element';
      readonly id: ElementId;
      readonly added: boolean;
      readonly from: Point;
    }
  /** Pressed inside the selection box on no element: a drag moves the selection. */
  | { readonly type: 'pressing-selection-box'; readonly from: Point }
  /** Pressed on empty canvas at a scene point; a drag from it draws a marquee. */
  | { readonly type: 'pressing-empty'; readonly from: Point }
  | { readonly type: 'box-selecting'; readonly from: Point }
  /** A move, resize or rotation, whose transaction the editor holds open until its release. */
  | { readonly type: 'transforming'; readonly gesture: TransformGesture };

type Step = ToolStep<SelectionToolState>;
type PointerGesture = Exclude<GestureEvent, { readonly type: 'cancel' }>;

const IDLE: SelectionToolState = { type: 'idle' };
const stay = (state: SelectionToolState): Step => ({ state, effects: [] });
const select = (ids: readonly ElementId[]): Step => ({
  state: IDLE,
  effects: [{ type: 'select', ids }],
});

/** A press on an unselected element selects it, or adds it with Shift; nothing else selects. */
function press(event: PointerGesture, context: ToolContext): Step {
  const hit = context.hit(event.at, event.pointer);
  const selected = context.selection.ids;
  switch (hit.type) {
    case 'handle':
      return stay({ type: 'pressing-handle', handle: hit.handle, from: event.scene });
    case 'selection-box':
      return stay({ type: 'pressing-selection-box', from: event.scene });
    case 'none':
      return stay({ type: 'pressing-empty', from: event.scene });
    case 'element': {
      if (selected.includes(hit.id)) {
        return stay({ type: 'pressing-element', id: hit.id, added: false, from: event.scene });
      }
      const ids = event.modifiers.shift ? [...selected, hit.id] : [hit.id];
      return {
        state: { type: 'pressing-element', id: hit.id, added: true, from: event.scene },
        effects: [{ type: 'select', ids }],
      };
    }
  }
}

/** A drag from empty canvas draws the marquee from the press to the pointer, in scene units. */
const marquee = (from: Point, event: PointerGesture): Step => ({
  state: { type: 'box-selecting', from },
  effects: [{ type: 'marquee', box: aabbFromCorners(from, event.scene) }],
});

/** A transform previews its whole result for the pointer; nothing is selected to transform without one. */
const transform = (
  gesture: TransformGesture | null,
  event: PointerGesture,
  context: ToolContext,
): Step =>
  gesture === null
    ? stay(IDLE)
    : { state: { type: 'transforming', gesture }, effects: [previewOf(gesture, event, context)] };

/** A drag from empty canvas draws a marquee; one from the selection or a handle transforms it. */
function drag(state: SelectionToolState, event: PointerGesture, context: ToolContext): Step {
  switch (state.type) {
    case 'pressing-empty':
    case 'box-selecting':
      return marquee(state.from, event);
    case 'pressing-element':
    case 'pressing-selection-box':
      return transform(startTransform(null, state.from, context), event, context);
    case 'pressing-handle':
      return transform(startTransform(state.handle, state.from, context), event, context);
    case 'transforming':
      return transform(state.gesture, event, context);
    case 'idle':
      return stay(state);
  }
}

/**
 * A transform's release commits it as one undo step; the marquee's selects what it wholly
 * encloses, added to the selection with Shift.
 */
function release(state: SelectionToolState, event: PointerGesture, context: ToolContext): Step {
  if (state.type === 'transforming') return { state: IDLE, effects: [commitOf(state.gesture)] };
  if (state.type !== 'box-selecting') return stay(IDLE);
  const enclosed = enclosedBy(context.scene, aabbFromCorners(state.from, event.scene));
  const ids = event.modifiers.shift
    ? [...new Set([...context.selection.ids, ...enclosed])]
    : enclosed;
  return {
    state: IDLE,
    effects: [
      { type: 'marquee', box: null },
      { type: 'select', ids },
    ],
  };
}

/**
 * A Shift+tap removes an element that was selected before its press. A tap inside the selection
 * box on no element falls through to what is under it, which the hit order makes nothing, so it
 * clears the selection, as a tap on empty canvas does (REQ-S10, REQ-T07).
 */
function tap(state: SelectionToolState, event: PointerGesture, context: ToolContext): Step {
  switch (state.type) {
    case 'pressing-element': {
      if (state.added || !event.modifiers.shift) return stay(IDLE);
      return select(context.selection.ids.filter((id) => id !== state.id));
    }
    case 'pressing-selection-box':
    case 'pressing-empty':
      return select([]);
    case 'idle':
    case 'pressing-handle':
    case 'box-selecting':
    case 'transforming':
      return stay(IDLE);
  }
}

/** A double tap on a text edits it (REQ-C10); with Shift, or anywhere else, it acts as a tap. */
function doubleTap(state: SelectionToolState, event: PointerGesture, context: ToolContext): Step {
  if (state.type === 'pressing-element' && !event.modifiers.shift) {
    if (context.scene.get(state.id)?.kind === 'text') {
      return { state: IDLE, effects: [{ type: 'edit-text', id: state.id }] };
    }
  }
  return tap(state, event, context);
}

/**
 * A cancelled transform reverts its previews without an undo step; a cancelled marquee disappears.
 * Either leaves the selection as it was.
 */
function cancel(state: SelectionToolState): Step {
  if (state.type === 'transforming') return { state: IDLE, effects: [{ type: 'cancel' }] };
  return state.type === 'box-selecting'
    ? { state: IDLE, effects: [{ type: 'marquee', box: null }] }
    : stay(IDLE);
}

/** The Selection tool; a double tap on a text edits it. */
export const selectionTool: Tool<SelectionToolState> = {
  id: 'selection',
  initial: IDLE,
  cursor: 'default',
  reduce(state, event, context): Step {
    switch (event.type) {
      case 'press':
        return press(event, context);
      case 'drag-start':
      case 'drag':
        return drag(state, event, context);
      case 'release':
        return release(state, event, context);
      case 'tap':
        return tap(state, event, context);
      case 'double-tap':
        return doubleTap(state, event, context);
      case 'cancel':
        return cancel(state);
    }
  },
};
