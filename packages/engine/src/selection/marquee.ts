import type { Box, Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import { compareDrawingOrder } from '../model/order-key.ts';
import { checkQueryBox } from '../scene/spatial-index.ts';
import type { SceneReader } from '../scene/store.ts';
import { enclosureRow, encloses, marqueeEdges, meets } from './marquee-rows.ts';
import type { EnclosureRow, MarqueeEdges } from './marquee-rows.ts';

// Box selection (docs/architecture/engine/rendering-and-hit-testing.md#hit-testing and
// #what-issue-35-decided).

/** A scene's rows, one per element in drawing order, with their revision and source. */
interface Rows {
  readonly rev: number;
  readonly source: readonly Element[];
  readonly rows: readonly EnclosureRow[];
}

/**
 * Each scene's rows, kept until the scene changes. The store gives the same ordered elements
 * until a change set raises its revision, and an element is never changed in place, so rows made
 * of the same array, or of the same element, still hold its numbers.
 */
const scenes = new WeakMap<SceneReader, Rows>();

/** A marquee among at most this share of the scene's elements is answered from them alone. */
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

/**
 * The spatial index's candidates for a marquee that meets few of the scene's elements, or nothing
 * for one that meets more. Without rows, the candidates themselves tell; with rows made before a
 * change, the rows whose bounds meet the marquee tell, which a scan finds sooner than a box query
 * over many elements does.
 */
function fewCandidates(
  scene: SceneReader,
  last: Rows | undefined,
  marquee: Box,
  edges: MarqueeEdges,
): readonly ElementId[] | undefined {
  if (last === undefined) {
    const candidates = scene.queryBox(marquee);
    return candidates.length <= scene.ordered().length * FEW ? candidates : undefined;
  }
  const limit = last.rows.length * FEW;
  let meeting = 0;
  for (const row of last.rows) {
    if (meets(row, edges)) {
      meeting += 1;
      if (meeting > limit) return undefined;
    }
  }
  return scene.queryBox(marquee);
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
 * order while the scene is unchanged; after a change, a marquee with few candidates in the
 * spatial index is answered from them, and any other makes the rows again. A marquee that is not
 * finite or has a negative size is refused, as every box query refuses it.
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
