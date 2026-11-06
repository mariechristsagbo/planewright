import { TAU } from '../../src/math/angle.ts';
import { randomBetween, randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Color } from '../../src/model/color.ts';
import type { DocumentState, GroupRecord } from '../../src/model/document.ts';
import { ARROW_HEADS, ARROW_ROUTES, ELEMENT_KINDS } from '../../src/model/elements.ts';
import type { Attachment, Element, ElementKind, Point } from '../../src/model/elements.ts';
import type { ElementId, FileId, GroupId } from '../../src/model/ids.ts';
import { KEY_DIGITS } from '../../src/model/order-key.ts';
import type { OrderKey } from '../../src/model/order-key.ts';
import {
  CORNERS,
  FILL_PATTERNS,
  FONT_FAMILIES,
  SKETCH_LEVELS,
  STROKE_DASHES,
  TEXT_ALIGNS,
} from '../../src/model/style.ts';
import type { Style, TextBlock } from '../../src/model/style.ts';
import { randomText, shuffled } from './generators.ts';

// Seeded generators of valid documents for the codec's properties. They use every kind, every
// optional field and the ends of every range, and never -0, which JSON writes as 0.

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const HEX = '0123456789abcdef';
// Includes both halves of an emoji, so lone surrogates occur too; never a carriage return.
const TEXT = 'aZ09 \n\t"\\/é😀 \u0000{}';
/** The largest double below 2π. */
const BELOW_TAU = TAU - 2 ** -50;

const pick = <T>(random: Random, items: readonly T[]): T =>
  items[randomInt(random, 0, items.length - 1)] as T;

const chance = (random: Random, probability: number): boolean => random.next() < probability;

/** A number in [min, max], often one of its ends, or 0 when that lies inside. */
function anyNumber(random: Random, min: number, max: number): number {
  const ends = min < 0 && max > 0 ? [min, 0, max] : [min, max];
  return chance(random, 0.2) ? pick(random, ends) : randomBetween(random, min, max);
}

const anyRotation = (random: Random): number =>
  chance(random, 0.2) ? pick(random, [0, BELOW_TAU]) : randomBetween(random, 0, TAU);

const anyColor = (random: Random): Color =>
  `#${randomText(random, HEX, pick(random, [6, 8]))}` as Color;

const anyOrderKey = (random: Random): OrderKey =>
  `${randomText(random, KEY_DIGITS, randomInt(random, 0, 3))}${randomText(random, KEY_DIGITS.slice(1), 1)}` as OrderKey;

const anyText = (random: Random): string => randomText(random, TEXT, randomInt(random, 0, 24));

function anyStyle(random: Random): Style {
  return {
    stroke: {
      color: anyColor(random),
      width: chance(random, 0.2)
        ? pick(random, [100, Number.MIN_VALUE])
        : randomBetween(random, 0.01, 100),
      dash: pick(random, STROKE_DASHES),
    },
    fill: chance(random, 0.5)
      ? null
      : { color: anyColor(random), pattern: pick(random, FILL_PATTERNS) },
    opacity: anyNumber(random, 0, 1),
    corners: pick(random, CORNERS),
    sketch: pick(random, SKETCH_LEVELS),
  };
}

const anyTextBlock = (random: Random): TextBlock => ({
  text: anyText(random),
  font: {
    family: pick(random, FONT_FAMILIES),
    size: anyNumber(random, 1, 1_000),
    lineHeight: anyNumber(random, 1, 3),
  },
  align: pick(random, TEXT_ALIGNS),
});

/** `min` to `max` points normalised to a smallest x and y of exactly 0. */
function anyPoints(random: Random, min: number, max: number): Point[] {
  const raw = Array.from({ length: randomInt(random, min, max) }, () => ({
    x: anyNumber(random, 0, 1e7),
    y: anyNumber(random, 0, 1e7),
  }));
  const left = Math.min(...raw.map(({ x }) => x));
  const top = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - left, y: y - top }));
}

interface Context {
  readonly random: Random;
  readonly id: ElementId;
  readonly elementIds: readonly ElementId[];
  readonly groupIds: readonly GroupId[];
}

function anyCommon({ random, id, groupIds }: Context) {
  const link = `${pick(random, ['https://', 'http://', 'mailto:', 'HTTPS://'])}${anyText(random)}`;
  return {
    id,
    order: anyOrderKey(random),
    x: anyNumber(random, -1e9, 1e9),
    y: anyNumber(random, -1e9, 1e9),
    rotation: anyRotation(random),
    style: anyStyle(random),
    locked: chance(random, 0.5),
    rev: randomInt(random, 0, 1_000),
    ...(groupIds.length > 0 && chance(random, 0.5) ? { group: pick(random, groupIds) } : {}),
    ...(chance(random, 0.4) ? { link } : {}),
  };
}

const anySize = (random: Random) => ({
  width: anyNumber(random, 0, 1e7),
  height: anyNumber(random, 0, 1e7),
});

function anyAttachment({ random, id, elementIds }: Context): Attachment | undefined {
  const targets = elementIds.filter((other) => other !== id);
  if (targets.length === 0 || chance(random, 0.3)) return undefined;
  return {
    target: pick(random, targets),
    anchor: { x: anyNumber(random, 0, 1), y: anyNumber(random, 0, 1) },
  };
}

const maybe = <K extends string, V>(key: K, value: V | undefined) =>
  (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;

const BUILDERS: Readonly<Record<ElementKind, (context: Context) => Element>> = {
  rectangle: (c) => ({
    ...anyCommon(c),
    kind: 'rectangle',
    ...anySize(c.random),
    ...maybe('label', chance(c.random, 0.5) ? anyTextBlock(c.random) : undefined),
  }),
  ellipse: (c) => ({ ...anyCommon(c), kind: 'ellipse', ...anySize(c.random) }),
  diamond: (c) => ({
    ...anyCommon(c),
    kind: 'diamond',
    ...anySize(c.random),
    label: anyTextBlock(c.random),
  }),
  line: (c) => ({ ...anyCommon(c), kind: 'line', points: anyPoints(c.random, 2, 6) }),
  freehand: (c) => {
    const points = anyPoints(c.random, 1, 6);
    const pressures = points.map(() => anyNumber(c.random, 0, 1));
    return {
      ...anyCommon(c),
      kind: 'freehand',
      points,
      ...maybe('pressures', chance(c.random, 0.5) ? pressures : undefined),
    };
  },
  text: (c) => ({
    ...anyCommon(c),
    kind: 'text',
    ...anySize(c.random),
    content: anyTextBlock(c.random),
  }),
  arrow: (c) => ({
    ...anyCommon(c),
    kind: 'arrow',
    points: anyPoints(c.random, 2, 6),
    ...maybe('start', anyAttachment(c)),
    ...maybe('end', anyAttachment(c)),
    heads: { start: pick(c.random, ARROW_HEADS), end: pick(c.random, ARROW_HEADS) },
    route: pick(c.random, ARROW_ROUTES),
    ...maybe('label', chance(c.random, 0.5) ? anyTextBlock(c.random) : undefined),
  }),
  note: (c) => ({
    ...anyCommon(c),
    kind: 'note',
    ...anySize(c.random),
    label: anyTextBlock(c.random),
  }),
  image: (c) => ({
    ...anyCommon(c),
    kind: 'image',
    ...anySize(c.random),
    file: randomText(c.random, HEX, 64) as FileId,
    ...maybe(
      'crop',
      chance(c.random, 0.5)
        ? {
            x: anyNumber(c.random, -1e9, 1e9),
            y: anyNumber(c.random, -1e9, 1e9),
            ...anySize(c.random),
          }
        : undefined,
    ),
  }),
  frame: (c) => ({ ...anyCommon(c), kind: 'frame', ...anySize(c.random), name: anyText(c.random) }),
};

/** Up to `max` distinct identifiers. */
const anyIds = <T extends string>(random: Random, max: number): T[] => [
  ...new Set(
    Array.from({ length: randomInt(random, 0, max) }, () => randomText(random, BASE64URL, 22) as T),
  ),
];

/** A valid document of up to 12 elements and 5 groups, whose groups form a forest. */
export function anyDocument(random: Random): DocumentState {
  const groupIds = anyIds<GroupId>(random, 5);
  const groups = groupIds.map((id, index): GroupRecord => {
    const parent =
      index > 0 && chance(random, 0.6) ? pick(random, groupIds.slice(0, index)) : undefined;
    return { id, ...maybe('parent', parent) };
  });
  const elementIds = anyIds<ElementId>(random, 12);
  const elements = elementIds.map((id) =>
    BUILDERS[pick(random, ELEMENT_KINDS)]({ random, id, elementIds, groupIds }),
  );
  return {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(groups.map((group) => [group.id, group])),
    canvas: { background: anyColor(random) },
    rev: randomInt(random, 0, 100),
  };
}

/** A copy of a JSON-like value with the keys of every object in a random order. */
function withShuffledKeys(random: Random, value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item: unknown) => withShuffledKeys(random, item));
  if (typeof value !== 'object' || value === null) return value;
  const entries = shuffled(random, Object.entries(value));
  return Object.fromEntries(entries.map(([key, item]) => [key, withShuffledKeys(random, item)]));
}

/** The same document, with its maps filled and the keys of its objects written in random orders. */
export function reordered(random: Random, document: DocumentState): DocumentState {
  const elements = shuffled(random, [...document.elements.values()]).map(
    (element) => withShuffledKeys(random, element) as Element,
  );
  const groups = shuffled(random, [...document.groups.values()]).map(
    (group) => withShuffledKeys(random, group) as GroupRecord,
  );
  return {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(groups.map((group) => [group.id, group])),
    canvas: { background: document.canvas.background },
    rev: document.rev,
  };
}
