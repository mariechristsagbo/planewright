import { describe, expect, it } from 'vitest';

import type { Element } from '../../src/model/elements.ts';
import { freehandElement, shapeElement, testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import { tapper } from '../support/selection-input.ts';
import type { PointerKind } from '../../src/selection/pointer.ts';
import { documentOf } from '../support/selection-scene.ts';
import { boxOf, dragFrom, sceneWatcher } from '../support/transform-scene.ts';

// The ENG-10 review's m2 probes through the editor: each element is selected by a tap, then
// dragged from its own centre by +40, +30. Before C1 the dot did not move and the rectangles
// shrank to 1 x 1 from a corner handle.

const ID = testId(1);

function dragSelected(element: Element, pointer: PointerKind, [x, y]: readonly number[]) {
  const harness = editorHarness(documentOf(element));
  const shown = sceneWatcher(harness);
  harness.feed(...tapper(pointer)(x ?? 0, y ?? 0));
  expect(harness.editor.view.selection).toEqual([ID]);
  const { start, to, end } = dragFrom(pointer, [x ?? 0, y ?? 0, (x ?? 0) + 40, (y ?? 0) + 30]);
  harness.feed(...start, to, end);
  return { box: boxOf(shown(ID)), view: harness.editor.view };
}

describe('C1 REQ-T01 a selected small element moves when dragged from itself', () => {
  for (const pointer of ['mouse', 'touch'] as const) {
    it(`a freehand dot moves by the drag, with ${pointer} input`, () => {
      const dot = freehandElement([{ x: 0, y: 0 }], { id: 1, x: 200, y: 200 });
      const { box, view } = dragSelected(dot, pointer, [200, 200]);
      expect(box).toEqual([240, 230, 0, 0]);
      expect(view).toMatchObject({ selection: [ID], canUndo: true });
    });
  }

  it('a 6 x 6 rectangle moves by the drag, with a mouse', () => {
    const small = shapeElement('rectangle', 6, 6, { id: 1, x: 200, y: 200 });
    expect(dragSelected(small, 'mouse', [203, 203]).box).toEqual([240, 230, 6, 6]);
  });

  it('a 20 x 20 rectangle moves by the drag, with touch', () => {
    const small = shapeElement('rectangle', 20, 20, { id: 1, x: 200, y: 200 });
    // Its centre is no part of the unfilled outline, so the tap that selects it is on its edge.
    const harness = editorHarness(documentOf(small));
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('touch')(200, 210));
    const { start, to, end } = dragFrom('touch', [210, 210, 250, 240]);
    harness.feed(...start, to, end);
    expect(boxOf(shown(ID))).toEqual([240, 230, 20, 20]);
  });
});
