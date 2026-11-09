import { TAU } from '../../src/math/angle.ts';
import { randomBetween, randomInt } from '../../src/math/random.ts';
import type { Random } from '../../src/math/random.ts';
import type { Element, Point } from '../../src/model/elements.ts';
import { LIMITS } from '../../src/model/limits.ts';
import type { ElementPatch } from '../../src/model/patch.ts';
import { anyOrderKey, chance, pick } from './scenes.ts';

// Patches for the differential tests of the change-set planner (issue 36): fields that an element
// holds set to valid values, fields added or removed, and values or names that a check refuses,
// so that every way an update can be planned runs against the planner as it was.

/** A patch for the element, or undefined when its kind has no such field. */
export type PatchOf = (random: Random, element: Element) => ElementPatch | undefined;

const has = (element: Element, key: string): boolean => Object.hasOwn(element, key);

const block = (text: string) => ({
  text,
  font: { family: 'sans', size: 16, lineHeight: 1.25 },
  align: 'center',
});

/** `count` points within `extent`, normalised to a smallest x and y of exactly 0. */
function normalised(random: Random, count: number, extent: number): Point[] {
  const raw = Array.from({ length: count }, () => ({
    x: randomBetween(random, 0, extent),
    y: randomBetween(random, 0, extent),
  }));
  const left = Math.min(...raw.map(({ x }) => x));
  const top = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - left, y: y - top }));
}

/** A new count of points for the element: often its own, so that pressures still match. */
const pointCount = (random: Random, element: Element & { readonly points: readonly Point[] }) =>
  chance(random, 0.7)
    ? element.points.length
    : randomInt(random, element.kind === 'freehand' ? 1 : 2, 6);

/** Moves by whole, fractional, signed-zero and limit values: the edits that a drag makes. */
const MOVES: readonly PatchOf[] = [
  (random, { x, y }) => ({ x: x + randomInt(random, -3, 3), y: y + randomInt(random, -3, 3) }),
  (random, { x, y }) => ({
    x: x + randomBetween(random, -600, 600),
    y: y + randomBetween(random, -600, 600),
  }),
  (random, { x }) => ({ x: x + randomBetween(random, -1, 1) }),
  (random, { y }) => ({
    x: -0,
    y: chance(random, 0.1) ? pick(random, [LIMITS.coordinate, -LIMITS.coordinate]) : y,
  }),
];

/** Valid new values for fields that the element already holds. */
const HELD: readonly PatchOf[] = [
  ...MOVES,
  ...MOVES,
  (random) => ({ rotation: chance(random, 0.3) ? 0 : randomBetween(random, 0, TAU) }),
  (random, element) =>
    has(element, 'width')
      ? { width: randomInt(random, 0, 900), height: chance(random, 0.1) ? LIMITS.size : 7 }
      : undefined,
  (random, element) =>
    'points' in element
      ? { points: normalised(random, pointCount(random, element), randomInt(random, 0, 900)) }
      : undefined,
  (random, { style }) => ({
    style: {
      ...style,
      opacity: random.next(),
      fill: chance(random, 0.5) ? null : { color: '#a5d8ff', pattern: 'hachure' },
    },
  }),
  (random) => ({ order: anyOrderKey(random) }),
  (_, { locked }) => ({ locked: !locked }),
  (random, element) => {
    const text = block(`edited ${String(randomInt(random, 0, 99))}`);
    if (element.kind === 'text') return { content: text };
    if (element.kind === 'frame') return { name: text.text };
    return has(element, 'label') ? { label: text } : undefined;
  },
  (random, element) =>
    has(element, 'link')
      ? { link: `mailto:x${String(randomInt(random, 0, 9))}@a.test` }
      : undefined,
  (random, element) =>
    element.kind === 'freehand' && element.pressures !== undefined
      ? { pressures: element.pressures.map(() => random.next()) }
      : undefined,
  (random, element) =>
    element.kind === 'image' && element.crop !== undefined
      ? { crop: { ...element.crop, width: randomInt(random, 0, 300) } }
      : undefined,
  (random, element) =>
    element.kind === 'arrow' && element.end !== undefined
      ? { end: { ...element.end, anchor: { x: random.next(), y: 0 } }, route: 'elbow' }
      : undefined,
  (random, { x, y, rotation }) => ({
    x: x + 1,
    y: y - 1,
    rotation: chance(random, 0.5) ? 0 : rotation,
  }),
];

/** Valid patches that add or remove an optional field, which the generic path applies. */
const RESHAPING: readonly PatchOf[] = [
  (_, element) => ({ link: has(element, 'link') ? null : 'https://example.test/new' }),
  (_, element) =>
    element.kind === 'rectangle' || element.kind === 'ellipse' || element.kind === 'diamond'
      ? { label: has(element, 'label') ? null : block('new') }
      : undefined,
  (_, element) =>
    element.kind === 'freehand'
      ? { pressures: has(element, 'pressures') ? null : element.points.map(() => 0.5) }
      : undefined,
  (_, element) => (has(element, 'group') ? { group: null, x: element.x + 2 } : undefined),
];

/** Patches that a check refuses: unknown or unpatched names, removed required fields, bad values. */
const BROKEN: readonly PatchOf[] = [
  () => ({ foo: 1 }),
  () => JSON.parse('{"__proto__":{"x":1},"y":2}') as ElementPatch,
  (random) => pick(random, [{ constructor: 1 }, { toString: 'x' }, { hasOwnProperty: null }]),
  (random, element) => pick(random, [{ id: element.id }, { kind: 'ellipse' }, { rev: 3 }]),
  (random) => pick(random, [{ x: null }, { style: null }, { order: null }]),
  (random, { y }) => ({
    x: pick(random, ['1', Number.NaN, Infinity, -Infinity, 2e9, undefined, {}, [], true]),
    y,
  }),
  (random) => pick(random, [{ rotation: TAU }, { rotation: -1e-300 }, { width: -1 }]),
  (random) => pick(random, [{ locked: 'yes' }, { order: '10' }, { order: '' }]),
  () => ({ link: 'javascript:void 0' }),
  (random, { style }) =>
    pick(random, [
      { style: { ...style, extra: 1 } },
      { style: { ...style, opacity: 2 } },
      { style: { ...style, stroke: { ...style.stroke, color: 'red' } } },
    ]),
  (random) =>
    pick(random, [
      { points: [] },
      {
        points: [
          { x: 1, y: 1 },
          { x: 2, y: 3 },
        ],
      },
      {
        points: [
          { x: 0, y: 0 },
          { x: 2e7, y: 0 },
        ],
      },
    ]),
  (_, element) =>
    element.kind === 'arrow'
      ? { start: { target: element.id, anchor: { x: 0, y: 0 } } }
      : { label: block('a\r\nb') },
  (random, element) =>
    element.kind === 'freehand'
      ? { points: normalised(random, element.points.length + 1, 50) }
      : { content: 5 },
  (_, element) => (element.kind === 'image' ? { file: 'not a file id' } : { name: 7 }),
];

/** A move of the element, as a drag makes it. */
export const anyMove = (random: Random, element: Element): ElementPatch =>
  pick(random, MOVES)(random, element) ?? { x: element.x + 1 };

/** A move, a turn or a resize of the element, as the Selection tool's gestures make them. */
export function anyGesturePatch(random: Random, element: Element): ElementPatch {
  // Moves of at most 600 units, so that a few of them never reach the coordinate limit.
  const move = pick(random, MOVES.slice(0, 3))(random, element) ?? { x: element.x + 1 };
  if (chance(random, 0.5)) return move;
  const turn = { ...move, rotation: randomBetween(random, 0, TAU) };
  return has(element, 'width') && chance(random, 0.5)
    ? { ...turn, width: randomInt(random, 0, 900), height: randomBetween(random, 0, 900) }
    : turn;
}

/** A patch of the element: mostly held fields, sometimes fields added or removed. */
export function anyValidPatch(random: Random, element: Element): ElementPatch {
  const choices = chance(random, 0.85) ? HELD : RESHAPING;
  for (let tries = 0; tries < 8; tries += 1) {
    const patch = pick(random, choices)(random, element);
    if (patch !== undefined) return patch;
  }
  return { x: element.x + 1 };
}

/** A patch that the element check refuses, or that a kind cannot hold. */
export const anyBrokenPatch = (random: Random, element: Element): ElementPatch =>
  pick(random, BROKEN)(random, element) ?? { foo: 1 };
