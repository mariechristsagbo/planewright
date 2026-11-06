import { TAU } from '../../src/math/angle.ts';
import { randomBetween, randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Attachment, Element, Point } from '../../src/model/elements.ts';
import type { ElementId, GroupId } from '../../src/model/ids.ts';
import { KEY_DIGITS, compareDrawingOrder } from '../../src/model/order-key.ts';
import type { OrderKey } from '../../src/model/order-key.ts';
import type { Style } from '../../src/model/style.ts';
import type { ElementDelta } from '../../src/scene/delta.ts';
import { randomText } from './generators.ts';

// Seeded random scenes for the scene's indexes, and the brute-force scans they must agree with
// (ENG-03). Elements sit in a few thousand units around the origin, so that the 512-unit cells
// of the spatial index are shared, crossed and left empty; some are large enough to skip the
// cells, and many edges fall on whole numbers, as do the queries' edges, so that boxes touch.

export const sceneElementId = (index: number): ElementId =>
  `S${String(index).padStart(21, '0')}` as ElementId;

export const sceneGroupId = (index: number): GroupId =>
  `T${String(index).padStart(21, '0')}` as GroupId;

export const pick = <T>(random: Random, items: readonly T[]): T =>
  items[randomInt(random, 0, items.length - 1)] as T;

export const chance = (random: Random, probability: number): boolean => random.next() < probability;

/** A coordinate near the origin, a whole number half of the time. */
const coordinate = (random: Random, limit: number): number =>
  chance(random, 0.5) ? randomInt(random, -limit, limit) : randomBetween(random, -limit, limit);

/** A size that is often 0, usually under a cell, and sometimes spans more than 64 cells. */
function size(random: Random): number {
  if (chance(random, 0.1)) return 0;
  if (chance(random, 0.1)) return randomInt(random, 4_096, 40_000);
  return chance(random, 0.5) ? randomInt(random, 1, 600) : randomBetween(random, 0, 1_500);
}

export const anyOrderKey = (random: Random): OrderKey =>
  `${randomText(random, KEY_DIGITS, randomInt(random, 0, 2))}${randomText(random, KEY_DIGITS.slice(1), 1)}` as OrderKey;

const style = (random: Random): Style => ({
  stroke: {
    color: '#1e2430' as Style['stroke']['color'],
    width: chance(random, 0.5) ? 2 : randomBetween(random, 0.5, 100),
    dash: 'solid',
  },
  fill: null,
  opacity: 1,
  corners: 'sharp',
  sketch: 0,
});

/** One to five points, normalised to a smallest x and y of exactly 0. */
function points(random: Random, min: number): Point[] {
  const extent = size(random);
  const raw = Array.from({ length: randomInt(random, min, 5) }, () => ({
    x: randomBetween(random, 0, extent),
    y: randomBetween(random, 0, extent),
  }));
  const left = Math.min(...raw.map(({ x }) => x));
  const top = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - left, y: y - top }));
}

/** The identifiers an element may refer to. */
export interface SceneRefs {
  readonly elements: readonly ElementId[];
  readonly groups: readonly GroupId[];
}

function attachment(random: Random, id: ElementId, refs: SceneRefs): Attachment | undefined {
  const targets = refs.elements.filter((other) => other !== id);
  if (targets.length === 0 || chance(random, 0.4)) return undefined;
  return { target: pick(random, targets), anchor: { x: random.next(), y: random.next() } };
}

const optional = <K extends string, V>(key: K, value: V | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

/** A valid element of a P0 kind or an arrow, whose group and targets are among `refs`. */
export function anySceneElement(random: Random, id: ElementId, refs: SceneRefs): Element {
  const common = {
    id,
    order: anyOrderKey(random),
    x: coordinate(random, 4_000),
    y: coordinate(random, 4_000),
    rotation: chance(random, 0.5) ? 0 : randomBetween(random, 0, TAU),
    style: style(random),
    locked: false,
    rev: randomInt(random, 0, 9),
    ...optional(
      'group',
      refs.groups.length > 0 && chance(random, 0.4) ? pick(random, refs.groups) : undefined,
    ),
  };
  const choice = randomInt(random, 0, 5);
  if (choice <= 1) {
    const kind = pick(random, ['rectangle', 'ellipse', 'diamond'] as const);
    return { ...common, kind, width: size(random), height: size(random) };
  }
  if (choice === 2) return { ...common, kind: 'line', points: points(random, 2) };
  if (choice === 3) return { ...common, kind: 'freehand', points: points(random, 1) };
  if (choice === 4) {
    const content = {
      text: 'a',
      font: { family: 'sans', size: 20, lineHeight: 1.25 },
      align: 'left',
    } as const;
    return { ...common, kind: 'text', width: size(random), height: size(random), content };
  }
  return {
    ...common,
    kind: 'arrow',
    points: points(random, 2),
    ...optional('start', attachment(random, id, refs)),
    ...optional('end', attachment(random, id, refs)),
    heads: { start: 'none', end: 'arrow' },
    route: 'straight',
  };
}

// Brute-force scans: the definitions that the indexes must agree with.

export const bruteOrder = (elements: Iterable<Element>): ElementId[] =>
  [...elements].sort(compareDrawingOrder).map(({ id }) => id);

/**
 * One random step over the scene held in `elements`, which it updates: some elements added, some
 * removed and some replaced, half of those keeping their order key. Returns what changed.
 */
export function anyStep(
  random: Random,
  elements: Map<ElementId, Element>,
  refs: (ids: readonly ElementId[]) => SceneRefs,
  fresh: () => ElementId,
): ElementDelta[] {
  const deltas: ElementDelta[] = [];
  const existing = [...elements.keys()];
  const touched = new Set<ElementId>();
  for (let count = randomInt(random, 1, 6); count > 0; count -= 1) {
    const id = existing.length > 0 && chance(random, 0.6) ? pick(random, existing) : fresh();
    if (touched.has(id)) continue;
    touched.add(id);
    const before = elements.get(id);
    const replaced = anySceneElement(random, id, refs([...elements.keys()]));
    const after =
      before !== undefined && chance(random, 0.3)
        ? undefined
        : {
            ...replaced,
            ...(before !== undefined && chance(random, 0.5) ? { order: before.order } : {}),
          };
    if (after === undefined) elements.delete(id);
    else elements.set(id, after);
    deltas.push({ id, before, after });
  }
  return deltas;
}
