import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Aabb } from '../../../src/math/aabb.ts';
import type { Vec } from '../../../src/math/vector.ts';
import type { Color } from '../../../src/model/color.ts';
import type { CanvasState, DocumentState, GroupRecord } from '../../../src/model/document.ts';
import { ARROW_HEADS, ARROW_ROUTES, ELEMENT_KINDS } from '../../../src/model/elements.ts';
import type {
  ArrowElement,
  ArrowHead,
  Attachment,
  Box,
  Element,
  ElementKind,
  FrameElement,
  FreehandElement,
  ImageElement,
  LineElement,
  NoteElement,
  Point,
  ShapeElement,
  TextElement,
} from '../../../src/model/elements.ts';
import type { ClientId, ElementId, FileId, GroupId } from '../../../src/model/ids.ts';
import type { OrderKey } from '../../../src/model/order-key.ts';
import {
  CORNERS,
  FILL_PATTERNS,
  FONT_FAMILIES,
  SKETCH_LEVELS,
  STROKE_DASHES,
  TEXT_ALIGNS,
} from '../../../src/model/style.ts';
import type { Fill, FontSpec, Stroke, Style, TextBlock } from '../../../src/model/style.ts';

type Common =
  'id' | 'order' | 'x' | 'y' | 'rotation' | 'style' | 'locked' | 'group' | 'link' | 'rev' | 'kind';

describe('the primitive types', () => {
  it('reuse the math layer for points and boxes', () => {
    expectTypeOf<Point>().toEqualTypeOf<Vec>();
    expectTypeOf<Box>().toEqualTypeOf<Aabb>();
  });

  it('brand every identifier, key and colour', () => {
    expectTypeOf<ShapeElement['id']>().toEqualTypeOf<ElementId>();
    expectTypeOf<ShapeElement['order']>().toEqualTypeOf<OrderKey>();
    expectTypeOf<Attachment['target']>().toEqualTypeOf<ElementId>();
    expectTypeOf<GroupRecord['parent']>().toEqualTypeOf<GroupId | undefined>();
    expectTypeOf<ImageElement['file']>().toEqualTypeOf<FileId>();
    expectTypeOf<CanvasState['background']>().toEqualTypeOf<Color>();
    expectTypeOf<ClientId>().not.toEqualTypeOf<ElementId>();
  });
});

describe('the style types', () => {
  it('have the fields and values of the domain model', () => {
    expectTypeOf<keyof Stroke>().toEqualTypeOf<'color' | 'width' | 'dash'>();
    expectTypeOf<Stroke['dash']>().toEqualTypeOf<'solid' | 'dashed' | 'dotted'>();
    expectTypeOf<Fill['pattern']>().toEqualTypeOf<'solid' | 'hatch' | 'crosshatch'>();
    expectTypeOf<keyof Style>().toEqualTypeOf<
      'stroke' | 'fill' | 'opacity' | 'corners' | 'sketch'
    >();
    expectTypeOf<Style['fill']>().toEqualTypeOf<Fill | null>();
    expectTypeOf<Style['corners']>().toEqualTypeOf<'sharp' | 'round'>();
    expectTypeOf<Style['sketch']>().toEqualTypeOf<0 | 1 | 2>();
    expectTypeOf<FontSpec['family']>().toEqualTypeOf<'sans' | 'hand' | 'mono'>();
    expectTypeOf<keyof FontSpec>().toEqualTypeOf<'family' | 'size' | 'lineHeight'>();
    expectTypeOf<keyof TextBlock>().toEqualTypeOf<'text' | 'font' | 'align'>();
    expectTypeOf<TextBlock['align']>().toEqualTypeOf<'left' | 'center' | 'right'>();
  });

  it('list every allowed value once, for the codec', () => {
    expect(STROKE_DASHES).toEqual(['solid', 'dashed', 'dotted']);
    expect(FILL_PATTERNS).toEqual(['solid', 'hatch', 'crosshatch']);
    expect(CORNERS).toEqual(['sharp', 'round']);
    expect(SKETCH_LEVELS).toEqual([0, 1, 2]);
    expect(FONT_FAMILIES).toEqual(['sans', 'hand', 'mono']);
    expect(TEXT_ALIGNS).toEqual(['left', 'center', 'right']);
  });
});

describe('the element types', () => {
  it('have the fields of the domain model, kind by kind', () => {
    expectTypeOf<keyof ShapeElement>().toEqualTypeOf<Common | 'width' | 'height' | 'label'>();
    expectTypeOf<keyof LineElement>().toEqualTypeOf<Common | 'points'>();
    expectTypeOf<keyof FreehandElement>().toEqualTypeOf<Common | 'points' | 'pressures'>();
    expectTypeOf<keyof TextElement>().toEqualTypeOf<Common | 'width' | 'height' | 'content'>();
    expectTypeOf<keyof ArrowElement>().toEqualTypeOf<
      Common | 'points' | 'start' | 'end' | 'heads' | 'route' | 'label'
    >();
    expectTypeOf<keyof NoteElement>().toEqualTypeOf<Common | 'width' | 'height' | 'label'>();
    expectTypeOf<keyof ImageElement>().toEqualTypeOf<
      Common | 'width' | 'height' | 'file' | 'crop'
    >();
    expectTypeOf<keyof FrameElement>().toEqualTypeOf<Common | 'width' | 'height' | 'name'>();
  });

  it('keep the optional fields optional and the others required', () => {
    expectTypeOf<ShapeElement['group']>().toEqualTypeOf<GroupId | undefined>();
    expectTypeOf<ShapeElement['link']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<ShapeElement['label']>().toEqualTypeOf<TextBlock | undefined>();
    expectTypeOf<NoteElement['label']>().toEqualTypeOf<TextBlock>();
    expectTypeOf<FreehandElement['pressures']>().toEqualTypeOf<readonly number[] | undefined>();
    expectTypeOf<ArrowElement['start']>().toEqualTypeOf<Attachment | undefined>();
    expectTypeOf<ImageElement['crop']>().toEqualTypeOf<Box | undefined>();
    expectTypeOf<LineElement['points']>().toEqualTypeOf<readonly Point[]>();
    expectTypeOf<ShapeElement['locked']>().toEqualTypeOf<boolean>();
    expectTypeOf<ShapeElement['rev']>().toEqualTypeOf<number>();
  });

  it('have the kinds, heads and routes of the domain model', () => {
    expect(ELEMENT_KINDS).toEqual([
      'rectangle',
      'ellipse',
      'diamond',
      'line',
      'freehand',
      'text',
      'arrow',
      'note',
      'image',
      'frame',
    ]);
    expectTypeOf<ElementKind>().toEqualTypeOf<(typeof ELEMENT_KINDS)[number]>();
    expectTypeOf<Element['kind']>().toEqualTypeOf<ElementKind>();
    expectTypeOf<ShapeElement['kind']>().toEqualTypeOf<'rectangle' | 'ellipse' | 'diamond'>();
    expect(ARROW_HEADS).toEqual(['none', 'arrow', 'triangle', 'dot', 'bar']);
    expectTypeOf<ArrowHead>().toEqualTypeOf<(typeof ARROW_HEADS)[number]>();
    expect(ARROW_ROUTES).toEqual(['straight', 'curved', 'elbow']);
    expectTypeOf<ArrowElement['route']>().toEqualTypeOf<(typeof ARROW_ROUTES)[number]>();
  });

  it('narrow by kind', () => {
    expectTypeOf<Extract<Element, { kind: 'freehand' }>>().toEqualTypeOf<FreehandElement>();
    const narrowed = (element: Element): void => {
      if (element.kind === 'ellipse') {
        expectTypeOf(element).toEqualTypeOf<ShapeElement>();
      }
    };
    expectTypeOf(narrowed).toBeFunction();
  });
});

describe('the document types', () => {
  it('hold elements and groups in maps keyed by identifier', () => {
    expectTypeOf<DocumentState['elements']>().toEqualTypeOf<ReadonlyMap<ElementId, Element>>();
    expectTypeOf<DocumentState['groups']>().toEqualTypeOf<ReadonlyMap<GroupId, GroupRecord>>();
    expectTypeOf<keyof DocumentState>().toEqualTypeOf<'elements' | 'groups' | 'canvas' | 'rev'>();
    expectTypeOf<keyof GroupRecord>().toEqualTypeOf<'id' | 'parent'>();
  });
});
