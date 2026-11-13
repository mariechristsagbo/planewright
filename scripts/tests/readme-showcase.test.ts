import { describe, expect, it } from 'vitest';

import {
  DESKTOP_CAMERA,
  LANDSCAPE_CAMERA,
  TEXT_WIDTHS,
  outlinePolygon,
  showcaseElements,
  showcaseRecords,
} from '../../apps/web/tests/e2e/showcase-fixture.ts';
import type {
  Element,
  LineElement,
  Point,
  ShapeElement,
  TextElement,
} from '../../packages/engine/src/model/elements.ts';
import {
  boxPolygon,
  contrast,
  hueOf,
  luminance,
  onCanvas,
  samplesAlong,
  signedDistance,
} from './showcase-geometry.ts';

// The README showcase's composition (issue #52): one flow diagram whose nodes, labels and lines
// are found from the drawn elements alone, then held to the rules of a readable diagram. Its nodes
// keep apart, each label sits whole inside its node, each line runs straight across or down between
// the outlines of its own two nodes and nowhere near any other node or word, the branches are named
// beside their lines, and the colours give each role its hue with legible contrast. The cameras
// frame it, balanced, in the canvas that the chrome leaves free at 1440 × 900 at 100 % with the
// Elements drawer open, and whole, at a legible zoom, in the safe area of an 844 × 390 phone in
// landscape under its top row.

const ELEMENTS = showcaseElements();
const SHAPES = ELEMENTS.filter((e): e is ShapeElement =>
  ['rectangle', 'ellipse', 'diamond'].includes(e.kind),
);
const TEXTS = ELEMENTS.filter((e): e is TextElement => e.kind === 'text');
const LINES = ELEMENTS.filter((e): e is LineElement => e.kind === 'line');

/** The space between nodes, in scene units. */
const NODE_GAP = 48;
/** How far a line keeps from a node it does not join, and from every word. */
const LINE_CLEARANCE = 16;
const WORD_CLEARANCE = 6;
/** The room that a label leaves inside its node's outline, and a branch's word outside every node. */
const LABEL_ROOM = 12;
/** How far the diagram keeps from the free canvas's or the safe area's edges, in canvas pixels. */
const FRAME_MARGIN = 12;

/** At 1440 × 900 the canvas left of the open drawer, between the top and bottom islands. */
const DESKTOP_FREE = { left: 0, top: 86, right: 1124, bottom: 838 };
/** At 844 × 390 the safe area of safe-areas.spec.ts's insets, under the top row of islands. */
const LANDSCAPE_FREE = { left: 47, top: 62, right: 844 - 47, bottom: 390 - 21 };

const centreOf = (box: { x: number; y: number; width: number; height: number }): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

const OUTLINES = new Map(SHAPES.map((shape) => [shape, outlinePolygon(shape)]));
const outline = (shape: ShapeElement): Point[] => OUTLINES.get(shape) ?? [];

/** A node's labels: the texts whose box centre lies inside its outline. */
const labelsIn = (shape: ShapeElement) =>
  TEXTS.filter((text) => signedDistance(centreOf(text), outline(shape)) < 0);
const nameOf = (shape: ShapeElement) => labelsIn(shape)[0]?.content.text ?? '?';
const nodeNamed = (name: string) => SHAPES.find((shape) => nameOf(shape) === name);
const BRANCH_WORDS = TEXTS.filter((text) =>
  SHAPES.every((shape) => !labelsIn(shape).includes(text)),
);

/** A line's points in the scene, and points every unit along it. */
const sceneOf = (line: LineElement): Point[] =>
  line.points.map((point) => ({ x: point.x + line.x, y: point.y + line.y }));
const samplesOf = (line: LineElement): Point[] => samplesAlong(sceneOf(line));

/** The nodes whose drawn outline a point lies on, within half a unit. */
const nodesAt = (point: Point) =>
  SHAPES.filter((shape) => Math.abs(signedDistance(point, outline(shape))) <= 0.5).map(nameOf);

/** The nodes that a line joins, by the outlines that its first and last points lie on. */
function endsOf(line: LineElement): [string, string] {
  const scene = sceneOf(line);
  const [first = '', last = ''] = [scene[0], scene.at(-1)].map((point) =>
    nodesAt(point ?? { x: 0, y: 0 }).join('|'),
  );
  return [first, last];
}

const lineJoining = (from: string, to: string) =>
  LINES.find((line) => endsOf(line).join('→') === `${from}→${to}`);

/** The shortest distance between a text's box and a line. */
const wordToLine = (text: TextElement, line: LineElement) =>
  Math.min(...samplesOf(line).map((point) => signedDistance(point, boxPolygon(text))));

/** The hue band of a node's role: blue steps, amber decision and feedback, green Ready. */
function hueBand(name: string): readonly [number, number] {
  if (name === 'Ready') return [120, 150];
  return ['Clear?', 'Revise'].includes(name) ? [30, 45] : [200, 230];
}

/** A node's stroke and fill in its role's hue, its outline and label legible. */
function expectNodeColours(shape: ShapeElement): void {
  const [low, high] = hueBand(nameOf(shape));
  const fill = shape.style.fill?.color ?? '#ffffff';
  for (const colour of [shape.style.stroke.color, fill]) {
    expect(hueOf(colour).hue, `${nameOf(shape)} ${colour}`).toBeGreaterThanOrEqual(low);
    expect(hueOf(colour).hue, `${nameOf(shape)} ${colour}`).toBeLessThanOrEqual(high);
  }
  expect(contrast(shape.style.stroke.color, '#ffffff')).toBeGreaterThanOrEqual(3);
  const label = labelsIn(shape)[0]?.style.stroke.color ?? fill;
  expect(contrast(label, fill), `${nameOf(shape)}'s label`).toBeGreaterThanOrEqual(7);
}

/** A line or word in a dark neutral, or a feedback line in amber, legible on the white canvas. */
function expectInk(element: LineElement | TextElement): void {
  const colour = element.style.stroke.color;
  const neutral = hueOf(colour).chroma <= 0.15 && luminance(colour) <= 0.1;
  const feedback = element.kind === 'line' && endsOf(element).includes('Revise');
  expect(neutral || feedback, `${element.kind} ${colour} a dark neutral`).toBe(true);
  expect(contrast(colour, '#ffffff')).toBeGreaterThanOrEqual(element.kind === 'text' ? 4.5 : 3);
}

/** How far the middle of [a, b] lies from the middle of [c, d]. */
const offCentre = (a: number, b: number, c: number, d: number) => Math.abs((a + b - c - d) / 2);

const FLOW = ['Idea', 'Sketch', 'Refine', 'Clear?', 'Ready'];

describe('the README showcase', () => {
  it('draws six labelled nodes in the P0 kinds alone: an ellipse, rectangles and a diamond', () => {
    const kinds = new Set(ELEMENTS.map((element) => element.kind));
    expect(kinds).toEqual(new Set(['rectangle', 'ellipse', 'diamond', 'line', 'text']));
    expect(SHAPES.map((shape) => labelsIn(shape).length)).toEqual(SHAPES.map(() => 1));
    expect(Object.fromEntries(SHAPES.map((shape) => [nameOf(shape), shape.kind]))).toEqual({
      Idea: 'ellipse',
      Sketch: 'rectangle',
      Refine: 'rectangle',
      'Clear?': 'diamond',
      Ready: 'rectangle',
      Revise: 'rectangle',
    });
    const plain = (element: Element) => element.rotation === 0 && element.style.opacity === 1;
    expect(ELEMENTS.every(plain)).toBe(true);
  });

  it('joins Idea to Ready through Clear?, branches down to Revise and returns from it to Refine', () => {
    expect(LINES.map((line) => endsOf(line).join('→')).sort()).toEqual(
      [
        'Idea→Sketch',
        'Sketch→Refine',
        'Refine→Clear?',
        'Clear?→Ready',
        'Clear?→Revise',
        'Revise→Refine',
      ].sort(),
    );
  });

  it('names the branches beside their own lines: yes toward Ready, not yet toward Revise', () => {
    expect(BRANCH_WORDS.map((text) => text.content.text).sort()).toEqual(['not yet', 'yes']);
    for (const [word, to] of [
      ['yes', 'Ready'],
      ['not yet', 'Revise'],
    ] as const) {
      const text = BRANCH_WORDS.find((each) => each.content.text === word);
      const own = lineJoining('Clear?', to);
      if (text === undefined || own === undefined) throw new Error(`No ${word} branch.`);
      const nearest = Math.min(...LINES.map((line) => wordToLine(text, line)));
      expect(wordToLine(text, own), `${word} nearest its own line`).toBe(nearest);
      expect(nearest).toBeGreaterThanOrEqual(WORD_CLEARANCE);
      expect(nearest).toBeLessThanOrEqual(LINE_CLEARANCE);
    }
  });

  it('keeps the main row on one centre line from left to right, and Revise under the decision', () => {
    const row = FLOW.flatMap((name) => nodeNamed(name) ?? []);
    expect(row.map(nameOf)).toEqual(FLOW);
    const centres = row.map(centreOf);
    const ys = centres.map((centre) => centre.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.5);
    const xs = centres.map((centre) => centre.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    const [decision, revise] = [nodeNamed('Clear?'), nodeNamed('Revise')];
    if (decision === undefined || revise === undefined) throw new Error('No decision or Revise.');
    const rowBottom = Math.max(...row.map((shape) => shape.y + shape.height));
    expect(revise.y).toBeGreaterThanOrEqual(rowBottom + NODE_GAP);
    expect(Math.abs(centreOf(revise).x - centreOf(decision).x)).toBeLessThanOrEqual(0.5);
  });

  it(`leaves at least ${String(NODE_GAP)} units between any two nodes`, () => {
    const gaps = SHAPES.flatMap((a, index) =>
      SHAPES.slice(index + 1).map((b) => {
        const across = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
        const down = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
        return { pair: `${nameOf(a)}/${nameOf(b)}`, gap: Math.max(across, down) };
      }),
    );
    expect(gaps.filter(({ gap }) => gap < NODE_GAP)).toEqual([]);
  });

  it('centres each label in its node, measured, whole inside the outline with room around it', () => {
    for (const shape of SHAPES) {
      const [label] = labelsIn(shape);
      if (label === undefined) throw new Error('A node without a label.');
      expect([label.width, label.height]).toEqual([TEXT_WIDTHS[label.content.text], 25]);
      expect(label.content.font).toEqual({ family: 'sans', size: 20, lineHeight: 1.25 });
      const [c, d] = [centreOf(label), centreOf(shape)];
      expect(Math.hypot(c.x - d.x, c.y - d.y), `${nameOf(shape)} centred`).toBeLessThanOrEqual(0.5);
      const corners = boxPolygon(label).map((corner) => signedDistance(corner, outline(shape)));
      expect(Math.max(...corners), `${nameOf(shape)}'s label inside`).toBeLessThanOrEqual(
        -LABEL_ROOM,
      );
    }
  });

  it('runs each line straight across or down, outline to outline, clear of other nodes and words', () => {
    for (const line of LINES) {
      const scene = sceneOf(line);
      const legs = scene.slice(1).map((q, index) => [scene[index] ?? q, q] as const);
      expect(
        legs.every(([p, q]) => p.x === q.x || p.y === q.y),
        'across or down',
      ).toBe(true);
      const own = endsOf(line);
      for (const shape of SHAPES) {
        const reach = samplesOf(line).map((point) => signedDistance(point, outline(shape)));
        const floor = own.includes(nameOf(shape)) ? -0.5 : LINE_CLEARANCE;
        expect(Math.min(...reach), `${own.join('→')} by ${nameOf(shape)}`).toBeGreaterThanOrEqual(
          floor,
        );
      }
      const words = TEXTS.map((text) => wordToLine(text, line));
      expect(Math.min(...words), `${own.join('→')} by a word`).toBeGreaterThanOrEqual(
        WORD_CLEARANCE,
      );
    }
  });

  it('keeps every branch word outside every node, with room', () => {
    for (const text of BRANCH_WORDS) {
      for (const shape of SHAPES) {
        const corners = boxPolygon(text).map((corner) => signedDistance(corner, outline(shape)));
        expect(
          Math.min(...corners),
          `${text.content.text} by ${nameOf(shape)}`,
        ).toBeGreaterThanOrEqual(LABEL_ROOM);
      }
    }
  });

  it('gives the steps blue, the decision and feedback amber and Ready green, all legible', () => {
    SHAPES.forEach(expectNodeColours);
    [...LINES, ...TEXTS].forEach(expectInk);
  });

  it('fills the canvas beside the open drawer at 1440 × 900 at 100 %, balanced in it', () => {
    expect(DESKTOP_CAMERA.zoom).toBe(1);
    const shown = onCanvas(ELEMENTS, DESKTOP_CAMERA);
    const free = DESKTOP_FREE;
    const [width, height] = [free.right - free.left, free.bottom - free.top];
    expect(shown.left).toBeGreaterThanOrEqual(free.left + NODE_GAP);
    expect(shown.top).toBeGreaterThanOrEqual(free.top + NODE_GAP);
    expect(shown.right).toBeLessThanOrEqual(free.right - NODE_GAP);
    expect(shown.bottom).toBeLessThanOrEqual(free.bottom - NODE_GAP);
    expect(shown.right - shown.left).toBeGreaterThanOrEqual(0.75 * width);
    expect(shown.bottom - shown.top).toBeGreaterThanOrEqual(0.3 * height);
    expect(offCentre(shown.left, shown.right, free.left, free.right)).toBeLessThanOrEqual(
      0.05 * width,
    );
    expect(offCentre(shown.top, shown.bottom, free.top, free.bottom)).toBeLessThanOrEqual(
      0.05 * height,
    );
  });

  it('shows the whole diagram in an 844 × 390 landscape safe area, its words at least 12 px', () => {
    const smallest = Math.min(...TEXTS.map((text) => text.content.font.size));
    expect(smallest * LANDSCAPE_CAMERA.zoom).toBeGreaterThanOrEqual(12);
    const shown = onCanvas(ELEMENTS, LANDSCAPE_CAMERA);
    const free = LANDSCAPE_FREE;
    expect(shown.left).toBeGreaterThanOrEqual(free.left + FRAME_MARGIN);
    expect(shown.top).toBeGreaterThanOrEqual(free.top + FRAME_MARGIN);
    expect(shown.right).toBeLessThanOrEqual(free.right - FRAME_MARGIN);
    expect(shown.bottom).toBeLessThanOrEqual(free.bottom - FRAME_MARGIN);
    const width = free.right - free.left;
    expect(offCentre(shown.left, shown.right, free.left, free.right)).toBeLessThanOrEqual(
      0.05 * width,
    );
  });

  it('saves as one drawing of these elements, under the camera that it is given', () => {
    const { record, elements, count } = showcaseRecords(LANDSCAPE_CAMERA);
    expect(count).toBe(ELEMENTS.length);
    expect(elements).toHaveLength(ELEMENTS.length);
    expect(JSON.stringify(record)).toContain(JSON.stringify(LANDSCAPE_CAMERA).slice(1, -1));
  });
});
