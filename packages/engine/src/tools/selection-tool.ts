import { aabbFromCorners } from '../math/aabb.ts';
import type { Point } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { enclosedBy } from '../selection/marquee.ts';
import type { GestureEvent, Tool, ToolContext, ToolStep } from './tool.ts';

// The Selection tool (docs/architecture/engine/interaction.md#selection-tool). Its drags from a
// handle, an element or the selection box resize, rotate or move in ENG-10; until then they change
// nothing. Each effect reads the modifiers of the gesture that makes it: a press adds with Shift,
// a tap removes with Shift and a marquee adds with Shift at its release.

export type SelectionToolState =
  | { readonly type: 'idle' }
  /** Pressed on a handle of the selection: ENG-10 resizes or rotates from here. */
  | { readonly type: 'pressing-handle' }
  /** Pressed on an element; `added` when that press selected it, so a Shift+tap keeps it. */
  | { readonly type: 'pressing-element'; readonly id: ElementId; readonly added: boolean }
  /** Pressed inside the selection box on no element: ENG-10 moves the selection from here. */
  | { readonly type: 'pressing-selection-box' }
  /** Pressed on empty canvas at a scene point; a drag from it draws a marquee. */
  | { readonly type: 'pressing-empty'; readonly from: Point }
  | { readonly type: 'box-selecting'; readonly from: Point };

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
      return stay({ type: 'pressing-handle' });
    case 'selection-box':
      return stay({ type: 'pressing-selection-box' });
    case 'none':
      return stay({ type: 'pressing-empty', from: event.scene });
    case 'element': {
      if (selected.includes(hit.id)) {
        return stay({ type: 'pressing-element', id: hit.id, added: false });
      }
      const ids = event.modifiers.shift ? [...selected, hit.id] : [hit.id];
      return {
        state: { type: 'pressing-element', id: hit.id, added: true },
        effects: [{ type: 'select', ids }],
      };
    }
  }
}

/** A drag from empty canvas draws the marquee from the press to the pointer, in scene units. */
function drag(state: SelectionToolState, event: PointerGesture): Step {
  if (state.type !== 'pressing-empty' && state.type !== 'box-selecting') return stay(state);
  const { from } = state;
  return {
    state: { type: 'box-selecting', from },
    effects: [{ type: 'marquee', box: aabbFromCorners(from, event.scene) }],
  };
}

/** The marquee's release selects what it wholly encloses, added to the selection with Shift. */
function release(state: SelectionToolState, event: PointerGesture, context: ToolContext): Step {
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
      return stay(IDLE);
  }
}

/** A cancelled marquee disappears and leaves the selection as it was. */
const cancel = (state: SelectionToolState): Step =>
  state.type === 'box-selecting'
    ? { state: IDLE, effects: [{ type: 'marquee', box: null }] }
    : stay(IDLE);

/** A double tap acts as a tap until a double tap on a text edits it (ENG-12). */
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
        return drag(state, event);
      case 'release':
        return release(state, event, context);
      case 'tap':
      case 'double-tap':
        return tap(state, event, context);
      case 'cancel':
        return cancel(state);
    }
  },
};
