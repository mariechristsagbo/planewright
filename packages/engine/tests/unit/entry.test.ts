import { describe, expect, expectTypeOf, it } from 'vitest';

import type * as Cameras from '../../src/camera/camera.ts';
import type * as Viewports from '../../src/camera/viewport.ts';
import type * as Chords from '../../src/commands/chords.ts';
import type * as Commands from '../../src/commands/registry.ts';
import * as editors from '../../src/editor/editor.ts';
import type * as Editors from '../../src/editor/editor.ts';
import type * as RenderStates from '../../src/editor/frame.ts';
import type * as RenderFrames from '../../src/editor/render-frame.ts';
import * as renderLoops from '../../src/editor/render-loop.ts';
import type * as RenderLoops from '../../src/editor/render-loop.ts';
import * as kinds from '../../src/geometry/kinds.ts';
import type * as Paths from '../../src/geometry/path.ts';
import * as layouts from '../../src/geometry/text-layout.ts';
import type * as Layouts from '../../src/geometry/text-layout.ts';
import type * as Measurers from '../../src/geometry/text-measurer.ts';
import * as bounds from '../../src/geometry/world-bounds.ts';
import type * as Entries from '../../src/history/entry.ts';
import type * as Histories from '../../src/history/history.ts';
import type * as Transactions from '../../src/history/transaction.ts';
import type * as Inputs from '../../src/input/events.ts';
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
import type * as Frames from '../../src/selection/frame.ts';
import type * as Handles from '../../src/selection/handles.ts';
import type * as Hits from '../../src/selection/hit-test.ts';
import type * as Pointers from '../../src/selection/pointer.ts';
import type * as Selections from '../../src/selection/selection.ts';
import type * as Tools from '../../src/tools/tool.ts';

describe('the engine entry point', () => {
  it('exports as values only the editor, the render loop and the geometry a renderer draws with', () => {
    expect(Object.keys(engine).sort()).toEqual([
      'createEditor',
      'createRenderLoop',
      'geometryOf',
      'layoutText',
      'localBox',
    ]);
    expect(engine.createEditor).toBe(editors.createEditor);
    expect(engine.createRenderLoop).toBe(renderLoops.createRenderLoop);
    expect(engine.geometryOf).toBe(kinds.geometryOf);
    expect(engine.layoutText).toBe(layouts.layoutText);
    expect(engine.localBox).toBe(bounds.localBox);
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

  it("exports the history's entries, history and transaction types", () => {
    expectTypeOf<Engine.HistoryLabel>().toEqualTypeOf<Entries.HistoryLabel>();
    expectTypeOf<Engine.HistoryEntry>().toEqualTypeOf<Entries.HistoryEntry>();
    expectTypeOf<Engine.HistorySelection>().toEqualTypeOf<Entries.HistorySelection>();
    expectTypeOf<Engine.History>().toEqualTypeOf<Histories.History>();
    expectTypeOf<Engine.HistoryLimits>().toEqualTypeOf<Histories.HistoryLimits>();
    expectTypeOf<Engine.Transaction>().toEqualTypeOf<Transactions.Transaction>();
    expectTypeOf<Engine.CommitOptions>().toEqualTypeOf<Transactions.CommitOptions>();
  });

  it("exports the camera's types", () => {
    expectTypeOf<Engine.Camera>().toEqualTypeOf<Cameras.Camera>();
    expectTypeOf<Engine.ViewportSize>().toEqualTypeOf<Viewports.ViewportSize>();
  });

  it("exports the geometry's outlines, the text measurer port and the text layout's types", () => {
    expectTypeOf<Engine.PathCommand>().toEqualTypeOf<Paths.PathCommand>();
    expectTypeOf<Engine.TextMeasurer>().toEqualTypeOf<Measurers.TextMeasurer>();
    expectTypeOf<Engine.TextMetrics>().toEqualTypeOf<Measurers.TextMetrics>();
    expectTypeOf<Engine.TextLayout>().toEqualTypeOf<Layouts.TextLayout>();
    expectTypeOf<Engine.TextLine>().toEqualTypeOf<Layouts.TextLine>();
  });

  it("exports the selection's, hit testing's and handles' types", () => {
    expectTypeOf<Engine.Selection>().toEqualTypeOf<Selections.Selection>();
    expectTypeOf<Engine.PointerKind>().toEqualTypeOf<Pointers.PointerKind>();
    expectTypeOf<Engine.HitResult>().toEqualTypeOf<Hits.HitResult>();
    expectTypeOf<Engine.HitView>().toEqualTypeOf<Hits.HitView>();
    expectTypeOf<Engine.HandleId>().toEqualTypeOf<Handles.HandleId>();
    expectTypeOf<Engine.Handle>().toEqualTypeOf<Handles.Handle>();
    expectTypeOf<Engine.SelectionFrame>().toEqualTypeOf<Frames.SelectionFrame>();
  });

  it("exports the render frame's, the renderer port's and the render loop's types", () => {
    expectTypeOf<Engine.KindGeometry<Engine.Element>>().toEqualTypeOf<
      Paths.KindGeometry<Elements.Element>
    >();
    expectTypeOf<Engine.OverlayPrimitive>().toEqualTypeOf<RenderFrames.OverlayPrimitive>();
    expectTypeOf<Engine.Theme>().toEqualTypeOf<RenderFrames.Theme>();
    expectTypeOf<Engine.RenderFrame>().toEqualTypeOf<RenderFrames.RenderFrame>();
    expectTypeOf<Engine.Renderer>().toEqualTypeOf<RenderFrames.Renderer>();
    expectTypeOf<Engine.RenderState>().toEqualTypeOf<RenderStates.RenderState>();
    expectTypeOf<Engine.RenderLoop>().toEqualTypeOf<RenderLoops.RenderLoop>();
  });

  it("exports the editor's, its input events' and its commands' types", () => {
    expectTypeOf<Engine.Editor>().toEqualTypeOf<Editors.Editor>();
    expectTypeOf<Engine.EditorCommand>().toEqualTypeOf<Editors.EditorCommand>();
    expectTypeOf<Engine.EditorPorts>().toEqualTypeOf<Editors.EditorPorts>();
    expectTypeOf<Engine.EditorView>().toEqualTypeOf<Editors.EditorView>();
    expectTypeOf<Engine.TextEdit>().toEqualTypeOf<Editors.TextEdit>();
    expectTypeOf<Engine.TextEditView>().toEqualTypeOf<Editors.TextEditView>();
    expectTypeOf<Engine.InputEvent>().toEqualTypeOf<Inputs.InputEvent>();
    expectTypeOf<Engine.PointerInput>().toEqualTypeOf<Inputs.PointerInput>();
    expectTypeOf<Engine.WheelInput>().toEqualTypeOf<Inputs.WheelInput>();
    expectTypeOf<Engine.KeyInput>().toEqualTypeOf<Inputs.KeyInput>();
    expectTypeOf<Engine.FocusLost>().toEqualTypeOf<Inputs.FocusLost>();
    expectTypeOf<Engine.Modifiers>().toEqualTypeOf<Inputs.Modifiers>();
    expectTypeOf<Engine.PointerButton>().toEqualTypeOf<Inputs.PointerButton>();
    expectTypeOf<Engine.KeyChord>().toEqualTypeOf<Chords.KeyChord>();
    expectTypeOf<Engine.CommandId>().toEqualTypeOf<Commands.CommandId>();
    expectTypeOf<Engine.CommandOutcome>().toEqualTypeOf<Commands.CommandOutcome>();
    expectTypeOf<Engine.ToolId>().toEqualTypeOf<Tools.ToolId>();
    expectTypeOf<Engine.CursorKind>().toEqualTypeOf<Tools.CursorKind>();
  });
});
