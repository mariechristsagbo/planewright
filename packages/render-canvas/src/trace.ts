import { geometryOf, layoutText, localBox } from '@planewright/engine';
import type { Element, PathCommand, Stroke, TextLayout, TextMeasurer } from '@planewright/engine';

import type { PathSink } from './canvas.ts';
import { canvasFont } from './fonts.ts';

// Turning the engine's outlines into paths (ADR 0006: shared geometry).

/** A text's lines, and its font as a 2D context names it. */
export interface TextDrawing {
  readonly layout: TextLayout;
  readonly font: string;
}

/** What the renderer keeps of an element at one revision. */
export interface Drawing {
  readonly element: Element;
  /** The outline in the element's local frame, or a one-point stroke's disc. */
  readonly path: Path2D;
  /** A one-point freehand stroke: its path is a disc to fill with the stroke's colour. */
  readonly dot: boolean;
  /** Whether a fill applies, as hit testing reads it. */
  readonly closed: boolean;
  /** The local box's size, about whose centre the element turns. */
  readonly width: number;
  readonly height: number;
  /** A text's lines and font; null for every other kind. */
  readonly text: TextDrawing | null;
  /** The stroke's dash pattern in scene units; empty for a solid stroke. */
  readonly dash: readonly number[];
}

/** Dash patterns in multiples of the stroke width, so they scale with it. */
const DASHES: Readonly<Record<Stroke['dash'], readonly number[]>> = {
  solid: [],
  dashed: [4, 4],
  dotted: [1, 2],
};

const dashOf = (stroke: Stroke): readonly number[] =>
  DASHES[stroke.dash].map((step) => step * stroke.width);

/** Traces outline commands, in local coordinates, into a path. */
export function trace(path: PathSink, commands: readonly PathCommand[]): void {
  for (const command of commands) {
    switch (command.op) {
      case 'move':
        path.moveTo(command.to.x, command.to.y);
        break;
      case 'line':
        path.lineTo(command.to.x, command.to.y);
        break;
      case 'cubic':
        path.bezierCurveTo(
          command.c1.x,
          command.c1.y,
          command.c2.x,
          command.c2.y,
          command.to.x,
          command.to.y,
        );
        break;
      case 'close':
        path.closePath();
        break;
    }
  }
}

const isDot = (element: Element): boolean =>
  element.kind === 'freehand' && element.points.length === 1;

/**
 * The drawing of an element at its revision, or undefined for a kind that has no geometry yet
 * (the arrow, note, image and frame), which P0 neither creates nor draws. A text's font and a
 * stroke's dash pattern are built here once, rather than in every frame that draws them.
 */
export function drawingOf(
  element: Element,
  createPath: () => Path2D,
  measurer: TextMeasurer,
): Drawing | undefined {
  const geometry = geometryOf(element);
  if (geometry === undefined) return undefined;
  const path = createPath();
  const dot = isDot(element);
  const [first] = 'points' in element ? element.points : [];
  if (dot && first !== undefined) {
    path.arc(first.x, first.y, element.style.stroke.width / 2, 0, 2 * Math.PI);
  } else {
    trace(path, geometry.outline(element));
  }
  const { width, height } = localBox(element);
  return {
    element,
    path,
    dot,
    closed: geometry.isClosed(element),
    width,
    height,
    text:
      element.kind === 'text'
        ? { layout: layoutText(element.content, measurer), font: canvasFont(element.content.font) }
        : null,
    dash: dashOf(element.style.stroke),
  };
}
