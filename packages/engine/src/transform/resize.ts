import { localBox } from '../geometry/world-bounds.ts';
import type { Aabb } from '../math/aabb.ts';
import { add, rotate, subtract } from '../math/vector.ts';
import type { Vec } from '../math/vector.ts';
import type { Element, Point } from '../model/elements.ts';
import { LIMITS } from '../model/limits.ts';
import { leastRatio, resizeRatios } from './resize-ratios.ts';
import type { ResizeDrag, ResizeLimits } from './resize-ratios.ts';
import { scaledTo } from './scale.ts';
import type { Size } from './scale.ts';

// Resizing one element (docs/architecture/engine/interaction.md#transforms): the drag is turned
// into the element's own frame, the dragged edges follow it, and the new origin is solved from the
// point that stays fixed in scene space (REQ-T02, REQ-T04, REQ-T05).

/**
 * A text keeps its aspect ratio, so that its font size scales by the height ratio, and its font
 * size stays within the document's limits; any other size stops at 1 unit.
 */
function limitsOf(element: Element, box: Aabb): ResizeLimits {
  if (element.kind !== 'text') {
    return { least: { x: Math.min(1, box.width), y: Math.min(1, box.height) }, most: Infinity };
  }
  const font = element.content.font.size;
  const least = Math.max(leastRatio(box.width), leastRatio(box.height), leastRatio(font));
  return {
    least: { x: box.width * least, y: box.height * least },
    most: LIMITS.fontSize.max / font,
  };
}

/** The origin that keeps the fixed point, at fractions of the box, where it was in the scene. */
function originKeeping(element: Element, box: Aabb, size: Size, fixed: Vec): Point {
  const before = { x: fixed.x * box.width, y: fixed.y * box.height };
  const after = { x: fixed.x * size.width, y: fixed.y * size.height };
  if (element.rotation === 0) {
    return { x: box.x + before.x - after.x, y: box.y + before.y - after.y };
  }
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const half = (s: Size): Vec => ({ x: s.width / 2, y: s.height / 2 });
  const anchor = add(centre, rotate(subtract(before, half(box)), element.rotation));
  const moved = subtract(anchor, rotate(subtract(after, half(size)), element.rotation));
  return subtract(moved, half(size));
}

/** One element resized by dragging one of its handles by a scene delta. */
export function resizeElement(element: Element, { handle, drag, options }: ResizeDrag): Element {
  const box = localBox(element);
  const local = element.rotation === 0 ? drag : rotate(drag, -element.rotation);
  const keepAspect = options.keepAspect || element.kind === 'text';
  const resized = resizeRatios(box, handle, local, {
    options: { ...options, keepAspect },
    limits: limitsOf(element, box),
  });
  const size = { width: resized.width, height: resized.height };
  return scaledTo(element, originKeeping(element, box, size, resized.fixed), size, resized.ratio);
}
