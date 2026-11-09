import type { Camera } from '../../src/camera/camera.ts';
import type { Aabb } from '../../src/math/aabb.ts';
import { createRandom, randomBetween, randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import { toColor } from '../../src/model/color.ts';
import { INITIAL_DEFAULT_STYLE, styleForKind } from '../../src/model/defaults.ts';
import type { DocumentState } from '../../src/model/document.ts';
import type { Element, Point } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { keysBetween } from '../../src/model/order-key.ts';
import type { OrderKey } from '../../src/model/order-key.ts';
import { planSave } from '../../src/persistence/records.ts';
import type { DocumentRecord, ElementRecord } from '../../src/persistence/records.ts';
import type { DocumentId, SessionState } from '../../src/persistence/repository.ts';
import type { Style } from '../../src/model/style.ts';

// The seeded scenes that the performance budgets are measured on
// (docs/architecture/engine/quality.md#performance-budgets): a mix of the P0 kinds, each element
// in its own cell of a grid over an area, so that the same seed always gives the same scene and a
// view of the area shows a known share of it. Benchmarks use the elements; the browser
// measurements store the records that a saved drawing has.

export const PERF_KINDS = ['rectangle', 'ellipse', 'diamond', 'line', 'freehand', 'text'] as const;

type PerfKind = (typeof PERF_KINDS)[number];

/** How many of every 20 elements are of each kind. */
const WEIGHTS: readonly (readonly [PerfKind, number])[] = [
  ['rectangle', 5],
  ['ellipse', 4],
  ['diamond', 3],
  ['line', 3],
  ['freehand', 3],
  ['text', 2],
];

const COLORS = [
  toColor('#1e2430'),
  toColor('#c92a2a'),
  toColor('#2b8a3e'),
  toColor('#1864ab'),
  toColor('#e67700'),
  toColor('#862e9c'),
] as const;
const FILLS = [
  toColor('#ffc9c9'),
  toColor('#b2f2bb'),
  toColor('#a5d8ff'),
  toColor('#ffec99'),
] as const;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/** Texts of `length` characters, the topmost elements of the scene, drawn far from its area. */
export interface LongTexts {
  readonly count: number;
  readonly length: number;
  readonly at: Point;
}

export interface PerfSceneSpec {
  readonly seed: number;
  readonly count: number;
  /** The scene box that the elements' cells cover. */
  readonly area: Aabb;
  readonly longTexts?: LongTexts;
}

/** Where an element goes: the centre of its cell and the room around that centre. */
interface Cell {
  readonly center: Point;
  readonly room: number;
}

const perfId = (index: number): ElementId => `P${String(index).padStart(21, '0')}` as ElementId;

const pick = <T>(random: Random, items: readonly [T, ...T[]]): T =>
  items[randomInt(random, 0, items.length - 1)] ?? items[0];

function kindAt(random: Random): PerfKind {
  let draw = randomInt(random, 1, 20);
  for (const [kind, weight] of WEIGHTS) {
    draw -= weight;
    if (draw <= 0) return kind;
  }
  return 'rectangle';
}

/** The cell of each index: a grid of about square cells, `count` of them, row by row over the area. */
function gridOf({ count, area }: PerfSceneSpec): (index: number) => Cell {
  const columns = Math.max(1, Math.round(Math.sqrt((count * area.width) / area.height)));
  const width = area.width / columns;
  const height = area.height / Math.ceil(count / columns);
  return (index) => ({
    center: {
      x: area.x + ((index % columns) + 0.5) * width,
      y: area.y + (Math.floor(index / columns) + 0.5) * height,
    },
    room: Math.min(width, height),
  });
}

function styleOf(random: Random, kind: PerfKind, room: number): Style {
  const closed = kind === 'rectangle' || kind === 'ellipse' || kind === 'diamond';
  const filled = closed && random.next() < 0.3;
  return {
    ...styleForKind(INITIAL_DEFAULT_STYLE, kind),
    stroke: {
      color: pick(random, COLORS),
      width: Math.min(2, room / 20),
      dash: random.next() < 0.1 ? 'dashed' : 'solid',
    },
    fill: filled ? { color: pick(random, FILLS), pattern: 'solid' } : null,
  };
}

/** Points in a width by height box, moved so that the smallest x and y are 0, as stored points are. */
function pointsIn(random: Random, count: number, width: number, height: number): Point[] {
  const raw = Array.from({ length: count }, () => ({
    x: randomBetween(random, 0, width),
    y: randomBetween(random, 0, height),
  }));
  const minX = Math.min(...raw.map(({ x }) => x));
  const minY = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
}

const word = (random: Random): string =>
  Array.from({ length: randomInt(random, 3, 7) }, () =>
    LETTERS.charAt(randomInt(random, 0, LETTERS.length - 1)),
  ).join('');

/** A box kind's or a text's own fields, or a point kind's points, sized to `side` at most. */
function shapeOf(random: Random, kind: PerfKind, side: number) {
  const width = side * randomBetween(random, 0.5, 1);
  const height = side * randomBetween(random, 0.5, 1);
  if (kind === 'line') return { points: pointsIn(random, randomInt(random, 2, 4), width, height) };
  if (kind === 'freehand') {
    return { points: pointsIn(random, randomInt(random, 8, 24), width, height) };
  }
  if (kind !== 'text') return { width, height };
  const text = Array.from({ length: randomInt(random, 1, 3) }, () => word(random)).join(' ');
  const size = Math.max(1, Math.min(20, (2 * side) / text.length));
  const font = { family: 'sans' as const, size, lineHeight: 1.25 };
  return {
    width: Math.min(side, (text.length * size) / 2),
    height: Math.min(side, size * 1.25),
    content: { text, font, align: 'left' as const },
  };
}

/** The extent of a box kind's size or of a point kind's points. */
function extentOf(fields: ReturnType<typeof shapeOf>): { width: number; height: number } {
  if (!('points' in fields)) return fields;
  return {
    width: Math.max(...fields.points.map(({ x }) => x)),
    height: Math.max(...fields.points.map(({ y }) => y)),
  };
}

function elementIn(random: Random, cell: Cell, index: number, order: OrderKey): Element {
  const kind = kindAt(random);
  const style = styleOf(random, kind, cell.room);
  const turned = random.next() < 0.25;
  // A turned box's bounds reach at most its diagonal, so it gets a side of room / √2.
  const side = (cell.room - 2 * style.stroke.width) * (turned ? 0.65 : 0.9);
  const fields = shapeOf(random, kind, side);
  const { width, height } = extentOf(fields);
  return {
    id: perfId(index),
    kind,
    order,
    x: cell.center.x - width / 2,
    y: cell.center.y - height / 2,
    rotation: turned ? randomBetween(random, 0.1, 6.2) : 0,
    style,
    locked: false,
    ...fields,
    rev: 1,
  } as Element;
}

/** A text of exactly `length` characters: one seeded line of 99 characters, repeated line by line. */
function longText(random: Random, index: number, order: OrderKey, texts: LongTexts): Element {
  let line = '';
  while (line.length < 99) line = `${line} ${word(random)}`.trimStart();
  const text = `${line.slice(0, 99)}\n`
    .repeat(Math.ceil(texts.length / 100))
    .slice(0, texts.length);
  const font = { family: 'sans' as const, size: 1, lineHeight: 1 };
  return {
    id: perfId(index),
    kind: 'text',
    order,
    x: texts.at.x + 60 * (index % 100),
    y: texts.at.y,
    rotation: 0,
    style: styleForKind(INITIAL_DEFAULT_STYLE, 'text'),
    locked: false,
    width: 49.5,
    height: Math.ceil(texts.length / 100),
    content: { text, font, align: 'left' },
    rev: 1,
  };
}

/** The scene's elements in drawing order, bottom first; the long texts, if any, come last. */
export function perfElements(spec: PerfSceneSpec): Element[] {
  const random = createRandom(spec.seed);
  const { longTexts } = spec;
  const cellAt = gridOf(spec);
  return keysBetween(null, null, spec.count + (longTexts?.count ?? 0)).map((order, index) =>
    index < spec.count || longTexts === undefined
      ? elementIn(random, cellAt(index), index, order)
      : longText(random, index, order, longTexts),
  );
}

/** The scene as a document on a white canvas, as an editor holds it. */
export function perfDocument(spec: PerfSceneSpec): DocumentState {
  return {
    elements: new Map(perfElements(spec).map((element) => [element.id, element])),
    groups: new Map(),
    canvas: { background: toColor('#ffffff') },
    rev: 0,
  };
}

/** What a browser's storage holds after the scene was saved whole: revision 1 and its session. */
export function perfRecords(
  spec: PerfSceneSpec,
  { id, session }: { readonly id: string; readonly session: SessionState },
): { readonly record: DocumentRecord; readonly elements: readonly ElementRecord[] } {
  const document = perfDocument(spec);
  const request = { type: 'replace', id: id as DocumentId, baseRev: 0, document, session } as const;
  const plan = planSave(undefined, request);
  if (plan.type !== 'write') throw new Error('A first save of a scene must write it.');
  return { record: plan.record, elements: plan.put };
}

/**
 * The area over which a scene puts `fraction` of its elements in a view of the given CSS size
 * under `camera`: the view's scene box grown about its centre to hold it that many times, or, for
 * the whole scene in view, that box with a twentieth of it left free along each edge.
 */
export function perfArea(
  view: { readonly width: number; readonly height: number },
  camera: Camera,
  fraction: number,
): Aabb {
  if (!(fraction > 0 && fraction <= 1)) {
    throw new RangeError(
      `A share of the scene in view must be in (0, 1], not ${String(fraction)}.`,
    );
  }
  const width = view.width / camera.zoom;
  const height = view.height / camera.zoom;
  const scale = fraction === 1 ? 0.9 : Math.sqrt(1 / fraction);
  const area = { width: width * scale, height: height * scale };
  return {
    x: camera.x + (width - area.width) / 2,
    y: camera.y + (height - area.height) / 2,
    ...area,
  };
}
