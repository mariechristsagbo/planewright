import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GLYPHS, ICON_NAMES } from '../../src/shell/glyphs.ts';
import type { Primitive } from '../../src/shell/glyphs.ts';
import { Icon } from '../../src/shell/icons.tsx';

// The chrome's original glyphs (ADR 0012, decision 3): 35 of them, 34 interface glyphs and the
// mark, each built from geometric primitives on a 20 px grid inside a 2 px margin, and drawn by
// one Icon component 1.5 px wide in currentColor, hidden from assistive technology.

/** The commands and numbers of a path, such as ['M', 6.5, 12, 'V', 5.25]. */
const tokensOf = (d: string): (string | number)[] =>
  (d.match(/[a-z]|-?(?:\d+\.?\d*|\.\d+)/giu) ?? []).map((token) =>
    /[a-z]/iu.test(token) ? token : Number(token),
  );

/** How many numbers each path command takes; only straight segments and circular arcs exist. */
const ARITY: Readonly<Record<string, number>> = { m: 2, l: 2, h: 1, v: 1, a: 7, z: 0 };

/** The pen's point after one command's numbers, relative to it for a lower-case command. */
function step(
  [x, y]: readonly [number, number],
  command: string,
  args: readonly number[],
): readonly [number, number] {
  const [dx, dy] = command === command.toLowerCase() ? [x, y] : [0, 0];
  switch (command.toLowerCase()) {
    case 'h':
      return [(args[0] ?? 0) + dx, y];
    case 'v':
      return [x, (args[0] ?? 0) + dy];
    case 'z':
      return [x, y];
    default:
      return [(args.at(-2) ?? 0) + dx, (args.at(-1) ?? 0) + dy];
  }
}

/** Every point that a path names, made absolute, or null when it uses another command. */
function pathPoints(d: string): (readonly [number, number])[] | null {
  const tokens = tokensOf(d);
  const points: (readonly [number, number])[] = [];
  let pen: readonly [number, number] = [0, 0];
  let command = '';
  while (tokens.length > 0) {
    if (typeof tokens[0] === 'string') command = String(tokens.shift());
    const arity = ARITY[command.toLowerCase()];
    if (arity === undefined || (arity === 0 && typeof tokens[0] === 'number')) return null;
    pen = step(pen, command, tokens.splice(0, arity).map(Number));
    points.push(pen);
  }
  return points;
}

/** The extremes that each kind of primitive but a path reaches, from its numbers. */
const EXTENTS: Readonly<Record<Exclude<Primitive[0], 'path'>, (args: number[]) => number[]>> = {
  rect: ([x = 0, y = 0, width = 0, height = 0]) => [x, y, x + width, y + height],
  circle: ([cx = 0, cy = 0, r = 0]) => [cx - r, cy - r, cx + r, cy + r],
  ellipse: ([cx = 0, cy = 0, rx = 0, ry = 0]) => [cx - rx, cy - ry, cx + rx, cy + ry],
  line: (points) => points,
  polyline: (points) => points,
  polygon: (points) => points,
  dot: (point) => point,
};

/** The extremes that a primitive reaches on the grid, before its stroke's width. */
function extentOf(primitive: Primitive): number[] | null {
  if (primitive[0] === 'path') return pathPoints(primitive[1])?.flat() ?? null;
  const [kind, ...args] = primitive;
  return EXTENTS[kind](args);
}

describe('the original glyphs', () => {
  it('D1 A2 are 35 in one typed record: 34 interface glyphs and the mark', () => {
    expect(ICON_NAMES).toHaveLength(35);
    expect(new Set(ICON_NAMES).size).toBe(35);
    expect(Object.keys(GLYPHS)).toEqual([...ICON_NAMES]);
    expect(ICON_NAMES.filter((name) => name !== 'mark')).toHaveLength(34);
    for (const name of ICON_NAMES) expect(GLYPHS[name].length).toBeGreaterThan(0);
  });

  it('D1 draws each glyph from geometric primitives inside the 20 px grid and its 2 px margin', () => {
    for (const name of ICON_NAMES) {
      for (const primitive of GLYPHS[name]) {
        const extent = extentOf(primitive);
        expect(extent, `${name}: ${JSON.stringify(primitive)}`).not.toBeNull();
        for (const value of extent ?? []) {
          expect(value, `${name}: ${JSON.stringify(primitive)}`).toBeGreaterThanOrEqual(2);
          expect(value, `${name}: ${JSON.stringify(primitive)}`).toBeLessThanOrEqual(18);
        }
      }
    }
  });

  it('D1 accepts only straight segments and circular arcs in a path', () => {
    expect(pathPoints('M2 2 L18 18 H2 V18 A1 1 0 0 1 4 4 Z')).toHaveLength(6);
    expect(pathPoints('M2 2 C4 4 6 6 8 8')).toBeNull();
    expect(pathPoints('M2 2 Q4 4 8 8')).toBeNull();
    expect(pathPoints('m3 3 h2 v2 l1 1 a1 1 0 0 1 2 0')).toEqual([
      [3, 3],
      [5, 3],
      [5, 5],
      [6, 6],
      [8, 6],
    ]);
  });
});

describe('the Icon component', () => {
  it('D1 draws a glyph 20 px wide by default, stroked 1.5 px in currentColor and hidden from assistive technology', () => {
    const { container } = render(<Icon name="hand" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(
      Object.fromEntries([...(svg?.attributes ?? [])].map((each) => [each.name, each.value])),
    ).toEqual({
      'data-glyph': 'hand',
      viewBox: '0 0 20 20',
      width: '20',
      height: '20',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    });
  });

  it('D1 draws every glyph at the size asked, one shape per primitive, in currentColor alone', () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} size={16} />);
      const svg = container.querySelector(`svg[data-glyph="${name}"]`);
      expect([svg?.getAttribute('width'), svg?.getAttribute('height')]).toEqual(['16', '16']);
      const shapes = [...(svg?.children ?? [])];
      expect(shapes).toHaveLength(GLYPHS[name].length);
      for (const shape of shapes) {
        for (const paint of ['fill', 'stroke', 'color', 'style', 'class']) {
          expect([null, 'none', 'currentColor']).toContain(shape.getAttribute(paint));
        }
      }
      unmount();
    }
  });
});
