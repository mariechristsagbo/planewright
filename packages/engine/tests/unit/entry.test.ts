import { describe, expect, expectTypeOf, it } from 'vitest';

import * as engine from '../../src/index.ts';
import type * as Engine from '../../src/index.ts';
import type * as Codec from '../../src/model/codec.ts';
import type * as Color from '../../src/model/color.ts';
import type * as Document from '../../src/model/document.ts';
import type * as Elements from '../../src/model/elements.ts';
import type * as Ids from '../../src/model/ids.ts';
import type * as Keys from '../../src/model/order-key.ts';
import type * as Patch from '../../src/model/patch.ts';
import type * as Styles from '../../src/model/style.ts';
import type * as Changes from '../../src/scene/change-set.ts';
import type * as Check from '../../src/scene/check.ts';
import type * as Store from '../../src/scene/store.ts';
import type * as Transaction from '../../src/scene/transaction.ts';

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

  it("exports the scene's change sets, store and transaction types", () => {
    expectTypeOf<Engine.ElementPatch>().toEqualTypeOf<Patch.ElementPatch>();
    expectTypeOf<Engine.ChangeOrigin>().toEqualTypeOf<Changes.ChangeOrigin>();
    expectTypeOf<Engine.ElementChange>().toEqualTypeOf<Changes.ElementChange>();
    expectTypeOf<Engine.GroupChange>().toEqualTypeOf<Changes.GroupChange>();
    expectTypeOf<Engine.CanvasChange>().toEqualTypeOf<Changes.CanvasChange>();
    expectTypeOf<Engine.ChangeStamp>().toEqualTypeOf<Changes.ChangeStamp>();
    expectTypeOf<Engine.ChangeSet>().toEqualTypeOf<Changes.ChangeSet>();
    expectTypeOf<Engine.ChangeError>().toEqualTypeOf<Check.ChangeError>();
    expectTypeOf<Engine.ChangeProblem>().toEqualTypeOf<Check.ChangeProblem>();
    expectTypeOf<Engine.SceneUpdate>().toEqualTypeOf<Store.SceneUpdate>();
    expectTypeOf<Engine.SceneReader>().toEqualTypeOf<Store.SceneReader>();
    expectTypeOf<Engine.ApplyOptions>().toEqualTypeOf<Store.ApplyOptions>();
    expectTypeOf<Engine.SceneStore>().toEqualTypeOf<Store.SceneStore>();
    expectTypeOf<Engine.SceneTransaction>().toEqualTypeOf<Transaction.SceneTransaction>();
  });
});
