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
  (d.match(/[a-z]|-?(?:\d+(?:\.\d*)?|\.\d+)/giu) ?? []).map((token) =>
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

type Point = readonly [number, number];

/** One command of a path: its letter, the pen before it, its numbers and the pen after it. */
interface Segment {
  readonly command: string;
  readonly from: Point;
  readonly args: readonly number[];
  readonly to: Point;
}

/** A path's commands, made absolute, or null when it uses another command. */
function segmentsOf(d: string): Segment[] | null {
  const tokens = tokensOf(d);
  const segments: Segment[] = [];
  let pen: Point = [0, 0];
  let command = '';
  while (tokens.length > 0) {
    if (typeof tokens[0] === 'string') command = String(tokens.shift());
    const arity = ARITY[command.toLowerCase()];
    if (arity === undefined || (arity === 0 && typeof tokens[0] === 'number')) return null;
    const args = tokens.splice(0, arity).map(Number);
    const to = step(pen, command, args);
    segments.push({ command: command.toLowerCase(), from: pen, args, to });
    pen = to;
  }
  return segments;
}

/** Every point that a path names, made absolute, or null when it uses another command. */
const pathPoints = (d: string): Point[] | null => segmentsOf(d)?.map(({ to }) => to) ?? null;

/** The signed angle from one vector to another, between -π and π. */
const angleFrom = ([ux, uy]: Point, [vx, vy]: Point): number =>
  Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);

/** The angle that an arc sweeps, from the turn between its ends and its sweep flag (F.6.5.6). */
function sweepOf(turn: number, positive: number): number {
  if (positive === 0) return turn > 0 ? turn - 2 * Math.PI : turn;
  return turn < 0 ? turn + 2 * Math.PI : turn;
}

/** An arc's ellipse, its rotation, and the angles where it starts and that it sweeps. */
interface Arc {
  readonly centre: Point;
  readonly radii: Point;
  readonly rotation: number;
  readonly start: number;
  readonly sweep: number;
}

/**
 * The ellipse of an arc command from its two ends (SVG 1.1, appendix F.6.5, with the radii scaled
 * up as F.6.6 asks when they cannot reach), or null for an arc that SVG draws straight or not at all.
 */
function arcOf({ from, args, to }: Segment): Arc | null {
  const nth = (index: number): number => args[index] ?? 0;
  const [rx0, ry0, large, positive] = [Math.abs(nth(0)), Math.abs(nth(1)), nth(3), nth(4)];
  if (rx0 === 0 || ry0 === 0 || (from[0] === to[0] && from[1] === to[1])) return null;
  const rotation = (nth(2) * Math.PI) / 180;
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const [hx, hy] = [(from[0] - to[0]) / 2, (from[1] - to[1]) / 2];
  const [x1, y1] = [cos * hx + sin * hy, cos * hy - sin * hx];
  const scale = Math.max(1, Math.hypot(x1 / rx0, y1 / ry0));
  const [rx, ry] = [rx0 * scale, ry0 * scale];
  const [a, b] = [(rx * y1) ** 2, (ry * x1) ** 2];
  const root =
    (large === positive ? -1 : 1) * Math.sqrt(Math.max(0, ((rx * ry) ** 2 - a - b) / (a + b)));
  const [ox, oy] = [(root * rx * y1) / ry, (-root * ry * x1) / rx];
  const centre: Point = [
    cos * ox - sin * oy + (from[0] + to[0]) / 2,
    sin * ox + cos * oy + (from[1] + to[1]) / 2,
  ];
  const first: Point = [(x1 - ox) / rx, (y1 - oy) / ry];
  const turn = angleFrom(first, [(-x1 - ox) / rx, (-y1 - oy) / ry]);
  return {
    centre,
    radii: [rx, ry],
    rotation,
    start: angleFrom([1, 0], first),
    sweep: sweepOf(turn, positive),
  };
}

/** An arc's ends and the points between them where it reaches furthest along x or along y. */
function arcReach(segment: Segment): Point[] {
  const arc = arcOf(segment);
  if (arc === null) return [segment.from, segment.to];
  const { centre, radii, rotation, start, sweep } = arc;
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const at = (angle: number): Point => [
    centre[0] + radii[0] * cos * Math.cos(angle) - radii[1] * sin * Math.sin(angle),
    centre[1] + radii[0] * sin * Math.cos(angle) + radii[1] * cos * Math.sin(angle),
  ];
  // Where x stops growing or shrinking, then y, each again every half turn.
  const turns = [
    Math.atan2(-radii[1] * sin, radii[0] * cos),
    Math.atan2(radii[1] * cos, radii[0] * sin),
  ];
  const [low, high] = [Math.min(start, start + sweep), Math.max(start, start + sweep)];
  const between = turns
    .flatMap((turn) => [-3, -2, -1, 0, 1, 2, 3].map((half) => turn + half * Math.PI))
    .filter((angle) => angle > low && angle < high);
  return [segment.from, segment.to, ...between.map(at)];
}

/** Every point where a path reaches furthest, each arc's bulge included, or null. */
const pathReach = (d: string): Point[] | null =>
  segmentsOf(d)?.flatMap((segment) =>
    segment.command === 'a' ? arcReach(segment) : [segment.to],
  ) ?? null;

/** A coordinate without the floating-point noise of the arcs' trigonometry. */
const settled = (value: number): number => Math.round(value * 1e9) / 1e9;

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
  if (primitive[0] === 'path') return pathReach(primitive[1])?.flat().map(settled) ?? null;
  const [kind, ...args] = primitive;
  return EXTENTS[kind](args);
}

/** The box of a primitive's extremes on the grid: its least x and y, then its greatest. */
function boxOf(primitive: Primitive): number[] | null {
  const extent = extentOf(primitive);
  if (extent === null) return null;
  const xs = extent.filter((_, index) => index % 2 === 0);
  const ys = extent.filter((_, index) => index % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
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

  it('D1 reaches an arc’s bulge, not only its ends, so that an arc outside the margin fails', () => {
    // The review's mutant: both ends inside the margin, the arc's top at y 0.5.
    expect(boxOf(['path', 'M3 2.5a2 2 0 0 1 4 0'])).toEqual([3, 0.5, 7, 2.5]);
    expect(boxOf(['path', 'M3 2.5a2 2 0 0 0 4 0'])).toEqual([3, 2.5, 7, 4.5]);
    // Radii too small for the ends, scaled up as SVG does; a large arc; a rotated ellipse.
    expect(boxOf(['path', 'M2 10A1 1 0 0 1 6 10'])).toEqual([2, 8, 6, 10]);
    expect(boxOf(['path', 'M10 4A6 6 0 1 1 4 10'])).toEqual([4, 4, 16, 16]);
    expect(boxOf(['path', 'M10 4A6 3 90 0 1 10 16'])).toEqual([10, 4, 13, 16]);
    // The lock's open shackle, whose top touches the margin.
    expect(boxOf(['path', 'M7 9V5a3 3 0 0 1 6 0v1.5'])).toEqual([7, 2, 13, 9]);
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
