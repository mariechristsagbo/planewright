import type { Element, ElementId, TextMeasurer } from '@planewright/engine';

import { drawingOf } from './trace.ts';
import type { Drawing } from './trace.ts';

// The path cache (docs/architecture/engine/rendering-and-hit-testing.md#drawing-the-scene-layer).

/** How many elements' paths the cache holds before it drops the least recently used. */
export const PATH_CACHE_LIMIT = 20_000;

export interface PathCache {
  /**
   * The drawing of an element, built once per identifier and revision: its path and, for a text,
   * its layout. Undefined for a kind that P0 does not draw.
   */
  drawingOf(element: Element): Drawing | undefined;
  /** The drawing last built for an element, if it is still held; nothing is built. */
  peek(id: ElementId): Drawing | undefined;
  /** Forgets removed elements, so that one coming back is traced again. */
  drop(ids: Iterable<ElementId>): void;
  clear(): void;
  readonly size: number;
}

/** A cache whose entries are kept in use order in a map, least recently used first. */
export function createPathCache(
  createPath: () => Path2D,
  measurer: TextMeasurer,
  limit = PATH_CACHE_LIMIT,
): PathCache {
  const entries = new Map<ElementId, Drawing>();
  return {
    drawingOf(element) {
      const held = entries.get(element.id);
      entries.delete(element.id);
      const drawing =
        held?.element.rev === element.rev ? held : drawingOf(element, createPath, measurer);
      if (drawing === undefined) return undefined;
      entries.set(element.id, drawing);
      // The map is walked only past the limit: a walk from its start steps over every slot that a
      // deleted entry left, which made each lookup cost as much as the cache is large.
      if (entries.size > limit) {
        for (const [oldest] of entries) {
          if (entries.size <= limit) break;
          entries.delete(oldest);
        }
      }
      return drawing;
    },
    peek: (id) => entries.get(id),
    drop(ids) {
      for (const id of ids) entries.delete(id);
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
