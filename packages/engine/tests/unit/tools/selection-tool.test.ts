import { describe, expect, it } from 'vitest';

import type { ElementId } from '../../../src/model/ids.ts';
import type { PointerKind } from '../../../src/selection/pointer.ts';
import { selectionTool } from '../../../src/tools/selection-tool.ts';
import type { SelectionToolState } from '../../../src/tools/selection-tool.ts';
import type { GestureEvent, ToolEffect } from '../../../src/tools/tool.ts';
import { sceneOf } from '../../support/elements.ts';
import {
  ELLIPSE,
  RECTANGLE,
  SMALL,
  TEXT,
  selectionElements,
} from '../../support/selection-scene.ts';
import { toolContext } from '../../support/tool-contexts.ts';

// The Selection tool's transitions (docs/architecture/engine/interaction.md#selection-tool), over
// the selection fixture at zoom 1, where a screen point is the scene point. Its drags that would
// move, resize or rotate are ENG-10's and change nothing yet.

const NONE = { shift: false, alt: false, mod: false };
const SHIFT = { ...NONE, shift: true };

type Type = Exclude<GestureEvent['type'], 'cancel'>;

interface Options {
  readonly shift?: boolean;
  readonly pointer?: PointerKind;
}

const SHIFTED: Options = { shift: true };

const at = (type: Type, x: number, y: number, { shift = false, pointer = 'mouse' }: Options = {}) =>
  ({ type, at: { x, y }, scene: { x, y }, pointer, modifiers: shift ? SHIFT : NONE }) as const;

const CANCEL = { type: 'cancel' } as const;

/**
 * Runs the gestures through the tool from its initial state, applying each selection it asks for
 * as the editor does, and returns its effects, the selection and its last state.
 */
function run(events: readonly GestureEvent[], selected: readonly ElementId[] = []) {
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
  return { effects, selection, state };
}

describe('the Selection tool: presses on handles and elements', () => {
  it('keeps the selection on a press on a handle, whose drag resizes only in ENG-10', () => {
    const drag = [at('press', 300, 200), at('drag-start', 340, 260), at('release', 340, 260)];
    expect(run(drag, [RECTANGLE])).toEqual({
      effects: [],
      selection: [RECTANGLE],
      state: { type: 'idle' },
    });
    expect(run([at('press', 300, 200), at('tap', 300, 200)], [RECTANGLE]).effects).toEqual([]);
  });

  it('makes an unselected element the selection on a press', () => {
    expect(run([at('press', 200, 150)], [ELLIPSE]).effects).toEqual([
      { type: 'select', ids: [RECTANGLE] },
    ]);
  });

  it('REQ-S05 adds an unselected element to the selection on a Shift+press', () => {
    expect(run([at('press', 200, 150, SHIFTED)], [ELLIPSE]).effects).toEqual([
      { type: 'select', ids: [ELLIPSE, RECTANGLE] },
    ]);
  });

  it('keeps the selection on a press, a tap or a drag from a selected element', () => {
    const selected = [RECTANGLE, ELLIPSE];
    const drag = [at('press', 200, 150), at('drag-start', 260, 150), at('release', 260, 150)];
    expect(run(drag, selected).effects).toEqual([]);
    expect(run([at('press', 200, 150), at('tap', 200, 150)], selected).effects).toEqual([]);
  });

  it('REQ-S05 removes a selected element on a Shift+tap', () => {
    const tap = [at('press', 200, 150, SHIFTED), at('tap', 200, 150, SHIFTED)];
    expect(run(tap, [RECTANGLE, ELLIPSE]).effects).toEqual([{ type: 'select', ids: [ELLIPSE] }]);
  });

  it('REQ-S05 keeps an element that the same Shift+press added, and removes nothing without Shift at the tap', () => {
    const added = run([at('press', 200, 150, SHIFTED), at('tap', 200, 150, SHIFTED)], [ELLIPSE]);
    expect(added.selection).toEqual([ELLIPSE, RECTANGLE]);
    expect(added.effects).toHaveLength(1);
    const released = [at('press', 200, 150, SHIFTED), at('tap', 200, 150)];
    expect(run(released, [RECTANGLE, ELLIPSE]).effects).toEqual([]);
  });

  it('treats a double tap as a tap until a double tap edits a text (ENG-12)', () => {
    const shift = [at('press', 450, 415, SHIFTED), at('double-tap', 450, 415, SHIFTED)];
    expect(run(shift, [TEXT, ELLIPSE]).selection).toEqual([ELLIPSE]);
    expect(run([at('press', 700, 500), at('double-tap', 700, 500)], [TEXT]).selection).toEqual([]);
  });
});

describe('the Selection tool: presses inside the selection box and on empty canvas', () => {
  it('REQ-T07 clears the selection on a tap inside the selection box on no element', () => {
    const tap = [at('press', 350, 150), at('tap', 350, 150)];
    expect(run(tap, [RECTANGLE, ELLIPSE]).effects).toEqual([{ type: 'select', ids: [] }]);
  });

  it('keeps the selection on a drag from inside the selection box, which moves it only in ENG-10', () => {
    const drag = [at('press', 350, 150), at('drag-start', 380, 150), at('release', 380, 150)];
    expect(run(drag, [RECTANGLE, ELLIPSE]).effects).toEqual([]);
  });

  it('REQ-S10 REQ-T07 clears the selection on a tap on empty canvas, with a mouse or touch', () => {
    for (const pointer of ['mouse', 'touch'] as const) {
      const tap = [at('press', 700, 500, { pointer }), at('tap', 700, 500, { pointer })];
      expect(run(tap, [RECTANGLE]).effects).toEqual([{ type: 'select', ids: [] }]);
    }
    expect(
      run([at('press', 700, 500, SHIFTED), at('tap', 700, 500, SHIFTED)], [TEXT]).selection,
    ).toEqual([]);
  });

  it('changes nothing on a release that ends a press on empty canvas without a drag', () => {
    expect(run([at('press', 700, 500), at('release', 700, 500)], [RECTANGLE]).effects).toEqual([]);
  });
});

describe('the Selection tool: the marquee', () => {
  it('REQ-S06 draws a marquee that follows the pointer and selects what it wholly encloses on release', () => {
    const { effects, selection } = run(
      [
        at('press', 50, 50),
        at('drag-start', 60, 60),
        at('drag', 610, 250),
        at('release', 610, 250),
      ],
      [TEXT],
    );
    expect(effects).toEqual([
      { type: 'marquee', box: { x: 50, y: 50, width: 10, height: 10 } },
      { type: 'marquee', box: { x: 50, y: 50, width: 560, height: 200 } },
      { type: 'marquee', box: null },
      { type: 'select', ids: [RECTANGLE, ELLIPSE] },
    ]);
    expect(selection).not.toContain(SMALL);
  });

  it('REQ-S06 draws the marquee from the press in any direction', () => {
    const drag = [at('press', 630, 250), at('drag-start', 50, 50), at('release', 50, 50)];
    expect(run(drag).effects).toEqual([
      { type: 'marquee', box: { x: 50, y: 50, width: 580, height: 200 } },
      { type: 'marquee', box: null },
      { type: 'select', ids: [RECTANGLE, ELLIPSE, SMALL] },
    ]);
  });

  it('REQ-S06 adds the enclosed elements to the selection with Shift at the release', () => {
    const drag = [
      at('press', 50, 50),
      at('drag-start', 550, 250),
      at('release', 550, 250, SHIFTED),
    ];
    expect(run(drag, [TEXT, RECTANGLE]).selection).toEqual([TEXT, RECTANGLE, ELLIPSE]);
  });

  it('REQ-T07 replaces the selection with nothing when the marquee encloses nothing', () => {
    const drag = [at('press', 700, 500), at('drag-start', 760, 560), at('release', 760, 560)];
    expect(run(drag, [RECTANGLE]).selection).toEqual([]);
  });

  it('removes a cancelled marquee and leaves the selection as it was', () => {
    const drag = [at('press', 50, 50), at('drag-start', 550, 250), CANCEL, at('release', 550, 250)];
    expect(run(drag, [TEXT])).toEqual({
      effects: [
        { type: 'marquee', box: { x: 50, y: 50, width: 500, height: 200 } },
        { type: 'marquee', box: null },
      ],
      selection: [TEXT],
      state: { type: 'idle' },
    });
  });

  it('changes nothing on a cancel without a marquee', () => {
    expect(run([at('press', 200, 150), CANCEL], [ELLIPSE]).effects).toEqual([
      { type: 'select', ids: [RECTANGLE] },
    ]);
    expect(run([CANCEL]).state).toEqual({ type: 'idle' });
  });

  it('changes nothing on a tap or a release that it never saw pressed', () => {
    expect(run([at('tap', 700, 500), at('release', 700, 500)], [RECTANGLE]).effects).toEqual([]);
  });

  it('starts idle with the default cursor', () => {
    expect([selectionTool.id, selectionTool.cursor, selectionTool.initial]).toEqual([
      'selection',
      'default',
      { type: 'idle' },
    ]);
  });
});
