import { worldBounds } from '../geometry/world-bounds.ts';
import { aabbIntersects } from '../math/aabb.ts';
import type { Aabb } from '../math/aabb.ts';
import type { Vec } from '../math/vector.ts';
import type { ElementId } from '../model/ids.ts';
import type { ElementDelta } from './delta.ts';

/** The side of a grid cell, in scene units (docs/architecture/engine/scene-and-viewport.md#spatial-index). */
export const CELL_SIZE = 512;

/** Bounds that touch more cells than this go into a list that every query scans. */
export const MAX_CELLS = 64;

/** The world bounds of the scene's elements, kept so that queries need not scan every element. */
export interface SpatialIndex {
  /** The elements whose world bounds meet the box, edges included, in no particular order. */
  queryBox(box: Aabb): ElementId[];
  /** The elements whose world bounds lie within `radius` of the point, in no particular order. */
  queryPoint(point: Vec, radius: number): ElementId[];
  update(deltas: readonly ElementDelta[]): void;
  /** How many grid cells hold an element, and how many elements are kept apart. */
  occupancy(): { readonly cells: number; readonly large: number };
}

interface Entry {
  readonly id: ElementId;
  /** Replaced in place while the element touches the same cells: the index's own data. */
  bounds: Aabb;
  /** The cells that the bounds touch, kept for an element kept apart too. */
  readonly span: Span;
  /** Empty for an element kept apart. */
  readonly cells: readonly Cell[];
}

interface Cell {
  readonly key: string;
  readonly column: number;
  readonly row: number;
  readonly entries: Set<Entry>;
}

/** The columns and rows of the cells that a box touches, both ends included. */
interface Span {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const column = (x: number): number => Math.floor(x / CELL_SIZE);

const spanOf = (box: Aabb): Span => ({
  left: column(box.x),
  top: column(box.y),
  right: column(box.x + box.width),
  bottom: column(box.y + box.height),
});

const cellCount = ({ left, top, right, bottom }: Span): number =>
  (right - left + 1) * (bottom - top + 1);

const keyOf = (col: number, row: number): string => `${String(col)},${String(row)}`;

function* positions({ left, top, right, bottom }: Span): Generator<readonly [number, number]> {
  for (let col = left; col <= right; col += 1) {
    for (let row = top; row <= bottom; row += 1) {
      yield [col, row];
    }
  }
}

const inSpan = (cell: Cell, span: Span): boolean =>
  cell.column >= span.left &&
  cell.column <= span.right &&
  cell.row >= span.top &&
  cell.row <= span.bottom;

/** Whether a box touches exactly the cells of a span. */
const touchesSpan = (box: Aabb, span: Span): boolean =>
  column(box.x) === span.left &&
  column(box.y) === span.top &&
  column(box.x + box.width) === span.right &&
  column(box.y + box.height) === span.bottom;

function distanceToBox(point: Vec, box: Aabb): number {
  const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.width);
  const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.height);
  return Math.hypot(dx, dy);
}

/** Refuses a query box that is not finite or has a negative size, as every box query does. */
export function checkQueryBox(box: Aabb): void {
  const sides = [box.x, box.y, box.width, box.height];
  if (!sides.every(Number.isFinite) || box.width < 0 || box.height < 0) {
    throw new RangeError(`A query box needs a finite corner and size, not ${JSON.stringify(box)}.`);
  }
}

function checkPoint(point: Vec, radius: number): void {
  if (![point.x, point.y, radius].every(Number.isFinite) || radius < 0) {
    throw new RangeError('A point query needs a finite point and a finite radius of at least 0.');
  }
}

/** The cells, the elements kept apart, and each element's entry. */
interface Grid {
  readonly entries: Map<ElementId, Entry>;
  readonly cells: Map<string, Cell>;
  readonly large: Set<Entry>;
}

function cellAt(grid: Grid, col: number, row: number): Cell {
  const key = keyOf(col, row);
  const found = grid.cells.get(key);
  if (found !== undefined) {
    return found;
  }
  const cell = { key, column: col, row, entries: new Set<Entry>() };
  grid.cells.set(key, cell);
  return cell;
}

function insert(grid: Grid, id: ElementId, bounds: Aabb): void {
  const span = spanOf(bounds);
  const placed =
    cellCount(span) > MAX_CELLS ? [] : [...positions(span)].map(([c, r]) => cellAt(grid, c, r));
  const entry = { id, bounds, span, cells: placed };
  grid.entries.set(id, entry);
  for (const cell of placed) {
    cell.entries.add(entry);
  }
  if (placed.length === 0) {
    grid.large.add(entry);
  }
}

function remove(grid: Grid, entry: Entry): void {
  grid.entries.delete(entry.id);
  grid.large.delete(entry);
  for (const cell of entry.cells) {
    cell.entries.delete(entry);
    if (cell.entries.size === 0) {
      grid.cells.delete(cell.key);
    }
  }
}

/** The entries kept apart and those in the span's cells, read cell by cell or by a scan of the occupied ones, whichever is shorter. */
function candidates(grid: Grid, span: Span): Entry[] {
  const found = new Set(grid.large);
  const add = (cell: Cell | undefined): void => cell?.entries.forEach((entry) => found.add(entry));
  if (cellCount(span) <= grid.cells.size) {
    for (const [col, row] of positions(span)) add(grid.cells.get(keyOf(col, row)));
  } else {
    for (const cell of grid.cells.values()) if (inSpan(cell, span)) add(cell);
  }
  return [...found];
}

/** The cells within `radius` of a point, and one more on each side, so that rounding at a cell's edge never loses a candidate. */
const spanAround = (point: Vec, radius: number): Span => ({
  left: column(point.x - radius) - 1,
  top: column(point.y - radius) - 1,
  right: column(point.x + radius) + 1,
  bottom: column(point.y + radius) + 1,
});

/**
 * Files each changed element under its new bounds. An element whose new bounds touch the same
 * cells as before, as most do while dragged, keeps its entry, whose bounds are replaced; any other
 * leaves its cells, emptied cells included, and is filed again.
 */
function update(grid: Grid, deltas: readonly ElementDelta[]): void {
  for (const { id, after } of deltas) {
    const previous = grid.entries.get(id);
    const bounds = after === undefined ? undefined : worldBounds(after);
    if (previous !== undefined && bounds !== undefined && touchesSpan(bounds, previous.span)) {
      previous.bounds = bounds;
      continue;
    }
    if (previous !== undefined) remove(grid, previous);
    if (bounds !== undefined) insert(grid, id, bounds);
  }
}

/**
 * A uniform grid of {@link CELL_SIZE}-unit cells, each listing the elements whose world bounds
 * touch it, and a separate list of the elements whose bounds touch more than {@link MAX_CELLS}
 * cells. A query reads the cells its box touches, or every occupied cell when those are fewer, and
 * then keeps the candidates whose bounds pass the exact test, so the grid only saves work.
 */
export function createSpatialIndex(): SpatialIndex {
  const grid: Grid = { entries: new Map(), cells: new Map(), large: new Set() };
  return {
    queryBox(box) {
      checkQueryBox(box);
      return candidates(grid, spanOf(box))
        .filter(({ bounds }) => aabbIntersects(bounds, box))
        .map(({ id }) => id);
    },
    queryPoint(point, radius) {
      checkPoint(point, radius);
      return candidates(grid, spanAround(point, radius))
        .filter(({ bounds }) => distanceToBox(point, bounds) <= radius)
        .map(({ id }) => id);
    },
    update: (deltas) => {
      update(grid, deltas);
    },
    occupancy: () => ({ cells: grid.cells.size, large: grid.large.size }),
  };
}
