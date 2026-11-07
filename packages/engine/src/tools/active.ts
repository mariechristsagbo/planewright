import { handTool } from './hand.ts';
import { selectionTool } from './selection-tool.ts';
import type { CursorKind, GestureEvent, Tool, ToolContext, ToolEffect, ToolId } from './tool.ts';

/** A tool with its current state, whatever that state's type is. */
export interface ActiveTool {
  readonly id: ToolId;
  readonly cursor: CursorKind;
  /** Gives the tool one gesture and keeps its next state. */
  reduce(event: GestureEvent, context: ToolContext): readonly ToolEffect[];
}

function activate<State>(tool: Tool<State>): ActiveTool {
  let state = tool.initial;
  return {
    id: tool.id,
    cursor: tool.cursor,
    reduce(event, context) {
      const step = tool.reduce(state, event, context);
      state = step.state;
      return step.effects;
    },
  };
}

/** A tool in its initial state. */
export function activeTool(id: ToolId): ActiveTool {
  return id === 'hand' ? activate(handTool) : activate(selectionTool);
}
