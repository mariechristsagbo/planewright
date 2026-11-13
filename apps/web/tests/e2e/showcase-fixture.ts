import { geometryOf } from '../../../../packages/engine/src/geometry/kinds.ts';
import { toColor } from '../../../../packages/engine/src/model/color.ts';
import {
  DEFAULT_TEXT_FONT,
  INITIAL_DEFAULT_STYLE,
  styleForKind,
} from '../../../../packages/engine/src/model/defaults.ts';
import type {
  Element,
  Point,
  ShapeElement,
} from '../../../../packages/engine/src/model/elements.ts';
import type { ElementId } from '../../../../packages/engine/src/model/ids.ts';
import { keysBetween } from '../../../../packages/engine/src/model/order-key.ts';
import type { FontSpec, Style } from '../../../../packages/engine/src/model/style.ts';
import { planSave } from '../../../../packages/engine/src/persistence/records.ts';
import type { DocumentId } from '../../../../packages/engine/src/persistence/repository.ts';

// The README's showcase (issue #52): one flow diagram drawn with the P0 kinds, a deliberate
// composition rather than a sample of every kind and style. An idea is sketched and refined until a
// decision finds it clear: yes leads to Ready, not yet to Revise, whose feedback line returns to
// Refine. Each label is a left-aligned text as the Text tool makes it, as wide as the editor
// measures it, centred in its node, and each line ends on the outline that its node draws. The
// colours are the fixture's, since the editor has no style controls yet: blue steps, amber for the
// decision and the feedback, green for Ready, and dark neutral lines and words, on the editor's
// white canvas.

export const SHOWCASE_DOCUMENT_ID = 'ReadmeShowcaseDrawing0';

/** A camera: the scene point at the canvas's top left, and the zoom. */
export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** The desktop capture's camera: 100 %, the scene's origin at the canvas's top left. */
export const DESKTOP_CAMERA: Camera = { x: 0, y: 0, zoom: 1 };

/**
 * The landscape phone capture's camera: the whole diagram at 75 %, centred across the window, under
 * the top row's palette and above the bottom safe-area inset, Revise between the bottom islands.
 */
export const LANDSCAPE_CAMERA: Camera = { x: 0, y: 150, zoom: 0.75 };

/** What a node is in the flow, which sets its colours. */
export type Role = 'step' | 'decision' | 'feedback' | 'done';

/** The stroke and fill of each role's nodes; the feedback lines take the amber stroke too. */
export const ROLE_COLOURS: Readonly<Record<Role, { stroke: string; fill: string }>> = {
  step: { stroke: '#2c5f9e', fill: '#dbe8fa' },
  decision: { stroke: '#a35f00', fill: '#fbe7c2' },
  feedback: { stroke: '#a35f00', fill: '#fbe7c2' },
  done: { stroke: '#2b7a3a', fill: '#d9f0dd' },
};

/** The labels' and the flow lines' dark neutral, and the branches' quieter one. */
export const INK = '#1e2430';
export const BRANCH_INK = '#4f4e5b';

/** The nodes' labels are in the default font; the branches' words are smaller. */
export const BRANCH_FONT: FontSpec = { family: 'sans', size: 16, lineHeight: 1.25 };

/** Each word's width as the editor measures it in its font, 20 px or 16 px Planewright Sans. */
export const TEXT_WIDTHS: Readonly<Record<string, number>> = {
  Idea: 40,
  Sketch: 66,
  Refine: 61,
  'Clear?': 61,
  Ready: 59,
  Revise: 64,
  yes: 26,
  'not yet': 52,
};

/** A node: its label, shape, role and box in the scene. */
export interface ShowcaseNode {
  readonly label: string;
  readonly kind: ShapeElement['kind'];
  readonly role: Role;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The main row's centre line. */
const ROW = 380;

const node = (
  label: string,
  [kind, role]: readonly [ShapeElement['kind'], Role],
  [x, y]: readonly [number, number],
  [width, height]: readonly [number, number],
): ShowcaseNode => ({ label, kind, role, x, y, width, height });

/** The main row from Idea to Ready, centred on one line, then Revise under the decision. */
export const NODES: readonly ShowcaseNode[] = [
  node('Idea', ['ellipse', 'step'], [88, ROW - 42], [136, 84]),
  node('Sketch', ['rectangle', 'step'], [280, ROW - 40], [136, 80]),
  node('Refine', ['rectangle', 'step'], [472, ROW - 40], [136, 80]),
  node('Clear?', ['diamond', 'decision'], [664, ROW - 60], [160, 120]),
  node('Ready', ['rectangle', 'done'], [900, ROW - 40], [136, 80]),
  node('Revise', ['rectangle', 'feedback'], [676, ROW + 156], [136, 80]),
];

/** The side of a node that a connection leaves or reaches. */
export type Side = 'left' | 'right' | 'top' | 'bottom';

/** A connection: the nodes it joins, the sides it meets and the corners it turns at between. */
export interface Connection {
  readonly from: string;
  readonly fromSide: Side;
  readonly to: string;
  readonly toSide: Side;
  readonly via: readonly Point[];
  readonly feedback: boolean;
}

const flow = (from: string, to: string): Connection => ({
  from,
  fromSide: 'right',
  to,
  toSide: 'left',
  via: [],
  feedback: false,
});

export const CONNECTIONS: readonly Connection[] = [
  flow('Idea', 'Sketch'),
  flow('Sketch', 'Refine'),
  flow('Refine', 'Clear?'),
  flow('Clear?', 'Ready'),
  { from: 'Clear?', fromSide: 'bottom', to: 'Revise', toSide: 'top', via: [], feedback: true },
  {
    from: 'Revise',
    fromSide: 'left',
    to: 'Refine',
    toSide: 'bottom',
    via: [{ x: 540, y: ROW + 196 }],
    feedback: true,
  },
];

/** A branch's word beside its line: the connection it names and its text's top left. */
export interface BranchLabel {
  readonly text: string;
  readonly from: string;
  readonly to: string;
  readonly x: number;
  readonly y: number;
}

export const BRANCH_LABELS: readonly BranchLabel[] = [
  { text: 'yes', from: 'Clear?', to: 'Ready', x: 846, y: ROW - 28 },
  { text: 'not yet', from: 'Clear?', to: 'Revise', x: 756, y: ROW + 96 },
];

export function nodeNamed(label: string): ShowcaseNode {
  const found = NODES.find((each) => each.label === label);
  if (found === undefined) throw new Error(`The showcase has no node "${label}".`);
  return found;
}

/** An element as the fixture drafts it, before its id and order. */
type Draft<E extends Element = Element> = E extends Element ? Omit<E, 'id' | 'order'> : never;

const COMMON = { rotation: 0, locked: false, rev: 1 } as const;

function nodeStyle({ kind, role }: ShowcaseNode): Style {
  const { stroke, fill } = ROLE_COLOURS[role];
  const base = styleForKind(INITIAL_DEFAULT_STYLE, kind);
  return {
    ...base,
    stroke: { ...base.stroke, color: toColor(stroke) },
    fill: { color: toColor(fill), pattern: 'solid' },
  };
}

/** A node's shape, as an element without its id and order. */
export const shapeOf = (each: ShowcaseNode): Draft<ShapeElement> => ({
  ...COMMON,
  kind: each.kind,
  x: each.x,
  y: each.y,
  width: each.width,
  height: each.height,
  style: nodeStyle(each),
});

/** A shape's drawn outline as a closed polygon in the scene, each cubic in 32 straight steps. */
export function outlinePolygon(shape: Draft<ShapeElement>): Point[] {
  const element = { ...shape, id: '', order: '' } as unknown as ShapeElement;
  const points: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  for (const command of geometryOf(element)?.outline(element) ?? []) {
    if (command.op === 'close') continue;
    if (command.op === 'cubic') {
      const { c1, c2, to } = command;
      for (let step = 1; step < 32; step += 1) {
        const t = step / 32;
        const [a, b, c, d] = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3];
        const x = a * at.x + b * c1.x + c * c2.x + d * to.x;
        points.push({ x, y: a * at.y + b * c1.y + c * c2.y + d * to.y });
      }
    }
    at = command.to;
    points.push(at);
  }
  return points.map(({ x, y }) => ({ x: x + shape.x, y: y + shape.y }));
}

/** Where a node's drawn outline meets the line from its centre toward one side. */
export function anchorOf(each: ShowcaseNode, side: Side): Point {
  const polygon = outlinePolygon(shapeOf(each));
  const centre = { x: each.x + each.width / 2, y: each.y + each.height / 2 };
  const along = side === 'left' || side === 'right' ? 'x' : 'y';
  const across = along === 'x' ? 'y' : 'x';
  const sign = side === 'right' || side === 'bottom' ? 1 : -1;
  const hits = polygon.flatMap((p, index) => {
    const q = polygon[(index + 1) % polygon.length] ?? p;
    const [dp, dq] = [p[across] - centre[across], q[across] - centre[across]];
    if (dp * dq > 0 || dp === dq) return [];
    return [sign * (p[along] + ((q[along] - p[along]) * dp) / (dp - dq))];
  });
  const reach = sign * Math.max(...hits);
  return along === 'x' ? { x: reach, y: centre.y } : { x: centre.x, y: reach };
}

/** A connection's points in the scene, from its first node's side to its last node's. */
export const pathOf = (connection: Connection): Point[] => [
  anchorOf(nodeNamed(connection.from), connection.fromSide),
  ...connection.via,
  anchorOf(nodeNamed(connection.to), connection.toSide),
];

function textOf(text: string, [x, y]: readonly [number, number], font: FontSpec): Draft {
  const base = styleForKind(INITIAL_DEFAULT_STYLE, 'text');
  const colour = toColor(font === BRANCH_FONT ? BRANCH_INK : INK);
  return {
    ...COMMON,
    kind: 'text',
    x,
    y,
    width: TEXT_WIDTHS[text] ?? 0,
    height: font.size * font.lineHeight,
    content: { text, font, align: 'left' },
    style: { ...base, stroke: { ...base.stroke, color: colour } },
  };
}

function lineOf(connection: Connection): Draft {
  const scene = pathOf(connection);
  const [left, top] = [Math.min(...scene.map((p) => p.x)), Math.min(...scene.map((p) => p.y))];
  const base = styleForKind(INITIAL_DEFAULT_STYLE, 'line');
  const { feedback } = connection;
  return {
    ...COMMON,
    kind: 'line',
    x: left,
    y: top,
    points: scene.map((p) => ({ x: p.x - left, y: p.y - top })),
    style: {
      ...base,
      stroke: {
        ...base.stroke,
        color: toColor(feedback ? ROLE_COLOURS.feedback.stroke : INK),
        dash: feedback ? 'dashed' : 'solid',
      },
    },
  };
}

/** Where a node's label goes: a text in the default font whose box is centred in the node's box. */
export function labelOrigin(each: ShowcaseNode): [number, number] {
  const width = TEXT_WIDTHS[each.label] ?? 0;
  const height = DEFAULT_TEXT_FONT.size * DEFAULT_TEXT_FONT.lineHeight;
  return [each.x + (each.width - width) / 2, each.y + (each.height - height) / 2];
}

const idOf = (index: number) => `Showcase${String(index).padStart(14, '0')}` as ElementId;

/**
 * The showcase's elements in drawing order, bottom first: the lines under the nodes, so that each
 * node's outline covers its lines' ends, then the branches' words, then each node and its label,
 * the flow's last node first, so that the Elements list, topmost first, reads the flow from Idea.
 */
export function showcaseElements(): Element[] {
  const drafts: Draft[] = [
    ...CONNECTIONS.map(lineOf),
    ...BRANCH_LABELS.map(({ text, x, y }) => textOf(text, [x, y], BRANCH_FONT)),
    ...[...NODES]
      .reverse()
      .flatMap((each) => [shapeOf(each), textOf(each.label, labelOrigin(each), DEFAULT_TEXT_FONT)]),
  ];
  return keysBetween(null, null, drafts.length).map(
    (order, index) => ({ ...drafts[index], id: idOf(index), order }) as Element,
  );
}

/** The records that a whole save of the showcase writes, under a camera, on a white canvas. */
export function showcaseRecords(camera: Camera) {
  const elements = showcaseElements();
  const document = {
    elements: new Map(elements.map((element) => [element.id, element])),
    groups: new Map(),
    canvas: { background: toColor('#ffffff') },
    rev: 0,
  };
  const plan = planSave(undefined, {
    type: 'replace',
    id: SHOWCASE_DOCUMENT_ID as DocumentId,
    baseRev: 0,
    document,
    session: { camera, selection: [] },
  });
  if (plan.type !== 'write') throw new Error('A first save of the showcase must write it.');
  return { record: plan.record, elements: plan.put, count: elements.length };
}
