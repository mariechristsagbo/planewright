import { contentBounds } from '../../packages/engine/src/geometry/world-bounds.ts';
import type { Element, Point } from '../../packages/engine/src/model/elements.ts';

// Plane geometry and colour arithmetic for the README showcase's composition test (issue #52):
// distances to drawn outlines, points along lines, a drawing's bounds on the canvas under a camera,
// and the WCAG contrast and hue of `#rrggbb` colours.

/** The distance from a point to a closed polygon's edges, negative inside it. */
export function signedDistance(point: Point, polygon: readonly Point[]): number {
  let inside = false;
  let nearest = Infinity;
  for (const [index, p] of polygon.entries()) {
    const q = polygon[(index + 1) % polygon.length] ?? p;
    const crosses = p.y > point.y !== q.y > point.y;
    if (crosses && point.x < p.x + ((point.y - p.y) * (q.x - p.x)) / (q.y - p.y)) inside = !inside;
    const [dx, dy] = [q.x - p.x, q.y - p.y];
    const along = ((point.x - p.x) * dx + (point.y - p.y) * dy) / (dx * dx + dy * dy || 1);
    const t = Math.max(0, Math.min(1, along));
    nearest = Math.min(nearest, Math.hypot(point.x - p.x - t * dx, point.y - p.y - t * dy));
  }
  return inside ? -nearest : nearest;
}

/** A box's corners as a polygon. */
export const boxPolygon = ({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Point[] => [
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height },
];

/** Points every unit along a polyline's segments, its last point included. */
export const samplesAlong = (points: readonly Point[]): Point[] =>
  points.flatMap((p, index) => {
    const q = points[index + 1];
    if (q === undefined) return [p];
    const steps = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y));
    return Array.from({ length: steps }, (_, step) => ({
      x: p.x + ((q.x - p.x) * step) / steps,
      y: p.y + ((q.y - p.y) * step) / steps,
    }));
  });

/** A camera: the scene point at the canvas's top left, and the zoom. */
interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** Elements' bounds, strokes included, as edges on the canvas under a camera. */
export function onCanvas(elements: readonly Element[], { x, y, zoom }: Camera) {
  const bounds = contentBounds(elements) ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    left: (bounds.x - x) * zoom,
    top: (bounds.y - y) * zoom,
    right: (bounds.x + bounds.width - x) * zoom,
    bottom: (bounds.y + bounds.height - y) * zoom,
  };
}

const channelsOf = (hex: string) =>
  [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);

/** A colour's relative luminance (WCAG 2). */
export function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = channelsOf(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two opaque colours (WCAG 2). */
export function contrast(a: string, b: string): number {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** A colour's hue in degrees and its chroma, from 0 to 1. */
export function hueOf(hex: string): { hue: number; chroma: number } {
  const [r = 0, g = 0, b = 0] = channelsOf(hex);
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const chroma = max - min;
  if (chroma === 0) return { hue: 0, chroma };
  const sector =
    max === r ? (g - b) / chroma + 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return { hue: (sector * 60) % 360, chroma };
}
