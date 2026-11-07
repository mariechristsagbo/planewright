import type {
  ArrowElement,
  Color,
  ElementId,
  FreehandElement,
  LineElement,
  OrderKey,
  Point,
  ShapeElement,
  Style,
  TextBlock,
  TextElement,
} from '@planewright/engine';

// Fixture elements for the renderer's tests: sharp-cornered, unfilled and fully opaque with the
// default 2-unit stroke unless a test says otherwise.

export const color = (text: string): Color => text as Color;

export const id = (index: number): ElementId => `R${String(index).padStart(21, '0')}` as ElementId;

export const STYLE: Style = {
  stroke: { color: color('#1e2430'), width: 2, dash: 'solid' },
  fill: null,
  opacity: 1,
  corners: 'sharp',
  sketch: 0,
};

export interface Placement {
  readonly id?: number;
  readonly x?: number;
  readonly y?: number;
  readonly rotation?: number;
  readonly rev?: number;
  readonly style?: Partial<Style>;
}

const common = (placement: Placement) => ({
  id: id(placement.id ?? 1),
  order: 'V' as OrderKey,
  x: placement.x ?? 0,
  y: placement.y ?? 0,
  rotation: placement.rotation ?? 0,
  style: { ...STYLE, ...placement.style },
  locked: false,
  rev: placement.rev ?? 1,
});

export const shape = (
  kind: ShapeElement['kind'],
  size: { readonly width: number; readonly height: number },
  placement: Placement = {},
): ShapeElement => ({ ...common(placement), kind, ...size });

export const line = (points: readonly Point[], placement: Placement = {}): LineElement => ({
  ...common(placement),
  kind: 'line',
  points,
});

export const freehand = (points: readonly Point[], placement: Placement = {}): FreehandElement => ({
  ...common(placement),
  kind: 'freehand',
  points,
});

export const text = (
  content: Partial<TextBlock> & { readonly text: string },
  placement: Placement = {},
): TextElement => ({
  ...common(placement),
  kind: 'text',
  width: 100,
  height: 50,
  content: { font: { family: 'sans', size: 20, lineHeight: 1.25 }, align: 'left', ...content },
});

export const arrow = (placement: Placement = {}): ArrowElement => ({
  ...common(placement),
  kind: 'arrow',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ],
  heads: { start: 'none', end: 'arrow' },
  route: 'straight',
});
