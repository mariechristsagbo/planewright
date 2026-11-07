import { describe, expect, it } from 'vitest';

import type { ElementId } from '../../../src/model/ids.ts';
import { selectionTool } from '../../../src/tools/selection-tool.ts';
import type { SelectionToolState } from '../../../src/tools/selection-tool.ts';
import type { GestureEvent, ToolEffect } from '../../../src/tools/tool.ts';
import { sceneOf } from '../../support/elements.ts';
import { ELLIPSE, LINE, RECTANGLE, selectionElements } from '../../support/selection-scene.ts';
import { toolContext } from '../../support/tool-contexts.ts';

// The Selection tool's transform gestures (docs/architecture/engine/interaction.md#transforms),
// over the selection fixture at zoom 1: each drag previews the whole result from the press, and
// its release commits one undo step (REQ-T11).

const NONE = { shift: false, alt: false, mod: false };

const at = (type: 'press' | 'drag-start' | 'drag' | 'release', x: number, y: number, keys = NONE) =>
  ({ type, at: { x, y }, scene: { x, y }, pointer: 'mouse', modifiers: keys }) as const;

/** The tool's effects for some gestures; the scene is not changed, as the editor's previews would. */
function effectsOf(events: readonly GestureEvent[], selected: readonly ElementId[]) {
  const scene = sceneOf(...selectionElements());
  let state: SelectionToolState = selectionTool.initial;
  let selection = selected;
  const effects: ToolEffect[] = [];
  for (const event of events) {
    const step = selectionTool.reduce(state, event, toolContext(scene, selection));
    state = step.state;
    effects.push(...step.effects);
    for (const effect of step.effects) if (effect.type === 'select') selection = effect.ids;
  }
  return { effects, state };
}

const update = (id: ElementId, before: object, after: object) => ({
  type: 'update',
  id,
  before,
  after,
});

const preview = (...elements: readonly object[]) => ({
  type: 'preview',
  changes: { elements, groups: [] },
});

describe('the Selection tool: moving', () => {
  it('REQ-T01 REQ-T11 moves the selection by the pointer delta from the press and commits one move', () => {
    const drag = [at('press', 200, 150), at('drag-start', 210, 160), at('drag', 240, 190)];
    expect(effectsOf([...drag, at('release', 240, 190)], [RECTANGLE, ELLIPSE])).toEqual({
      effects: [
        preview(
          update(RECTANGLE, { x: 100, y: 100 }, { x: 110, y: 110 }),
          update(ELLIPSE, { x: 400, y: 100 }, { x: 410, y: 110 }),
        ),
        preview(
          update(RECTANGLE, { x: 100, y: 100 }, { x: 140, y: 140 }),
          update(ELLIPSE, { x: 400, y: 100 }, { x: 440, y: 140 }),
        ),
        { type: 'commit', label: 'move' },
      ],
      state: { type: 'idle' },
    });
  });

  it('REQ-T01 selects an unselected element on its press, then moves it', () => {
    const drag = [at('press', 200, 150), at('drag-start', 230, 150), at('release', 230, 150)];
    expect(effectsOf(drag, [ELLIPSE]).effects).toEqual([
      { type: 'select', ids: [RECTANGLE] },
      preview(update(RECTANGLE, { x: 100 }, { x: 130 })),
      { type: 'commit', label: 'move' },
    ]);
  });

  it('REQ-T01 moves the selection from inside the selection box on no element', () => {
    const drag = [at('press', 350, 150), at('drag-start', 350, 170)];
    expect(effectsOf(drag, [RECTANGLE, ELLIPSE]).effects).toEqual([
      preview(update(RECTANGLE, { y: 100 }, { y: 120 }), update(ELLIPSE, { y: 100 }, { y: 120 })),
    ]);
  });

  it('cancels its transaction on a cancel, which reverts the previews', () => {
    const drag = [at('press', 200, 150), at('drag-start', 230, 150), { type: 'cancel' } as const];
    expect(effectsOf(drag, [RECTANGLE])).toEqual({
      effects: [preview(update(RECTANGLE, { x: 100 }, { x: 130 })), { type: 'cancel' }],
      state: { type: 'idle' },
    });
  });
});

describe('the Selection tool: resizing, rotating and moving a line end', () => {
  it('REQ-T02 REQ-T04 resizes from a handle, with Shift and Alt read from each drag', () => {
    const drag = [at('press', 300, 200), at('drag-start', 340, 260)];
    const alt = { ...NONE, alt: true };
    expect(
      effectsOf([...drag, at('drag', 340, 210, alt), at('release', 340, 210)], [RECTANGLE]).effects,
    ).toEqual([
      preview(update(RECTANGLE, { width: 200, height: 100 }, { width: 240, height: 160 })),
      preview(
        update(
          RECTANGLE,
          { x: 100, y: 100, width: 200, height: 100 },
          { x: 60, y: 90, width: 280, height: 120 },
        ),
      ),
      { type: 'commit', label: 'resize' },
    ]);
  });

  it('REQ-T04 keeps the aspect ratio by the larger ratio with Shift held at the drag', () => {
    const shift = { ...NONE, shift: true };
    const drag = [at('press', 300, 200), at('drag-start', 400, 210, shift)];
    expect(effectsOf(drag, [RECTANGLE]).effects).toEqual([
      preview(update(RECTANGLE, { width: 200, height: 100 }, { width: 300, height: 150 })),
    ]);
  });

  it('REQ-T06 rotates from the rotation handle and commits one rotation', () => {
    // The rotation handle sits 24 px above the rectangle's top centre (200, 100).
    const drag = [at('press', 200, 76), at('drag-start', 300, 150), at('release', 300, 150)];
    expect(effectsOf(drag, [RECTANGLE]).effects).toEqual([
      preview(update(RECTANGLE, { rotation: 0 }, { rotation: Math.PI / 2 })),
      { type: 'commit', label: 'rotate' },
    ]);
  });

  it('moves the end of a lone two-point line, as a resize', () => {
    const drag = [at('press', 300, 400), at('drag-start', 300, 450), at('release', 300, 450)];
    const points = (y: number) => ({
      points: [
        { x: 0, y: 0 },
        { x: 200, y },
      ],
    });
    expect(effectsOf(drag, [LINE]).effects).toEqual([
      preview(update(LINE, points(0), points(50))),
      { type: 'commit', label: 'resize' },
    ]);
  });
});
