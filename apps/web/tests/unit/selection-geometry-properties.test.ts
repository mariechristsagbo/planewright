import { localBox } from '@planewright/engine';
import type { Element, ElementId, Point } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { elementName, elementRow } from '../../src/a11y/element-names.ts';
import {
  figuresOf,
  normalizedDegrees,
  rotatedBounds,
  selectionGeometry,
} from '../../src/shell/selection/geometry.ts';
import type { Bounds } from '../../src/shell/selection/geometry.ts';
import { drawnKinds } from '../support/elements.ts';
import { between, checkProperty, integer } from '../support/property.ts';
import type { Seeded } from '../support/property.ts';

// The selection's geometry as properties over random elements of every P0 kind (issue #69's D1),
// each from a seed that a failure names: turned boxes, their union, the turn's normalisation, a
// line's length, and figures that agree with the element list's names and rows.

const kinds = drawnKinds();
const TURN = 2 * Math.PI;

/** Points of a line or stroke, normalised to a smallest x and y of 0, as the model keeps them. */
function anyPoints(random: Seeded, least: number, most: number): Point[] {
  const raw = Array.from({ length: integer(random, least, most) }, () => ({
    x: between(random, -500, 500),
    y: between(random, -500, 500),
  }));
  const minX = Math.min(...raw.map(({ x }) => x));
  const minY = Math.min(...raw.map(({ y }) => y));
  return raw.map(({ x, y }) => ({ x: x - minX, y: y - minY }));
}

/** A text's words over one to four lines. */
const anyWords = (random: Seeded): string =>
  Array.from({ length: integer(random, 1, 4) }, () => 'word'.repeat(integer(random, 0, 3))).join(
    '\n',
  );

/** An element of a random P0 kind at a random place, size and turn. */
function anyElement(random: Seeded): Element {
  const at = {
    x: between(random, -5000, 5000),
    y: between(random, -5000, 5000),
    rotation: between(random, 0, TURN),
  };
  const size = { width: between(random, 0, 1000), height: between(random, 0, 1000) };
  switch (integer(random, 0, 5)) {
    case 0:
      return { ...kinds.rectangle, ...at, ...size };
    case 1:
      return { ...kinds.ellipse, ...at, ...size };
    case 2:
      return { ...kinds.diamond, ...at, ...size };
    case 3:
      return { ...kinds.line, ...at, points: anyPoints(random, 2, 6) };
    case 4:
      return { ...kinds.freehand, ...at, points: anyPoints(random, 1, 8) };
    default:
      return {
        ...kinds.text,
        ...at,
        ...size,
        content: { ...kinds.text.content, text: anyWords(random) },
      };
  }
}

/** Whether two numbers agree within 1e-9 of the larger's size, and at least 1e-9. */
const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

const closeBounds = (a: Bounds, b: Bounds): boolean =>
  close(a.x, b.x) && close(a.y, b.y) && close(a.width, b.width) && close(a.height, b.height);

/** An element's local box corners turned about the box's centre. */
function turnedCorners(element: Element): Point[] {
  const { x, y, width, height } = localBox(element);
  const [cx, cy] = [x + width / 2, y + height / 2];
  const [cos, sin] = [Math.cos(element.rotation), Math.sin(element.rotation)];
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ].map(([dx = 0, dy = 0]) => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }));
}

/** Two to five elements with identifiers of their own. */
const anyElements = (random: Seeded): Element[] =>
  Array.from({ length: integer(random, 2, 5) }, (_, index) => ({
    ...anyElement(random),
    id: `property${String(index)}`.padEnd(22, 'A') as ElementId,
  }));

/** The union of boxes. */
function union(boxes: readonly Bounds[]): Bounds {
  const left = Math.min(...boxes.map(({ x }) => x));
  const top = Math.min(...boxes.map(({ y }) => y));
  const right = Math.max(...boxes.map(({ x, width }) => x + width));
  const bottom = Math.max(...boxes.map(({ y, height }) => y + height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

describe('the selection’s geometry, as properties', () => {
  it('D1 gives an unturned element’s bounds as its local box', () => {
    checkProperty({ seed: 6901 }, anyElement, (element) => {
      const flat = { ...element, rotation: 0 };
      expect(rotatedBounds(flat)).toEqual(localBox(flat));
    });
  });

  it('D1 turns an element’s bounds about its local box’s centre, |w cos θ| + |h sin θ| wide and |w sin θ| + |h cos θ| high', () => {
    checkProperty({ seed: 6902 }, anyElement, (element) => {
      const box = localBox(element);
      const bounds = rotatedBounds(element);
      const [cos, sin] = [Math.cos(element.rotation), Math.sin(element.rotation)];
      expect(close(bounds.x + bounds.width / 2, box.x + box.width / 2)).toBe(true);
      expect(close(bounds.y + bounds.height / 2, box.y + box.height / 2)).toBe(true);
      expect(close(bounds.width, Math.abs(box.width * cos) + Math.abs(box.height * sin))).toBe(
        true,
      );
      expect(close(bounds.height, Math.abs(box.width * sin) + Math.abs(box.height * cos))).toBe(
        true,
      );
    });
  });

  it('D1 bounds every turned corner, each edge reached by one of them', () => {
    checkProperty({ seed: 6903 }, anyElement, (element) => {
      const bounds = rotatedBounds(element);
      const corners = turnedCorners(element);
      const xs = corners.map(({ x }) => x);
      const ys = corners.map(({ y }) => y);
      expect(close(Math.min(...xs), bounds.x)).toBe(true);
      expect(close(Math.min(...ys), bounds.y)).toBe(true);
      expect(close(Math.max(...xs), bounds.x + bounds.width)).toBe(true);
      expect(close(Math.max(...ys), bounds.y + bounds.height)).toBe(true);
    });
  });

  it('D1 bounds several elements by the union of their bounds, whatever the selection’s order, moving with them', () => {
    checkProperty({ seed: 6904 }, anyElements, (elements) => {
      const ids = elements.map(({ id }) => id);
      const geometry = selectionGeometry(elements, ids);
      expect(geometry?.type === 'multiple' && geometry.count).toBe(elements.length);
      const box = geometry?.type === 'multiple' ? geometry.box : null;
      expect(box !== null && closeBounds(box, union(elements.map(rotatedBounds)))).toBe(true);
      expect(selectionGeometry(elements, [...ids].reverse())).toEqual(geometry);
      const moved = elements.map((element) => ({
        ...element,
        x: element.x + 37.5,
        y: element.y - 12,
      }));
      const after = selectionGeometry(moved, ids);
      const shifted = box === null ? null : { ...box, x: box.x + 37.5, y: box.y - 12 };
      expect(
        after?.type === 'multiple' && shifted !== null && closeBounds(after.box, shifted),
      ).toBe(true);
    });
  });

  it('D1 normalises any turn to [0, 360), the same for whole turns more or less, away from a rounding boundary', () => {
    const anyTurn = (random: Seeded) => ({
      rotation: between(random, -4 * TURN, 4 * TURN),
      turns: integer(random, -3, 3),
    });
    checkProperty({ seed: 6905, runs: 500 }, anyTurn, ({ rotation, turns }) => {
      const degrees = normalizedDegrees(rotation);
      expect(degrees >= 0 && degrees < 360).toBe(true);
      const tenths = (((((rotation * 180) / Math.PI) % 360) + 360) % 360) * 10;
      if (Math.abs(tenths - Math.floor(tenths) - 0.5) < 1e-6 || tenths > 3599.5 - 1e-6) return;
      expect(normalizedDegrees(rotation + turns * TURN)).toBe(degrees);
    });
  });

  it('D1 gives a line a length of at least the distance between its ends, equal for two points, whatever its turn', () => {
    const anyLine = (random: Seeded) => ({
      ...kinds.line,
      points: anyPoints(random, 2, 6),
      rotation: between(random, 0, TURN),
    });
    /** The figure's value of a lone element, or NaN. */
    const valueOf = (element: Element): number => {
      const geometry = selectionGeometry([element], [element.id]);
      return geometry?.type === 'single' ? (geometry.figure?.value ?? NaN) : NaN;
    };
    /** The distance between a line's first and last points. */
    const endsOf = (points: readonly Point[]): number => {
      const [first, last] = [points[0], points.at(-1)];
      return first === undefined || last === undefined
        ? NaN
        : Math.hypot(last.x - first.x, last.y - first.y);
    };
    checkProperty({ seed: 6906 }, anyLine, (line) => {
      const length = valueOf(line);
      const ends = endsOf(line.points);
      expect(length >= ends - 1e-9 * Math.max(1, ends)).toBe(true);
      if (line.points.length === 2) expect(close(length, ends)).toBe(true);
      expect(valueOf({ ...line, rotation: 0 })).toBe(length);
    });
  });

  it('D1 shows one element’s X, Y, W and H as its list row and name give them, and its angle as the row’s turn or 0°', () => {
    checkProperty({ seed: 6907, runs: 300 }, anyElement, (element) => {
      const geometry = selectionGeometry([element], [element.id]);
      if (geometry === null) throw new Error('No geometry for one element.');
      const [x, y, width, height, angle] = figuresOf(geometry).map(({ value }) => value);
      const turn = angle === '0°' ? [] : [angle];
      expect(elementRow(element).metadata).toBe(
        [`${String(width)} × ${String(height)}`, `${String(x)}, ${String(y)}`, ...turn].join(' · '),
      );
      const turned = angle === '0°' ? '' : `, turned ${String(angle?.slice(0, -1))} degrees`;
      expect(
        elementName(element).endsWith(
          `, ${String(width)} by ${String(height)}, at ${String(x)}, ${String(y)}${turned}`,
        ),
      ).toBe(true);
    });
  });
});
