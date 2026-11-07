import { INITIAL_DEFAULT_STYLE } from '../../src/model/defaults.ts';
import type { Color } from '../../src/model/color.ts';
import type { ShapeElement, TextElement } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { OrderKey } from '../../src/model/order-key.ts';
import type { Fill, Style } from '../../src/model/style.ts';

// Single elements for the geometry and selection tests, sharp-cornered and unfilled unless a test
// says otherwise, with the default 2-unit stroke.

export interface Placement {
  /** Makes the identifier `H` followed by the number in 21 digits; 0 by default. */
  readonly id?: number;
  readonly order?: string;
  readonly x?: number;
  readonly y?: number;
  readonly rotation?: number;
  readonly style?: Partial<Style>;
}

export const SOLID: Fill = { color: '#ffd8a8' as Color, pattern: 'solid' };

export const testId = (index: number): ElementId =>
  `H${String(index).padStart(21, '0')}` as ElementId;

const common = (placement: Placement) => ({
  id: testId(placement.id ?? 0),
  order: (placement.order ?? 'V') as OrderKey,
  x: placement.x ?? 0,
  y: placement.y ?? 0,
  rotation: placement.rotation ?? 0,
  style: { ...INITIAL_DEFAULT_STYLE, corners: 'sharp' as const, ...placement.style },
  locked: false,
  rev: 1,
});

export const shapeElement = (
  kind: ShapeElement['kind'],
  width: number,
  height: number,
  placement: Placement = {},
): ShapeElement => ({ ...common(placement), kind, width, height });

export const textElement = (
  width: number,
  height: number,
  placement: Placement = {},
): TextElement => ({
  ...common(placement),
  kind: 'text',
  width,
  height,
  content: { text: 'Hi', font: { family: 'sans', size: 20, lineHeight: 1.25 }, align: 'left' },
});
