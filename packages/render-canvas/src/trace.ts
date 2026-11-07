import { geometryOf, layoutText, localBox } from '@planewright/engine';
import type { Element, PathCommand, TextLayout, TextMeasurer } from '@planewright/engine';

import type { PathSink } from './canvas.ts';

// Turning the engine's outlines into paths (ADR 0006: shared geometry).

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
  /** A text's lines; null for every other kind. */
  readonly layout: TextLayout | null;
}

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
 * (the arrow, note, image and frame), which P0 neither creates nor draws.
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
  const layout = element.kind === 'text' ? layoutText(element.content, measurer) : null;
  return { element, path, dot, closed: geometry.isClosed(element), width, height, layout };
}
