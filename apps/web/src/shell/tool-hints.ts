import type { ToolId } from '@planewright/engine';

// The tool hints (ADR 0012, decisions 1 and 3; the v0.2 plan's S10): one caption line under the
// palette saying what the active tool does. They are Planewright's own words, a constant of the
// shell per tool identifier rather than the engine's, typed by ToolId so that every tool has one.

/** What each tool does, in one line of at most 50 characters with no final full stop. */
export const TOOL_HINTS: Readonly<Record<ToolId, string>> = {
  hand: 'Drag to pan the view',
  selection: 'Select, move, resize or rotate what is drawn',
  rectangle: 'Drag to draw a rectangle; tap for the default size',
  ellipse: 'Drag to draw an ellipse; tap for the default size',
  diamond: 'Drag to draw a diamond; tap for the default size',
  line: 'Drag to draw a line; tap for a horizontal one',
  freehand: 'Drag to draw a stroke; tap for a dot',
  text: 'Tap to place a text, then type it',
};

/** The hint of a tool. */
export const hintOf = (tool: ToolId): string => TOOL_HINTS[tool];
