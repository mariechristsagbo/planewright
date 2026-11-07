import type { FontFamily, FontSpec, Stroke, TextElement, TextLayout } from '@planewright/engine';

import type { Context2D } from './canvas.ts';
import type { Drawing } from './trace.ts';

// Painting one element in its local frame
// (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

/** Generic families until the text issue (ENG-12) chooses the fonts behind each family. */
const FAMILIES: Readonly<Record<FontFamily, string>> = {
  sans: 'sans-serif',
  hand: 'cursive',
  mono: 'monospace',
};

const fontOf = (font: FontSpec): string => `${String(font.size)}px ${FAMILIES[font.family]}`;

/** Dash patterns in multiples of the stroke width, so they scale with it. */
const DASHES: Readonly<Record<Exclude<Stroke['dash'], 'solid'>, readonly [number, number]>> = {
  dashed: [4, 4],
  dotted: [1, 2],
};

/** Where a line's anchor sits in a text's box, as a fraction of its width. */
const ANCHOR: Readonly<Record<TextElement['content']['align'], number>> = {
  left: 0,
  center: 0.5,
  right: 1,
};

function paintStroke(context: Context2D, drawing: Drawing): void {
  const { stroke } = drawing.element.style;
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  if (stroke.dash !== 'solid') {
    context.setLineDash(DASHES[stroke.dash].map((step) => step * stroke.width));
  }
  if (!drawing.closed) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
  }
  context.stroke(drawing.path);
}

function paintFill(context: Context2D, drawing: Drawing): void {
  const { fill } = drawing.element.style;
  if (!drawing.closed || fill === null) return;
  // Hatch fills are P1: until then every pattern fills solid.
  context.fillStyle = fill.color;
  context.fill(drawing.path);
}

function paintText(context: Context2D, element: TextElement, layout: TextLayout): void {
  const { font, align } = element.content;
  context.font = fontOf(font);
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = element.style.stroke.color;
  const x = ANCHOR[align] * element.width;
  layout.lines.forEach((line, index) => {
    context.fillText(line.text, x, (index + 0.5) * layout.lineHeight);
  });
}

/**
 * Paints an element whose frame is placed: a fill under the stroke for a filled closed kind, a
 * stroke with round caps and joins for lines and freehand strokes, a one-point stroke's disc in
 * its stroke colour, and a text's lines in its stroke colour over its filled box. Opacity is the
 * global alpha; the sketch styles are P1, so every shape is drawn exactly.
 */
export function paint(context: Context2D, drawing: Drawing): void {
  const { element, layout } = drawing;
  context.globalAlpha = element.style.opacity;
  if (drawing.dot) {
    context.fillStyle = element.style.stroke.color;
    context.fill(drawing.path);
    return;
  }
  paintFill(context, drawing);
  if (element.kind === 'text' && layout !== null) {
    paintText(context, element, layout);
    return;
  }
  paintStroke(context, drawing);
}
