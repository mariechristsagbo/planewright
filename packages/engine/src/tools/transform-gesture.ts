import type { HistoryLabel } from '../history/entry.ts';
import { obbCenter } from '../math/obb.ts';
import { subtract } from '../math/vector.ts';
import type { Box, Element, LineElement, Point } from '../model/elements.ts';
import { selectionFrame } from '../selection/frame.ts';
import type { HandleId } from '../selection/handles.ts';
import { updatesTo } from '../transform/changes.ts';
import { moveLineEnd } from '../transform/line-end.ts';
import { moveBy } from '../transform/move.ts';
import { resizeElements } from '../transform/resize-many.ts';
import { isResizeHandle } from '../transform/resize-ratios.ts';
import type { ResizeHandle } from '../transform/resize-ratios.ts';
import { resizeElement } from '../transform/resize.ts';
import { rotateElements } from '../transform/rotate.ts';
import type { GestureEvent, ToolContext, ToolEffect } from './tool.ts';

// The Selection tool's transform gestures (docs/architecture/engine/interaction.md#transforms). A
// gesture keeps the selected elements as they were when it started, with the scene point of its
// press, and recomputes the whole result from them on every move, so rounding never accumulates;
// it commits one undo step (REQ-T11).

export type TransformGesture =
  | { readonly type: 'move'; readonly from: Point; readonly elements: readonly Element[] }
  | {
      readonly type: 'resize';
      readonly from: Point;
      readonly handle: ResizeHandle;
      readonly elements: readonly Element[];
      /** The selection outline when the gesture started. */
      readonly outline: Box;
    }
  | {
      readonly type: 'rotate';
      readonly from: Point;
      readonly elements: readonly Element[];
      readonly center: Point;
    }
  | {
      readonly type: 'line-end';
      readonly from: Point;
      readonly line: LineElement;
      readonly end: 'start' | 'end';
    };

type PointerGesture = Exclude<GestureEvent, { readonly type: 'cancel' }>;

/** A line's end is a point of its shape, so moving it is recorded as a resize. */
const LABELS: Readonly<Record<TransformGesture['type'], HistoryLabel>> = {
  move: 'move',
  resize: 'resize',
  rotate: 'rotate',
  'line-end': 'resize',
};

const selectedElements = ({ scene, selection }: ToolContext): Element[] =>
  selection.ids.map((id) => scene.get(id)).filter((element) => element !== undefined);

function lineEnd(handle: HandleId, elements: readonly Element[], from: Point) {
  const [line] = elements;
  if (line?.kind !== 'line' || (handle !== 'start' && handle !== 'end')) return null;
  return { type: 'line-end', from, line, end: handle } as const;
}

/**
 * The gesture that a drag starts from a press at a scene point: a move from an element or the
 * selection box, where `handle` is null, or what the pressed handle does; null when nothing that
 * the scene holds is selected.
 */
export function startTransform(
  handle: HandleId | null,
  from: Point,
  context: ToolContext,
): TransformGesture | null {
  const elements = selectedElements(context);
  const frame = selectionFrame(context.scene, context.selection.ids);
  if (frame === null || elements.length === 0) return null;
  if (handle === null) return { type: 'move', from, elements };
  if (frame.type === 'ends') return lineEnd(handle, elements, from);
  if (handle === 'rotate') return { type: 'rotate', from, elements, center: obbCenter(frame.box) };
  if (!isResizeHandle(handle)) return null;
  return { type: 'resize', from, handle, elements, outline: frame.box };
}

/** The elements as the gesture makes them with the pointer at a scene point. */
function resultOf(gesture: TransformGesture, event: PointerGesture): readonly Element[] {
  const delta = subtract(event.scene, gesture.from);
  const { shift, alt } = event.modifiers;
  switch (gesture.type) {
    case 'move':
      return moveBy(gesture.elements, delta);
    case 'resize': {
      const drag = {
        handle: gesture.handle,
        drag: delta,
        options: { keepAspect: shift, fromCenter: alt },
      };
      const [only, ...others] = gesture.elements;
      return only !== undefined && others.length === 0
        ? [resizeElement(only, drag)]
        : resizeElements(gesture.elements, gesture.outline, drag);
    }
    case 'rotate':
      return rotateElements(gesture.elements, gesture.center, [gesture.from, event.scene], shift);
    case 'line-end':
      return [moveLineEnd(gesture.line, gesture.end, delta)];
  }
}

/** The preview that takes the scene to the gesture's result for the pointer's position. */
export const previewOf = (
  gesture: TransformGesture,
  event: PointerGesture,
  context: ToolContext,
): ToolEffect => ({
  type: 'preview',
  changes: { elements: updatesTo(context.scene, resultOf(gesture, event)), groups: [] },
});

export const commitOf = (gesture: TransformGesture): ToolEffect => ({
  type: 'commit',
  label: LABELS[gesture.type],
});
