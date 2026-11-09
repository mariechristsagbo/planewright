import type { Element, RenderFrame } from '@planewright/engine';

import { randomBetween, randomInt } from '../../../engine/src/math/random.ts';
import type { Random } from '../../../engine/src/math/random.ts';
import { color, freehand, line, shape, text } from './elements.ts';
import type { Placement } from './elements.ts';

// Seeded random scenes for the scene layer's properties (issue #34): elements of every P0 kind and
// style, drawn over several frames in which some of them come back at a new revision.

export const SQUARE = { width: 10, height: 10 };
export const POINTS = [
  { x: 0, y: 0 },
  { x: 10, y: 5 },
];

const COLORS = [color('#1e2430'), color('#c92a2a'), color('#2b8a3e')] as const;

const pick = <T>(random: Random, items: readonly [T, ...T[]]): T =>
  items[randomInt(random, 0, items.length - 1)] ?? items[0];

function styleOf(random: Random): NonNullable<Placement['style']> {
  return {
    stroke: {
      color: pick(random, COLORS),
      width: pick(random, [1, 2, 3]),
      dash: pick(random, ['solid', 'solid', 'dashed', 'dotted']),
    },
    fill: random.next() < 0.5 ? null : { color: pick(random, COLORS), pattern: 'solid' },
    opacity: pick(random, [1, 1, 0.4]),
  };
}

function textOf(random: Random, at: Placement): Element {
  const font = { family: pick(random, ['sans', 'mono'] as const), size: 16, lineHeight: 1.5 };
  const align = pick(random, ['left', 'center', 'right'] as const);
  return text({ text: pick(random, ['a', 'one\ntwo']), align, font }, at);
}

/** An element of any P0 kind and style, at a revision of 1 or more. */
function elementOf(random: Random, id: number, rev: number): Element {
  const at: Placement = {
    id,
    rev,
    x: randomBetween(random, -50, 50),
    y: randomBetween(random, -50, 50),
    rotation: random.next() < 0.5 ? 0 : randomBetween(random, 0.1, 6),
    style: styleOf(random),
  };
  const kind = pick(random, [
    'rectangle',
    'ellipse',
    'diamond',
    'line',
    'freehand',
    'text',
  ] as const);
  if (kind === 'line') return line(POINTS, at);
  if (kind === 'freehand') return freehand(random.next() < 0.3 ? [{ x: 1, y: 1 }] : POINTS, at);
  if (kind === 'text') return textOf(random, at);
  return shape(kind, SQUARE, at);
}

export interface Scene {
  readonly frames: readonly {
    readonly elements: readonly Element[];
    readonly view: Partial<RenderFrame>;
  }[];
}

/**
 * Three frames of a pool of twelve elements: each frame draws about four fifths of them, and gives
 * about a fifth a new revision, of any kind and style, which the path cache builds again.
 */
export function sceneOf(random: Random): Scene {
  const pool = Array.from({ length: 12 }, (_, index) => elementOf(random, index + 1, 1));
  const frames = [1, 2, 3].map((revision) => ({
    elements: pool
      .filter(() => random.next() < 0.8)
      .map((each) =>
        random.next() < 0.2 ? elementOf(random, Number(each.id.slice(1)), revision + 1) : each,
      ),
    view: {
      camera: { x: randomInt(random, -20, 20), y: 0, zoom: pick(random, [1, 0.5, 2]) },
      viewport: { width: 400, height: 300, pixelRatio: pick(random, [1, 1.5, 2]) },
    },
  }));
  return { frames };
}
