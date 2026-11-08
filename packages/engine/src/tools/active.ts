import { drawingTool } from './drawing-tool.ts';
import { freehandTool } from './freehand-tool.ts';
import { handTool } from './hand.ts';
import { selectionTool } from './selection-tool.ts';
import { textTool } from './text-tool.ts';
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
  switch (id) {
    case 'hand':
      return activate(handTool);
    case 'selection':
      return activate(selectionTool);
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
    case 'line':
      return activate(drawingTool(id));
    case 'freehand':
      return activate(freehandTool);
    case 'text':
      return activate(textTool);
  }
}

/** Whether a tool creates elements, so that choosing it clears the selection. */
export const isCreationTool = (id: ToolId): boolean => id !== 'selection' && id !== 'hand';
