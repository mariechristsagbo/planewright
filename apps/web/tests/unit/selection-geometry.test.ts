import type { ElementId } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import {
  figuresOf,
  normalizedDegrees,
  rotatedBounds,
  selectionGeometry,
} from '../../src/shell/selection/geometry.ts';
import type { Figure, SelectionGeometry } from '../../src/shell/selection/geometry.ts';
import { drawnKinds } from '../support/elements.ts';

// The selection's figures (ADR 0012; the v0.2 plan's S6, issue #69's D1): one element's unrotated
// local box, its turn from 0 to 360 and its kind's figure, or several elements' count and the union
// of their turned boxes, with no stroke and no angle, as the panel, the bar and the Details sheet
// show them. Properties over random elements are in selection-geometry-properties.test.ts.

const kinds = drawnKinds();
const rectangle = { ...kinds.rectangle, width: 120, height: 80 };

/** What the panel shows: each figure's term, value and full word. */
const shown = (geometry: SelectionGeometry | null): (readonly [string, string, string | null])[] =>
  geometry === null
    ? []
    : figuresOf(geometry).map(({ term, value, word }: Figure) => [term, value, word]);

/** The figures that follow the four of the box. */
const after = (geometry: SelectionGeometry | null) => shown(geometry).slice(4);

describe('the selection’s geometry', () => {
  it('D1 reads an unrotated rectangle’s figures from its local box, with no turn', () => {
    const geometry = selectionGeometry([rectangle], [rectangle.id]);
    expect(geometry).toEqual({
      type: 'single',
      kind: 'rectangle',
      box: { x: 350, y: 250, width: 120, height: 80 },
      degrees: 0,
      figure: null,
    });
    expect(shown(geometry)).toEqual([
      ['X', '350', null],
      ['Y', '250', null],
      ['W', '120', 'Width'],
      ['H', '80', 'Height'],
      ['Angle', '0°', null],
    ]);
    expect(rotatedBounds(rectangle)).toEqual({ x: 350, y: 250, width: 120, height: 80 });
  });

  it('D1 keeps a turned rectangle’s unrotated box and gives its angle, its bounds turning about its centre', () => {
    const turned = { ...rectangle, rotation: Math.PI / 4 };
    const geometry = selectionGeometry([turned], [turned.id]);
    expect(geometry).toMatchObject({
      box: { x: 350, y: 250, width: 120, height: 80 },
      degrees: 45,
    });
    expect(after(geometry)).toEqual([['Angle', '45°', null]]);
    const bounds = rotatedBounds(turned);
    const side = 200 / Math.SQRT2;
    expect(bounds.x).toBeCloseTo(410 - side / 2, 9);
    expect(bounds.y).toBeCloseTo(290 - side / 2, 9);
    expect(bounds.width).toBeCloseTo(side, 9);
    expect(bounds.height).toBeCloseTo(side, 9);
  });

  it('D1 reads a turn of −90° as 270°, and one just short of a whole turn as 0°', () => {
    const back = { ...rectangle, rotation: -Math.PI / 2 };
    expect(normalizedDegrees(-Math.PI / 2)).toBe(270);
    expect(after(selectionGeometry([back], [back.id]))).toEqual([['Angle', '270°', null]]);
    const bounds = rotatedBounds(back);
    expect(
      [bounds.x, bounds.y, bounds.width, bounds.height].map((v) => Math.round(v * 1e6) / 1e6),
    ).toEqual([370, 230, 80, 120]);
    const almost = { ...rectangle, rotation: 2 * Math.PI - 1e-9 };
    expect(normalizedDegrees(2 * Math.PI - 1e-9)).toBe(0);
    expect(selectionGeometry([almost], [almost.id])).toMatchObject({ degrees: 0 });
    expect(after(selectionGeometry([almost], [almost.id]))).toEqual([['Angle', '0°', null]]);
  });

  it('D1 gives a line its length, the sum of its segments rather than the distance between its ends', () => {
    const two = {
      ...kinds.line,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
      ],
    };
    expect(selectionGeometry([two], [two.id])).toMatchObject({
      box: { width: 30, height: 40 },
      figure: { term: 'Length', value: 50 },
    });
    expect(after(selectionGeometry([two], [two.id]))).toEqual([
      ['Angle', '0°', null],
      ['Length', '50', null],
    ]);
    const three = {
      ...kinds.line,
      points: [
        { x: 0, y: 0 },
        { x: 30, y: 40 },
        { x: 60, y: 0 },
      ],
    };
    expect(after(selectionGeometry([three], [three.id]))).toEqual([
      ['Angle', '0°', null],
      ['Length', '100', null],
    ]);
    const diagonal = {
      ...kinds.line,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    };
    expect(after(selectionGeometry([diagonal], [diagonal.id]))).toContainEqual([
      'Length',
      '1.4',
      null,
    ]);
  });

  it('D1 gives a freehand stroke its points, one for a dot, whatever pressures it keeps', () => {
    // A stroke drawn from the keyboard keeps no pressures.
    const stroke = kinds.freehand;
    expect('pressures' in stroke).toBe(false);
    const dot = { ...stroke, points: [{ x: 0, y: 0 }] };
    expect(selectionGeometry([dot], [dot.id])).toMatchObject({
      kind: 'freehand',
      box: { width: 0, height: 0 },
      figure: { term: 'Points', value: 1 },
    });
    const pressed = {
      ...stroke,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 9, y: 4 },
      ],
      pressures: [0.5, 0.5],
    };
    expect(after(selectionGeometry([pressed], [pressed.id]))).toEqual([
      ['Angle', '0°', null],
      ['Points', '3', null],
    ]);
  });

  it('D1 gives a text its lines, a trailing line break making one more', () => {
    const lines = (words: string) => {
      const text = { ...kinds.text, content: { ...kinds.text.content, text: words } };
      return after(selectionGeometry([text], [text.id]));
    };
    expect(lines('Plan')).toEqual([
      ['Angle', '0°', null],
      ['Lines', '1', null],
    ]);
    expect(lines('Plan\nthe\nweek')).toContainEqual(['Lines', '3', null]);
    expect(lines('Plan\n')).toContainEqual(['Lines', '2', null]);
  });

  it('D1 gives no figure of its own to a rectangle, an ellipse or a diamond', () => {
    for (const shape of [kinds.rectangle, kinds.ellipse, kinds.diamond]) {
      expect(selectionGeometry([shape], [shape.id])).toMatchObject({
        kind: shape.kind,
        figure: null,
      });
    }
  });

  it('D1 gives several elements their count and the union of their turned boxes, with no stroke and no angle', () => {
    const turned = { ...rectangle, rotation: Math.PI / 2 };
    const ellipse = { ...kinds.ellipse, x: 500, y: 400, width: 50, height: 20 };
    const wide = {
      ...turned,
      style: { ...turned.style, stroke: { ...turned.style.stroke, width: 40 } },
    };
    const geometry = selectionGeometry([ellipse, wide], [wide.id, ellipse.id]);
    // The turned rectangle's box is 80 by 120 about (410, 290): from (370, 230) to (450, 350).
    expect(geometry?.type).toBe('multiple');
    if (geometry?.type !== 'multiple') return;
    expect(geometry.count).toBe(2);
    const { x, y, width, height } = geometry.box;
    expect([x, y, width, height].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([
      370, 230, 180, 190,
    ]);
    expect(shown(geometry)).toEqual([
      ['X', '370', null],
      ['Y', '230', null],
      ['W', '180', 'Width'],
      ['H', '190', 'Height'],
    ]);
  });

  it('D1 skips the identifiers that the elements do not hold, and gives nothing for an empty selection', () => {
    const missing = 'AAAAAAAAAAAAAAAAAAAAZZ' as ElementId;
    expect(selectionGeometry([rectangle], [])).toBeNull();
    expect(selectionGeometry([rectangle], [missing])).toBeNull();
    expect(selectionGeometry([], [rectangle.id])).toBeNull();
    expect(selectionGeometry([rectangle, kinds.ellipse], [missing, rectangle.id])).toMatchObject({
      type: 'single',
      kind: 'rectangle',
    });
  });
});
