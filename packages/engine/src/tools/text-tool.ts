import { CLEAR_SELECTION, showing } from './creation.ts';
import { newElementOf, textAt, withinLimits } from './new-elements.ts';
import type { GestureEvent, Tool, ToolContext, ToolStep } from './tool.ts';

// The Text tool (docs/architecture/engine/interaction.md#p0-tools): a tap adds an empty text whose
// left edge is at the tap and whose first line is centred vertically on it, which opens the
// gesture's transaction, and the editor then edits it in that transaction (REQ-C09, REQ-C10).

export interface TextToolState {
  readonly type: 'idle';
}

type Step = ToolStep<TextToolState>;
type PointerGesture = Exclude<GestureEvent, { readonly type: 'cancel' }>;

const IDLE: TextToolState = { type: 'idle' };
const STAY: Step = { state: IDLE, effects: [] };

/** A tap clears the selection, adds the empty text and starts editing it; past the limits, nothing. */
function place(event: PointerGesture, context: ToolContext): Step {
  const base = newElementOf(context.scene, context.newId(), context.defaults);
  const element = textAt(base, event.scene, context.measurer);
  if (!withinLimits(element)) return STAY;
  return {
    state: IDLE,
    effects: [
      CLEAR_SELECTION,
      showing(element, false, context.scene),
      { type: 'edit-text', id: element.id },
    ],
  };
}

/** The tool that places texts; a double tap places as a tap does, and nothing else acts. */
export const textTool: Tool<TextToolState> = {
  id: 'text',
  initial: IDLE,
  cursor: 'text',
  reduce(_state, event, context): Step {
    return event.type === 'tap' || event.type === 'double-tap' ? place(event, context) : STAY;
  },
};
