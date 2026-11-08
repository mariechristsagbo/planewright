import { distance } from '../math/vector.ts';
import type { Point } from '../model/elements.ts';
import { LIMITS } from '../model/limits.ts';
import { CLEAR_SELECTION, created, showing } from './creation.ts';
import { newElementOf, strokeThrough, withinLimits } from './new-elements.ts';
import type { NewElement } from './new-elements.ts';
import type { GestureEvent, Tool, ToolContext, ToolStep } from './tool.ts';

// The freehand tool (docs/architecture/engine/interaction.md#p0-tools): a drag takes a point
// whenever the pointer has moved 1 screen pixel and previews the stroke through them; the release
// commits it and a tap commits a one-point dot; the tool stays active and selects nothing
// (REQ-C06, REQ-C07). Pressures are P1 (REQ-C08), so the stroke keeps none.

export type FreehandState =
  | { readonly type: 'idle' }
  /** Pressed at a screen point and its scene point; a drag from it strokes. */
  | { readonly type: 'pressing'; readonly at: Point; readonly scene: Point }
  /**
   * Stroking through scene points; `last` is the screen point of the last point taken, and `shown`
   * is set once a preview has added the stroke.
   */
  | {
      readonly type: 'stroking';
      readonly base: NewElement;
      readonly points: readonly Point[];
      readonly last: Point;
      readonly shown: boolean;
    };

type Step = ToolStep<FreehandState>;
type Stroking = Extract<FreehandState, { readonly type: 'stroking' }>;
type PointerGesture = Exclude<GestureEvent, { readonly type: 'cancel' }>;

/** How far, in screen pixels, the pointer moves from the last point before the next is taken. */
export const POINT_SPACING = 1;
/** The most points a stroke takes: the document's limit for a freehand element. */
export const FREEHAND_POINT_LIMIT = LIMITS.freehandPoints;

const IDLE: FreehandState = { type: 'idle' };
const stay = (state: FreehandState): Step => ({ state, effects: [] });

/**
 * Takes the pointer's point once it has moved far enough from the last one, while the stroke has
 * room and stays within the document's limits, and shows the stroke: the first preview clears the
 * selection and adds it, the next ones update it.
 */
function extend(stroke: Stroking, event: PointerGesture, context: ToolContext, limit: number) {
  const far = distance(event.at, stroke.last) >= POINT_SPACING;
  if (!far || stroke.points.length >= limit) return stay(stroke);
  const points = [...stroke.points, event.scene];
  const element = strokeThrough(stroke.base, points);
  if (!withinLimits(element)) return stay(stroke);
  const preview = showing(element, stroke.shown, context.scene);
  return {
    state: { ...stroke, points, last: event.at, shown: true },
    effects: stroke.shown ? [preview] : [CLEAR_SELECTION, preview],
  };
}

/** A drag from a press starts the stroke at the press, then each move may take a point. */
function drag(state: FreehandState, event: PointerGesture, context: ToolContext, limit: number) {
  if (state.type === 'idle') return stay(state);
  if (state.type === 'stroking') return extend(state, event, context, limit);
  const base = newElementOf(context.scene, context.newId(), context.defaults);
  const start: Stroking = {
    type: 'stroking',
    base,
    points: [state.scene],
    last: state.at,
    shown: false,
  };
  return extend(start, event, context, limit);
}

/** The release may take its point, then a shown stroke is committed; a press alone makes nothing. */
function release(state: FreehandState, event: PointerGesture, context: ToolContext, limit: number) {
  if (state.type !== 'stroking') return stay(IDLE);
  const last = extend(state, event, context, limit);
  if (last.state.type !== 'stroking' || !last.state.shown) return stay(IDLE);
  return { state: IDLE, effects: [...last.effects, ...created(state.base.id, context, true)] };
}

/** A tap commits a one-point dot of zero size at the tap (REQ-C07). */
function tap(event: PointerGesture, context: ToolContext): Step {
  const base = newElementOf(context.scene, context.newId(), context.defaults);
  const dot = strokeThrough(base, [event.scene]);
  if (!withinLimits(dot)) return stay(IDLE);
  return {
    state: IDLE,
    effects: [
      CLEAR_SELECTION,
      showing(dot, false, context.scene),
      ...created(base.id, context, true),
    ],
  };
}

/** A freehand tool that takes at most `limit` points per stroke; a double tap draws as a tap does. */
export function strokingTool(limit: number): Tool<FreehandState> {
  return {
    id: 'freehand',
    initial: IDLE,
    cursor: 'crosshair',
    reduce(state, event, context): Step {
      switch (event.type) {
        case 'press':
          return stay({ type: 'pressing', at: event.at, scene: event.scene });
        case 'drag-start':
        case 'drag':
          return drag(state, event, context, limit);
        case 'release':
          return release(state, event, context, limit);
        case 'tap':
        case 'double-tap':
          return tap(event, context);
        case 'cancel':
          return {
            state: IDLE,
            effects: state.type === 'stroking' && state.shown ? [{ type: 'cancel' }] : [],
          };
      }
    },
  };
}

export const freehandTool: Tool<FreehandState> = strokingTool(FREEHAND_POINT_LIMIT);
