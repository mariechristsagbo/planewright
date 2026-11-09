import type { Point } from '../model/elements.ts';
import { CLEAR_SELECTION, created, showing } from './creation.ts';
import { drawnBetween, newElementOf, roomForOne, tapped, withinLimits } from './new-elements.ts';
import type { DrawnKind, NewElement } from './new-elements.ts';
import type { GestureEvent, Tool, ToolContext, ToolStep } from './tool.ts';

// The rectangle, ellipse, diamond and line tools (docs/architecture/engine/interaction.md#p0-tools):
// a drag previews the element between the press's scene point and the pointer's and commits it on
// release; a tap commits the default size centred on the tap. Modifiers change nothing in P0.

export type DrawingState =
  | { readonly type: 'idle' }
  /** Pressed at a scene point; a drag from it draws. */
  | { readonly type: 'pressing'; readonly from: Point }
  /** Drawing from a scene point; `shown` once a preview has added the element. */
  | {
      readonly type: 'drawing';
      readonly from: Point;
      readonly base: NewElement;
      readonly shown: boolean;
    };

type Step = ToolStep<DrawingState>;
type PointerGesture = Exclude<GestureEvent, { readonly type: 'cancel' }>;

const IDLE: DrawingState = { type: 'idle' };
const stay = (state: DrawingState): Step => ({ state, effects: [] });

/**
 * A drag shows the element from the press to the pointer: the first one clears the selection and
 * adds it, the next ones update it. A step past the document's limits keeps the last one shown,
 * and a full document shows none.
 */
function drag(kind: DrawnKind, state: DrawingState, event: PointerGesture, context: ToolContext) {
  if (state.type === 'idle') return stay(state);
  if (state.type === 'pressing' && !roomForOne(context.scene)) return stay(state);
  const base =
    state.type === 'drawing'
      ? state.base
      : newElementOf(context.scene, context.newId(), context.defaults);
  const shown = state.type === 'drawing' && state.shown;
  const element = drawnBetween(kind, base, state.from, event.scene);
  if (!withinLimits(element)) return stay({ type: 'drawing', from: state.from, base, shown });
  const preview = showing(element, shown, context.scene);
  return {
    state: { type: 'drawing', from: state.from, base, shown: true } as const,
    effects: shown ? [preview] : [CLEAR_SELECTION, preview],
  };
}

/** The release point ends the drag, and a shown element is committed; a press alone makes nothing. */
function release(
  kind: DrawnKind,
  state: DrawingState,
  event: PointerGesture,
  context: ToolContext,
) {
  if (state.type !== 'drawing') return stay(IDLE);
  const last = drag(kind, state, event, context);
  if (last.state.type !== 'drawing' || !last.state.shown) return stay(IDLE);
  return { state: IDLE, effects: [...last.effects, ...created(state.base.id, context, false)] };
}

/** A tap commits the default size centred on it, as one undo step. */
function tap(kind: DrawnKind, event: PointerGesture, context: ToolContext): Step {
  if (!roomForOne(context.scene)) return stay(IDLE);
  const base = newElementOf(context.scene, context.newId(), context.defaults);
  const element = tapped(kind, base, event.scene);
  if (!withinLimits(element)) return stay(IDLE);
  return {
    state: IDLE,
    effects: [
      CLEAR_SELECTION,
      showing(element, false, context.scene),
      ...created(base.id, context, false),
    ],
  };
}

/** The tool that draws one kind; a double tap draws as a tap does. */
export function drawingTool(kind: DrawnKind): Tool<DrawingState> {
  return {
    id: kind,
    initial: IDLE,
    cursor: 'crosshair',
    reduce(state, event, context): Step {
      switch (event.type) {
        case 'press':
          return stay({ type: 'pressing', from: event.scene });
        case 'drag-start':
        case 'drag':
          return drag(kind, state, event, context);
        case 'release':
          return release(kind, state, event, context);
        case 'tap':
        case 'double-tap':
          return tap(kind, event, context);
        case 'cancel':
          return {
            state: IDLE,
            effects: state.type === 'drawing' && state.shown ? [{ type: 'cancel' }] : [],
          };
      }
    },
  };
}
