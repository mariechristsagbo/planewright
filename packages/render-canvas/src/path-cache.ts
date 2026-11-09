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

/** A held drawing, linked to the drawings used just before and just after it. */
interface Entry {
  readonly drawing: Drawing;
  older: Entry | null;
  newer: Entry | null;
}

/** The entries in use order, oldest first, as a list that moves an entry without a lookup. */
interface UseOrder {
  oldest: Entry | null;
  newest: Entry | null;
}

function unlink(order: UseOrder, entry: Entry): void {
  if (entry.older === null) order.oldest = entry.newer;
  else entry.older.newer = entry.newer;
  if (entry.newer === null) order.newest = entry.older;
  else entry.newer.older = entry.older;
  entry.older = null;
  entry.newer = null;
}

function append(order: UseOrder, entry: Entry): void {
  entry.older = order.newest;
  if (order.newest === null) order.oldest = entry;
  else order.newest.newer = entry;
  order.newest = entry;
}

/**
 * A cache whose entries sit in a map for lookup and in a list in use order, least recently used
 * first. A lookup that finds its drawing moves the entry to the list's end and leaves the map
 * alone: taking it out of the map and putting it back on every lookup cost a tenth of a frame of
 * 5,000 elements (issue #34), and a walk of the map from its start steps over every slot that a
 * deleted entry left (ENG-15).
 */
export function createPathCache(
  createPath: () => Path2D,
  measurer: TextMeasurer,
  limit = PATH_CACHE_LIMIT,
): PathCache {
  const entries = new Map<ElementId, Entry>();
  const order: UseOrder = { oldest: null, newest: null };
  const forget = (entry: Entry) => {
    unlink(order, entry);
    entries.delete(entry.drawing.element.id);
  };
  return {
    drawingOf(element) {
      const held = entries.get(element.id);
      if (held?.drawing.element.rev === element.rev) {
        if (held !== order.newest) {
          unlink(order, held);
          append(order, held);
        }
        return held.drawing;
      }
      if (held !== undefined) forget(held);
      const drawing = drawingOf(element, createPath, measurer);
      if (drawing === undefined) return undefined;
      const entry: Entry = { drawing, older: null, newer: null };
      entries.set(element.id, entry);
      append(order, entry);
      while (entries.size > limit && order.oldest !== null) forget(order.oldest);
      return drawing;
    },
    peek: (id) => entries.get(id)?.drawing,
    drop(ids) {
      for (const id of ids) {
        const held = entries.get(id);
        if (held !== undefined) forget(held);
      }
    },
    clear() {
      entries.clear();
      order.oldest = null;
      order.newest = null;
    },
    get size() {
      return entries.size;
    },
  };
}
