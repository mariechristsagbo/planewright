import { localBox } from '../geometry/world-bounds.ts';
import type { Aabb } from '../math/aabb.ts';
import type { Vec } from '../math/vector.ts';
import type { Element, Point } from '../model/elements.ts';
import { LIMITS } from '../model/limits.ts';
import { leastRatio, resizeRatios } from './resize-ratios.ts';
import type { ResizeDrag, ResizeLimits } from './resize-ratios.ts';
import { scaledTo } from './scale.ts';

// Resizing several elements (docs/architecture/engine/interaction.md#transforms): the fixed point
// is the opposite corner or side of the selection outline, and each element's centre and size
// scale by the drag's ratios (REQ-T03).

const QUARTER = Math.PI / 2;

/** Whether a rotation is a multiple of 90°, so that scaling along the scene's axes skews nothing. */
const quarterTurn = (rotation: number): boolean => {
  const turns = rotation / QUARTER;
  return Math.abs(turns - Math.round(turns)) < 1e-9;
};

/** Whether an element's own x axis lies along the scene's y axis. */
const sideways = (rotation: number): boolean => Math.round(rotation / QUARTER) % 2 === 1;

/** An element's own sizes measured along the scene's axes, for a quarter turn. */
function alongScene(element: Element): Vec {
  const { width, height } = localBox(element);
  return sideways(element.rotation) ? { x: height, y: width } : { x: width, y: height };
}

/** The outline's smallest sizes, so that no element's positive size or font goes below 1. */
function limitsOf(elements: readonly Element[], outline: Aabb): ResizeLimits {
  let least = { x: leastRatio(outline.width), y: leastRatio(outline.height) };
  let most = Infinity;
  for (const element of elements) {
    const along = alongScene(element);
    least = {
      x: Math.max(least.x, leastRatio(along.x)),
      y: Math.max(least.y, leastRatio(along.y)),
    };
    if (element.kind === 'text') {
      const font = element.content.font.size;
      const text = Math.max(leastRatio(along.x), leastRatio(along.y), leastRatio(font));
      least = { x: Math.max(least.x, text), y: Math.max(least.y, text) };
      most = Math.min(most, LIMITS.fontSize.max / font);
    }
  }
  return { least: { x: outline.width * least.x, y: outline.height * least.y }, most };
}

/** An element whose centre and size scale about a scene point; a text by its height ratio. */
function scaledAbout(element: Element, fixed: Point, ratio: Vec): Element {
  const box = localBox(element);
  const own = sideways(element.rotation) ? { x: ratio.y, y: ratio.x } : ratio;
  const along = element.kind === 'text' ? { x: own.y, y: own.y } : own;
  const size = { width: box.width * along.x, height: box.height * along.y };
  const centre = {
    x: fixed.x + (box.x + box.width / 2 - fixed.x) * ratio.x,
    y: fixed.y + (box.y + box.height / 2 - fixed.y) * ratio.y,
  };
  const origin = { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
  return scaledTo(element, origin, size, along);
}

/**
 * Several elements resized by dragging a handle of their outline by a scene delta. If any of them
 * is turned by an angle that is not a multiple of 90°, the aspect ratio is kept, so none is skewed.
 */
export function resizeElements(
  elements: readonly Element[],
  outline: Aabb,
  { handle, drag, options }: ResizeDrag,
): Element[] {
  const keepAspect = options.keepAspect || !elements.every(({ rotation }) => quarterTurn(rotation));
  const resized = resizeRatios(outline, handle, drag, {
    options: { ...options, keepAspect },
    limits: limitsOf(elements, outline),
  });
  const fixed = {
    x: outline.x + resized.fixed.x * outline.width,
    y: outline.y + resized.fixed.y * outline.height,
  };
  return elements.map((element) => scaledAbout(element, fixed, resized.ratio));
}
