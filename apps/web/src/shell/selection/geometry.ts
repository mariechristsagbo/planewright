import { localBox } from '@planewright/engine';
import type { Element, ElementId, ElementKind, Point } from '@planewright/engine';

import { decimal, normalizedDegrees } from '../../a11y/rounding.ts';

// The selection's figures (ADR 0012; the v0.2 plan's S6): what the selection panel, the phone's
// bar and the Details sheet show, read-only, from the view's elements and selection. One element
// shows its unrotated local box, as its list name and row do, its turn and its kind's own figure;
// several show their count and the axis-aligned box of their turned local boxes, with no stroke
// width, which the canvas's selection frame adds and this geometry does not. The module is pure: no
// React, DOM, editor, storage or timer, and of the engine only its types and localBox.

export { normalizedDegrees };

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The figure that a kind adds to the box and the turn. */
export type KindFigure =
  | { readonly term: 'Length'; readonly value: number }
  | { readonly term: 'Points'; readonly value: number }
  | { readonly term: 'Lines'; readonly value: number };

export type SelectionGeometry =
  | {
      readonly type: 'single';
      readonly kind: ElementKind;
      readonly box: Bounds;
      readonly degrees: number;
      readonly figure: KindFigure | null;
    }
  | { readonly type: 'multiple'; readonly count: number; readonly box: Bounds };

/** A figure as the panel shows it: its term, its value's text and, if the term is short, its word. */
export interface Figure {
  readonly term: string;
  readonly value: string;
  /** The term's full word, which assistive technology reads in place of the shown term. */
  readonly word: string | null;
}

/** The sum of the distances between consecutive points. */
function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [from, to] = [points[index - 1], points[index]];
    if (from !== undefined && to !== undefined) length += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return length;
}

/** A line's length, a freehand stroke's points or a text's lines; nothing for the other kinds. */
function figureOf(element: Element): KindFigure | null {
  if (element.kind === 'line') return { term: 'Length', value: pathLength(element.points) };
  if (element.kind === 'freehand') return { term: 'Points', value: element.points.length };
  // P0 texts do not wrap, so a text's lines are those its line breaks make.
  if (element.kind === 'text') {
    return { term: 'Lines', value: element.content.text.split('\n').length };
  }
  return null;
}

/** The axis-aligned box of an element's localBox corners turned by its rotation about the box's centre. */
export function rotatedBounds(element: Element): Bounds {
  const box = localBox(element);
  // An unturned box is used as it is, so that no rounding moves it.
  if (element.rotation === 0) return box;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const [cos, sin] = [Math.cos(element.rotation), Math.sin(element.rotation)];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [dx, dy] of [
    [-box.width / 2, -box.height / 2],
    [box.width / 2, -box.height / 2],
    [box.width / 2, box.height / 2],
    [-box.width / 2, box.height / 2],
  ] as const) {
    xs.push(cx + dx * cos - dy * sin);
    ys.push(cy + dx * sin + dy * cos);
  }
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return { x: left, y: top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** The union of boxes, of which there is at least one. */
function unionOf(boxes: readonly Bounds[]): Bounds {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { x, y, width, height } of boxes) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + width);
    bottom = Math.max(bottom, y + height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The selected elements of `elements`, in selection order; ids not found are skipped; null when none is found. */
export function selectionGeometry(
  elements: readonly Element[],
  selection: readonly ElementId[],
): SelectionGeometry | null {
  if (selection.length === 0) return null;
  const byId = new Map(elements.map((element) => [element.id, element] as const));
  const selected = selection.flatMap((id) => byId.get(id) ?? []);
  const [first] = selected;
  if (first === undefined) return null;
  if (selected.length > 1) {
    return { type: 'multiple', count: selected.length, box: unionOf(selected.map(rotatedBounds)) };
  }
  return {
    type: 'single',
    kind: first.kind,
    box: localBox(first),
    degrees: normalizedDegrees(first.rotation),
    figure: figureOf(first),
  };
}

/** The figures as the panel shows them: term, value text, and the term's full word for assistive technology. */
export function figuresOf(geometry: SelectionGeometry): readonly Figure[] {
  const { x, y, width, height } = geometry.box;
  const box: Figure[] = [
    { term: 'X', value: decimal(x), word: null },
    { term: 'Y', value: decimal(y), word: null },
    { term: 'W', value: decimal(width), word: 'Width' },
    { term: 'H', value: decimal(height), word: 'Height' },
  ];
  if (geometry.type === 'multiple') return box;
  const angle: Figure = { term: 'Angle', value: `${decimal(geometry.degrees)}°`, word: null };
  const { figure } = geometry;
  if (figure === null) return [...box, angle];
  const value = figure.term === 'Length' ? decimal(figure.value) : String(figure.value);
  return [...box, angle, { term: figure.term, value, word: null }];
}
