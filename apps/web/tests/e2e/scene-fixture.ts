import { geometryOf } from '../../../../packages/engine/src/geometry/kinds.ts';
import { localBox } from '../../../../packages/engine/src/geometry/world-bounds.ts';
import { toColor } from '../../../../packages/engine/src/model/color.ts';
import {
  INITIAL_DEFAULT_STYLE,
  styleForKind,
} from '../../../../packages/engine/src/model/defaults.ts';
import type { Element } from '../../../../packages/engine/src/model/elements.ts';
import type { ElementId } from '../../../../packages/engine/src/model/ids.ts';
import { keysBetween } from '../../../../packages/engine/src/model/order-key.ts';
import type { Style } from '../../../../packages/engine/src/model/style.ts';
import { planSave } from '../../../../packages/engine/src/persistence/records.ts';
import type { DocumentId } from '../../../../packages/engine/src/persistence/repository.ts';
import { FONT_STACKS } from '../../../../packages/render-canvas/src/fonts.ts';

// A drawing for the scene layer's pixel test (issue #34): overlapping elements of every P0 kind
// and style, and the calls that draw it as the scene layer drew it before issue #34, each element
// in a state of its own saved over the canvas's defaults. The calls come from the drawing rules
// and the engine's geometry, not from the renderer, so that the page's pixels can be compared
// with them.

export const FIXTURE_CAMERA = { x: -30, y: -20, zoom: 1.25 };
const BACKGROUND = '#fffdf8';

type Fields = Readonly<Record<string, unknown>> & { readonly kind: Element['kind'] };

const STROKES: readonly (readonly [Fields, Partial<Style>])[] = [
  [
    { kind: 'rectangle', x: 40, y: 40, width: 200, height: 120 },
    { fill: { color: toColor('#a5d8ff'), pattern: 'solid' } },
  ],
  [
    { kind: 'rectangle', x: 260, y: 40, width: 90, height: 60 },
    { fill: { color: toColor('#a5d8ff'), pattern: 'solid' } },
  ],
  [
    { kind: 'ellipse', x: 150, y: 80, width: 180, height: 100, rotation: 0.5 },
    {
      opacity: 0.4,
      fill: { color: toColor('#ffc9c9'), pattern: 'solid' },
      stroke: { color: toColor('#c92a2a'), width: 3, dash: 'dashed' },
    },
  ],
  [
    { kind: 'diamond', x: 100, y: 60, width: 120, height: 120 },
    { stroke: { color: toColor('#2b8a3e'), width: 4, dash: 'dotted' } },
  ],
  [
    {
      kind: 'line',
      x: 60,
      y: 150,
      points: [
        { x: 0, y: 0 },
        { x: 120, y: 40 },
        { x: 240, y: 0 },
      ],
    },
    { stroke: { color: toColor('#1864ab'), width: 3, dash: 'solid' } },
  ],
  [
    {
      kind: 'freehand',
      x: 200,
      y: 20,
      points: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: 20 * i, y: 30 * (i % 2) + 2 * i })),
    },
    { opacity: 0.7, stroke: { color: toColor('#862e9c'), width: 2, dash: 'solid' } },
  ],
  [
    { kind: 'freehand', x: 330, y: 150, points: [{ x: 0, y: 0 }] },
    { stroke: { color: toColor('#e67700'), width: 9, dash: 'solid' } },
  ],
  [
    { kind: 'rectangle', x: 120, y: 110, width: 160, height: 70, rotation: 2 },
    { opacity: 0.4, stroke: { color: toColor('#1e2430'), width: 1, dash: 'dashed' } },
  ],
  [
    {
      kind: 'line',
      x: 20,
      y: 200,
      points: [
        { x: 0, y: 0 },
        { x: 300, y: 10 },
      ],
    },
    { stroke: { color: toColor('#c92a2a'), width: 2, dash: 'dotted' } },
  ],
  [{ kind: 'ellipse', x: 370, y: 30, width: 60, height: 120 }, {}],
];

const text = (
  content: string,
  family: 'sans' | 'hand' | 'mono',
  align: 'left' | 'center' | 'right',
) => ({
  text: content,
  font: { family, size: { sans: 20, hand: 24, mono: 16 }[family], lineHeight: 1.25 },
  align,
});

const TEXTS: readonly (readonly [Fields, Partial<Style>])[] = [
  [
    {
      kind: 'text',
      x: 180,
      y: 90,
      width: 110,
      height: 50,
      rotation: 0.3,
      content: text('one\ntwo', 'sans', 'center'),
    },
    { fill: { color: toColor('#ffec99'), pattern: 'solid' } },
  ],
  [
    {
      kind: 'text',
      x: 260,
      y: 120,
      width: 90,
      height: 20,
      content: text('right', 'mono', 'right'),
    },
    { stroke: { color: toColor('#1864ab'), width: 2, dash: 'solid' } },
  ],
  [
    { kind: 'text', x: 60, y: 100, width: 120, height: 30, content: text('hand', 'hand', 'left') },
    { opacity: 0.4 },
  ],
  [
    {
      kind: 'text',
      x: 70,
      y: 130,
      width: 120,
      height: 25,
      content: text('sans again', 'sans', 'left'),
    },
    {},
  ],
];

/** The last element is translucent, so that every frame leaves a translucent state behind. */
const LAST: readonly [Fields, Partial<Style>] = [
  { kind: 'diamond', x: 300, y: 160, width: 80, height: 60 },
  { opacity: 0.5, fill: { color: toColor('#b2f2bb'), pattern: 'solid' } },
];

const ROWS = [
  ...STROKES.slice(0, 7),
  TEXTS[0],
  ...STROKES.slice(7),
  ...TEXTS.slice(1),
  LAST,
].flatMap((row) => (row === undefined ? [] : [row]));

const idOf = (index: number) => `Fixture${String(index).padStart(15, '0')}` as ElementId;

/** The fixture's elements in drawing order, bottom first. */
export function fixtureElements(): Element[] {
  return keysBetween(null, null, ROWS.length).map((order, index) => {
    const [fields, style] = ROWS[index] ?? [{ kind: 'rectangle' }, {}];
    const base = styleForKind(INITIAL_DEFAULT_STYLE, fields.kind);
    return {
      rotation: 0,
      ...fields,
      id: idOf(index),
      order,
      locked: false,
      rev: 1,
      style: { ...base, ...style },
    } as Element;
  });
}

/** The records that a whole save of the fixture writes, with its camera. */
export function fixtureRecords(id: string) {
  const elements = fixtureElements();
  const document = {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(),
    canvas: { background: toColor(BACKGROUND) },
    rev: 0,
  };
  const session = { camera: FIXTURE_CAMERA, selection: [] };
  const plan = planSave(undefined, {
    type: 'replace',
    id: id as DocumentId,
    baseRev: 0,
    document,
    session,
  });
  if (plan.type !== 'write') throw new Error('A first save of the fixture must write it.');
  return { record: plan.record, elements: plan.put, count: elements.length };
}

/** A call on a 2D context, with a path as its index in the paths list. */
export type ReferenceCall = readonly [string, ...unknown[]];

const ANCHOR = { left: 0, center: 0.5, right: 1 } as const;
const DASHES = { dashed: [4, 4], dotted: [1, 2] } as const;

function paintCalls(element: Element, path: number): ReferenceCall[] {
  const { stroke, fill, opacity } = element.style;
  const calls: ReferenceCall[] = [['globalAlpha=', opacity]];
  if (element.kind === 'freehand' && element.points.length === 1) {
    return [...calls, ['fillStyle=', stroke.color], ['fill', path]];
  }
  const closed = geometryOf(element)?.isClosed(element) === true;
  if (closed && fill !== null) calls.push(['fillStyle=', fill.color], ['fill', path]);
  if (element.kind === 'text') {
    const { font, align } = element.content;
    calls.push(
      ['font=', `${String(font.size)}px ${FONT_STACKS[font.family]}`],
      ['textAlign=', align],
    );
    calls.push(['textBaseline=', 'middle'], ['fillStyle=', stroke.color]);
    const lineHeight = font.size * font.lineHeight;
    element.content.text.split('\n').forEach((line, index) => {
      calls.push(['fillText', line, ANCHOR[align] * element.width, (index + 0.5) * lineHeight]);
    });
    return calls;
  }
  calls.push(['strokeStyle=', stroke.color], ['lineWidth=', stroke.width]);
  if (stroke.dash !== 'solid')
    calls.push(['setLineDash', DASHES[stroke.dash].map((step) => step * stroke.width)]);
  if (!closed) calls.push(['lineCap=', 'round'], ['lineJoin=', 'round']);
  return [...calls, ['stroke', path]];
}

/** The path of an element as calls on a Path2D: a one-point stroke's disc, or its outline. */
function pathCalls(element: Element): ReferenceCall[] {
  if (element.kind === 'freehand' && element.points.length === 1) {
    const [only] = element.points;
    return [['arc', only?.x, only?.y, element.style.stroke.width / 2, 0, 2 * Math.PI]];
  }
  return (geometryOf(element)?.outline(element) ?? []).map((command): ReferenceCall => {
    if (command.op === 'move') return ['moveTo', command.to.x, command.to.y];
    if (command.op === 'line') return ['lineTo', command.to.x, command.to.y];
    if (command.op === 'cubic') {
      return [
        'bezierCurveTo',
        command.c1.x,
        command.c1.y,
        command.c2.x,
        command.c2.y,
        command.to.x,
        command.to.y,
      ];
    }
    return ['closePath'];
  });
}

/**
 * The calls that drew the fixture before issue #34, on a backing store of `size` device pixels at
 * `ratio` device pixels per CSS pixel, with the paths they fill and stroke.
 */
export function referenceCalls(size: { width: number; height: number }, ratio: number) {
  const scale = ratio * FIXTURE_CAMERA.zoom;
  const elements = fixtureElements();
  const calls: ReferenceCall[] = [
    ['setTransform', 1, 0, 0, 1, 0, 0],
    ['clearRect', 0, 0, size.width, size.height],
    ['fillStyle=', BACKGROUND],
    ['fillRect', 0, 0, size.width, size.height],
  ];
  elements.forEach((element, path) => {
    const dx = scale * (element.x - FIXTURE_CAMERA.x);
    const dy = scale * (element.y - FIXTURE_CAMERA.y);
    calls.push(['save'], ['setTransform', scale, 0, 0, scale, dx, dy]);
    if (element.rotation !== 0) {
      const { width, height } = localBox(element);
      calls.push(['translate', width / 2, height / 2], ['rotate', element.rotation]);
      calls.push(['translate', -width / 2, -height / 2]);
    }
    calls.push(...paintCalls(element, path), ['restore']);
  });
  return { calls, paths: elements.map(pathCalls) };
}
