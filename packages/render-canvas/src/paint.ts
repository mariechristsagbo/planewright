import type { TextElement } from '@planewright/engine';

import type { Context2D } from './canvas.ts';
import type { SceneState } from './scene-state.ts';
import type { Drawing, TextDrawing } from './trace.ts';

// Painting one element in its local frame
// (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

/** Where a line's anchor sits in a text's box, as a fraction of its width. */
const ANCHOR: Readonly<Record<TextElement['content']['align'], number>> = {
  left: 0,
  center: 0.5,
  right: 1,
};

function paintStroke(context: Context2D, state: SceneState, drawing: Drawing): void {
  const { stroke } = drawing.element.style;
  state.stroke(stroke.color, stroke.width, drawing.dash, drawing.closed ? 'closed' : 'round');
  context.stroke(drawing.path);
}

function paintFill(context: Context2D, state: SceneState, drawing: Drawing): void {
  const { fill } = drawing.element.style;
  if (!drawing.closed || fill === null) return;
  // Hatch fills are P1: until then every pattern fills solid.
  state.fillStyle(fill.color);
  context.fill(drawing.path);
}

function paintText(
  context: Context2D,
  state: SceneState,
  element: TextElement,
  { layout, font }: TextDrawing,
): void {
  const { align } = element.content;
  state.text(font, align);
  state.fillStyle(element.style.stroke.color);
  const x = ANCHOR[align] * element.width;
  let index = 0;
  for (const line of layout.lines) {
    context.fillText(line.text, x, (index + 0.5) * layout.lineHeight);
    index += 1;
  }
}

/**
 * Paints an element whose frame is placed: a fill under the stroke for a filled closed kind, a
 * stroke with round caps and joins for lines and freehand strokes, a one-point stroke's disc in
 * its stroke colour, and a text's lines in its stroke colour over its filled box. Opacity is the
 * global alpha; the sketch styles are P1, so every shape is drawn exactly. Every state that a
 * drawing call depends on is set through the frame's scene state, so it holds this element's
 * value whatever the element before it set.
 */
export function paint(context: Context2D, state: SceneState, drawing: Drawing): void {
  const { element, text } = drawing;
  state.alpha(element.style.opacity);
  if (drawing.dot) {
    state.fillStyle(element.style.stroke.color);
    context.fill(drawing.path);
    return;
  }
  paintFill(context, state, drawing);
  if (element.kind === 'text' && text !== null) {
    paintText(context, state, element, text);
    return;
  }
  paintStroke(context, state, drawing);
}
