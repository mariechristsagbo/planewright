import type { Box, Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import { checkQueryBox } from '../scene/spatial-index.ts';
import type { SceneReader } from '../scene/store.ts';
import { enclosureRow, encloses, marqueeEdges, meets } from './marquee-rows.ts';
import type { EnclosureRow, MarqueeEdges } from './marquee-rows.ts';

// Box selection (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing,
// #what-issue-35-decided and #what-issue-43-decided).

/** A scene's rows, one per element in drawing order, with their revision and source. */
interface Rows {
  readonly rev: number;
  readonly source: readonly Element[];
  readonly rows: readonly EnclosureRow[];
}

/**
 * Each scene's rows. The store gives the same ordered elements until a change set raises its
 * revision, and an element is never changed in place, so rows made of the same array, or of the
 * same element, still hold its numbers. After a change the rows, and with them the ordered array
 * and the elements they were made of, stay until a query makes them again, or until the scene
 * itself is collected.
 */
const scenes = new WeakMap<SceneReader, Rows>();

/** After a change, a marquee that meets more than this share of the elements makes new rows. */
const FEW = 1 / 16;

/** The last rows, while neither the revision nor the ordered elements have changed. */
const current = (
  scene: SceneReader,
  last: Rows | undefined,
): readonly EnclosureRow[] | undefined =>
  last?.rev === scene.rev && last.source === scene.ordered() ? last.rows : undefined;

/** New rows, which keep the row of every element still in its place. */
function rebuilt(scene: SceneReader, last: Rows | undefined): readonly EnclosureRow[] {
  const source = scene.ordered();
  const rows = source.map(
    (element, index) =>
      (last?.source[index] === element ? last.rows[index] : undefined) ?? enclosureRow(element),
  );
  scenes.set(scene, { rev: scene.rev, source, rows });
  return rows;
}

/** The rows' elements that the marquee encloses, in the rows' order. */
function scan(rows: readonly EnclosureRow[], marquee: MarqueeEdges): ElementId[] {
  const enclosed: ElementId[] = [];
  for (const row of rows) {
    if (encloses(row, marquee)) enclosed.push(row.id);
  }
  return enclosed;
}

/** Whether more than `limit` of the rows' bounds meet the marquee. */
function meetMore(rows: readonly EnclosureRow[], edges: MarqueeEdges, limit: number): boolean {
  let meeting = 0;
  for (const row of rows) {
    if (meets(row, edges)) {
      meeting += 1;
      if (meeting > limit) return true;
    }
  }
  return false;
}

/**
 * The spatial index's candidates for a marquee that meets at most a sixteenth of the scene's
 * elements now, or nothing for one that meets more. Rows made before a change can show that it
 * meets more, which a scan of them finds sooner than a box query over many elements does; rows
 * that do not, such as the rows of an empty scene or of elements moved away since, count as no
 * rows, and the candidates themselves tell, against the number of elements now.
 */
function fewCandidates(
  scene: SceneReader,
  last: Rows | undefined,
  marquee: Box,
  edges: MarqueeEdges,
): readonly ElementId[] | undefined {
  const limit = scene.ordered().length * FEW;
  if (last !== undefined && meetMore(last.rows, edges, limit)) return undefined;
  const candidates = scene.queryBox(marquee);
  return candidates.length <= limit ? candidates : undefined;
}

/** The candidates that the marquee encloses, sorted into drawing order. */
function among(scene: SceneReader, ids: readonly ElementId[], marquee: MarqueeEdges): ElementId[] {
  const enclosed: Element[] = [];
  for (const id of ids) {
    const element = scene.get(id);
    if (element !== undefined && encloses(enclosureRow(element), marquee)) enclosed.push(element);
  }
  return enclosed.sort(compareDrawingOrder).map(({ id }) => id);
}

/**
 * The elements that a marquee in scene space wholly encloses, edges included, in drawing order
 * (REQ-S06): those whose world bounds meet it, as the spatial index's candidates, whose kind has a
 * geometry, and whose every outline point lies inside. The scene's rows are scanned in drawing
 * order while the scene is unchanged. After a change, a marquee that meets the world bounds of
 * more than a sixteenth of the scene's elements, counted among the spatial index's candidates or
 * among the rows made before the change, makes the rows again; any other is answered from the
 * candidates and leaves the rows as they were. A marquee that is not finite or has a negative size
 * is refused, as every box query refuses it.
 */
export function enclosedBy(scene: SceneReader, marquee: Box): readonly ElementId[] {
  checkQueryBox(marquee);
  const edges = marqueeEdges(marquee);
  const last = scenes.get(scene);
  const rows = current(scene, last);
  if (rows !== undefined) return scan(rows, edges);
  const candidates = fewCandidates(scene, last, marquee, edges);
  if (candidates !== undefined) return among(scene, candidates, edges);
  return scan(rebuilt(scene, last), edges);
}
