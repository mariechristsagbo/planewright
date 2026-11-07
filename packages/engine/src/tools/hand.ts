import { subtract } from '../math/vector.ts';
import type { Point } from '../model/elements.ts';
import type { Tool, ToolStep } from './tool.ts';

// The Hand tool (docs/architecture/engine/interaction.md#p0-tools, REQ-V06).

export type HandState =
  | { readonly type: 'idle' }
  /** Pressed: each move pans by its delta from the last point. */
  | { readonly type: 'panning'; readonly last: Point };

const IDLE: HandState = { type: 'idle' };

/** A drag pans the camera by exactly the pointer delta; the cursor is a hand, closed while pressed. */
export const handTool: Tool<HandState> = {
  id: 'hand',
  initial: IDLE,
  cursor: 'grab',
  reduce(state, event): ToolStep<HandState> {
    if (event.type === 'press') {
      return {
        state: { type: 'panning', last: event.at },
        effects: [{ type: 'cursor', cursor: 'grabbing' }],
      };
    }
    if (state.type === 'idle') return { state, effects: [] };
    if (event.type === 'drag-start' || event.type === 'drag') {
      return {
        state: { type: 'panning', last: event.at },
        effects: [{ type: 'pan', delta: subtract(event.at, state.last) }],
      };
    }
    return { state: IDLE, effects: [{ type: 'cursor', cursor: 'grab' }] };
  },
};
