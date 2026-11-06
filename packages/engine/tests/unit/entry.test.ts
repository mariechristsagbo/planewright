import { describe, expect, expectTypeOf, it } from 'vitest';

import * as engine from '../../src/index.ts';
import type * as Engine from '../../src/index.ts';
import type * as Codec from '../../src/model/codec.ts';
import type * as Color from '../../src/model/color.ts';
import type * as Document from '../../src/model/document.ts';
import type * as Elements from '../../src/model/elements.ts';
import type * as Ids from '../../src/model/ids.ts';
import type * as Keys from '../../src/model/order-key.ts';
import type * as Styles from '../../src/model/style.ts';

describe('the engine entry point', () => {
  it('exports no run-time value: the layers stay internal until the editor exists', () => {
    expect(Object.keys(engine)).toEqual([]);
  });

  it("exports the domain model's types", () => {
    expectTypeOf<Engine.ElementId>().toEqualTypeOf<Ids.ElementId>();
    expectTypeOf<Engine.GroupId>().toEqualTypeOf<Ids.GroupId>();
    expectTypeOf<Engine.ClientId>().toEqualTypeOf<Ids.ClientId>();
    expectTypeOf<Engine.FileId>().toEqualTypeOf<Ids.FileId>();
    expectTypeOf<Engine.OrderKey>().toEqualTypeOf<Keys.OrderKey>();
    expectTypeOf<Engine.Color>().toEqualTypeOf<Color.Color>();
    expectTypeOf<Engine.Point>().toEqualTypeOf<Elements.Point>();
    expectTypeOf<Engine.Box>().toEqualTypeOf<Elements.Box>();
    expectTypeOf<Engine.Stroke>().toEqualTypeOf<Styles.Stroke>();
    expectTypeOf<Engine.Fill>().toEqualTypeOf<Styles.Fill>();
    expectTypeOf<Engine.Style>().toEqualTypeOf<Styles.Style>();
    expectTypeOf<Engine.FontFamily>().toEqualTypeOf<Styles.FontFamily>();
    expectTypeOf<Engine.FontSpec>().toEqualTypeOf<Styles.FontSpec>();
    expectTypeOf<Engine.TextBlock>().toEqualTypeOf<Styles.TextBlock>();
    expectTypeOf<Engine.Element>().toEqualTypeOf<Elements.Element>();
    expectTypeOf<Engine.ElementKind>().toEqualTypeOf<Elements.ElementKind>();
    expectTypeOf<Engine.ShapeElement>().toEqualTypeOf<Elements.ShapeElement>();
    expectTypeOf<Engine.LineElement>().toEqualTypeOf<Elements.LineElement>();
    expectTypeOf<Engine.FreehandElement>().toEqualTypeOf<Elements.FreehandElement>();
    expectTypeOf<Engine.TextElement>().toEqualTypeOf<Elements.TextElement>();
    expectTypeOf<Engine.ArrowElement>().toEqualTypeOf<Elements.ArrowElement>();
    expectTypeOf<Engine.ArrowHead>().toEqualTypeOf<Elements.ArrowHead>();
    expectTypeOf<Engine.Attachment>().toEqualTypeOf<Elements.Attachment>();
    expectTypeOf<Engine.NoteElement>().toEqualTypeOf<Elements.NoteElement>();
    expectTypeOf<Engine.ImageElement>().toEqualTypeOf<Elements.ImageElement>();
    expectTypeOf<Engine.FrameElement>().toEqualTypeOf<Elements.FrameElement>();
    expectTypeOf<Engine.GroupRecord>().toEqualTypeOf<Document.GroupRecord>();
    expectTypeOf<Engine.CanvasState>().toEqualTypeOf<Document.CanvasState>();
    expectTypeOf<Engine.DocumentState>().toEqualTypeOf<Document.DocumentState>();
    expectTypeOf<Engine.CodecError>().toEqualTypeOf<Codec.CodecError>();
    expectTypeOf<Engine.CodecProblem>().toEqualTypeOf<Codec.CodecProblem>();
    expectTypeOf<Engine.Decoded<number>>().toEqualTypeOf<Codec.Decoded<number>>();
  });
});
