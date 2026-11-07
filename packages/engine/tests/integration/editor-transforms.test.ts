import { describe, expect, it } from 'vitest';

import { testId } from '../support/elements.ts';
import { editorHarness } from '../support/editors.ts';
import { POINTERS, tapper } from '../support/selection-input.ts';
import { LINE, selectionDocument } from '../support/selection-scene.ts';
import { documentOf } from '../support/selection-scene.ts';
import { boxOf, dragFrom, filledBox, sceneWatcher } from '../support/transform-scene.ts';

// Moving, resizing and rotating through the editor (docs/architecture/engine/interaction.md#transforms),
// with B-15's move, B-16's resize boxes and B-17's turn as committed in the behaviour analysis.

const FIRST = testId(1);
const SECOND = testId(2);

describe.each(POINTERS)('moving through the editor, with %s input', (pointer) => {
  it('REQ-T01 B-15: the drag from (300, 250) to (340, 290) moves the rectangle it presses by +40, +40', () => {
    // B-15's rectangle and ellipse were grouped, so its press selected both; groups are P1, so
    // the press selects the rectangle alone, and the next test moves the pair.
    const harness = editorHarness(
      documentOf(filledBox(1, [300, 200, 120, 100]), filledBox(2, [600, 200, 120, 100])),
    );
    const shown = sceneWatcher(harness);
    const { start, to, end } = dragFrom(pointer, [300, 250, 340, 290]);
    harness.feed(...start, to, end);
    expect([boxOf(shown(FIRST)), boxOf(shown(SECOND)), harness.editor.view.selection]).toEqual([
      [340, 240, 120, 100],
      [600, 200, 120, 100],
      [FIRST],
    ]);
  });

  it('REQ-T01 REQ-T11 B-15: a drag by +40, +40 moves the selected pair by +40, +40 in one undo step', () => {
    const harness = editorHarness(
      documentOf(filledBox(1, [300, 200, 120, 100]), filledBox(2, [600, 200, 120, 100])),
    );
    const shown = sceneWatcher(harness);
    const tap = tapper(pointer);
    harness.feed(...tap(360, 250), ...tap(660, 250, true));
    // With both selected, (300, 250) is the west side handle of their outline, so the drag starts
    // inside the rectangle.
    const { start, to, end } = dragFrom(pointer, [360, 250, 400, 290]);
    harness.feed(...start, to, end);
    expect([boxOf(shown(FIRST)), boxOf(shown(SECOND))]).toEqual([
      [340, 240, 120, 100],
      [640, 240, 120, 100],
    ]);
    expect(harness.editor.run('history.undo')).toBe('done');
    expect([boxOf(shown(FIRST)), boxOf(shown(SECOND)), harness.editor.view.canUndo]).toEqual([
      [300, 200, 120, 100],
      [600, 200, 120, 100],
      false,
    ]);
    harness.editor.run('history.redo');
    expect(boxOf(shown(SECOND))).toEqual([640, 240, 120, 100]);
  });

  it('REQ-T01 dragging an unselected element selects it and moves it alone', () => {
    const harness = editorHarness(
      documentOf(filledBox(1, [100, 100, 100, 100]), filledBox(2, [300, 100, 100, 100])),
    );
    const shown = sceneWatcher(harness);
    harness.feed(...tapper(pointer)(350, 150));
    const { start, to, end } = dragFrom(pointer, [150, 150, 170, 180]);
    harness.feed(...start, to, end);
    expect(harness.editor.view.selection).toEqual([FIRST]);
    expect([boxOf(shown(FIRST)), boxOf(shown(SECOND))]).toEqual([
      [120, 130, 100, 100],
      [300, 100, 100, 100],
    ]);
  });
});

// On mobile each B-16 case started 4 units outside the dragged corner or side of a 120 × 80
// rectangle; its box is the result minus the drag along the dragged edges.
const B16 = [
  ['se', [30, 100, 120, 80], [30, 30], [30, 100, 150, 110]],
  ['nw', [240, 110, 120, 80], [-20, -20], [220, 90, 140, 100]],
  ['e', [30, 280, 120, 80], [40, 0], [30, 280, 160, 80]],
  ['n', [240, 290, 120, 80], [0, -30], [240, 260, 120, 110]],
  ['sw', [40, 100, 120, 80], [-20, 30], [20, 100, 140, 110]],
  ['ne', [220, 110, 120, 80], [20, -20], [220, 90, 140, 100]],
  ['w', [40, 280, 120, 80], [-20, 0], [20, 280, 140, 80]],
  ['s', [220, 290, 120, 80], [0, 30], [220, 290, 120, 110]],
] as const;

const PLACES = {
  nw: [0, 0],
  n: [0.5, 0],
  ne: [1, 0],
  e: [1, 0.5],
  se: [1, 1],
  s: [0.5, 1],
  sw: [0, 1],
  w: [0, 0.5],
} as const;

describe('resizing through the editor, as B-16 observed', () => {
  it.each(B16)(
    'REQ-T02 REQ-T11 a touch drag of the %s handle from 4 units outside it',
    (handle, box, [dx, dy], after) => {
      const harness = editorHarness(documentOf(filledBox(1, box)));
      const shown = sceneWatcher(harness);
      const [x, y, width, height] = box;
      const [fx, fy] = PLACES[handle];
      harness.feed(...tapper('touch')(x + width / 2, y + height / 2));
      const press = [
        x + fx * width + 4 * Math.sign(fx - 0.5),
        y + fy * height + 4 * Math.sign(fy - 0.5),
      ] as const;
      const { start, to, end } = dragFrom('touch', [...press, press[0] + dx, press[1] + dy]);
      harness.feed(...start, to, end);
      expect(boxOf(shown(FIRST))).toEqual(after);
      harness.editor.run('history.undo');
      expect([boxOf(shown(FIRST)), harness.editor.view.canUndo]).toEqual([[...box], false]);
    },
  );

  it('REQ-T02 the desktop south-east handle dragged by (60, 50) gives [340, 240, 180, 150]', () => {
    const harness = editorHarness(documentOf(filledBox(1, [340, 240, 120, 100])));
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(400, 290));
    const { start, to, end } = dragFrom('mouse', [460, 340, 520, 390]);
    harness.feed(...start, to, end);
    expect(boxOf(shown(FIRST))).toEqual([340, 240, 180, 150]);
  });

  it('REQ-T03 the pair’s south-east handle, dragged from 6 units outside by (100, 20), scales both', () => {
    const harness = editorHarness(
      documentOf(filledBox(1, [40, 460, 80, 60]), filledBox(2, [160, 500, 80, 60])),
    );
    const shown = sceneWatcher(harness);
    const tap = tapper('touch');
    harness.feed(...tap(80, 490), ...tap(200, 530, true));
    const { start, to, end } = dragFrom('touch', [246, 566, 346, 586]);
    harness.feed(...start, to, end);
    expect([boxOf(shown(FIRST)), boxOf(shown(SECOND))]).toEqual([
      [40, 460, 120, 72],
      [220, 508, 120, 72],
    ]);
  });
});

describe('rotating and moving line ends through the editor', () => {
  it('REQ-T06 B-17: the rotation handle dragged round to (530, 315) turns the rectangle a quarter', () => {
    const harness = editorHarness(documentOf(filledBox(1, [340, 240, 180, 150])));
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(430, 315));
    const turn = dragFrom('mouse', [430, 220, 530, 315]);
    harness.feed(...turn.start, turn.to, turn.end);
    expect(shown(FIRST).rotation).toBeCloseTo(Math.PI / 2, 12);
    expect(boxOf(shown(FIRST))).toEqual([340, 240, 180, 150]);
  });

  it('REQ-T06 Shift rounds the rotation to 15° steps', () => {
    const harness = editorHarness(documentOf(filledBox(1, [340, 240, 180, 150])));
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(430, 315));
    const free = dragFrom('mouse', [430, 220, 530, 300]);
    harness.feed(...free.start, free.to);
    const turned = Math.PI / 2 + Math.atan2(-15, 100);
    expect(shown(FIRST).rotation).toBeCloseTo(turned, 12);
    harness.feed(dragFrom('mouse', [430, 220, 530, 300], { shift: true }).to);
    expect(shown(FIRST).rotation).toBeCloseTo((75 * Math.PI) / 180, 12);
  });

  it('moves one end of a two-point line, in one undo step', () => {
    const harness = editorHarness(selectionDocument());
    const shown = sceneWatcher(harness);
    harness.feed(...tapper('mouse')(200, 400));
    const { start, to, end } = dragFrom('mouse', [300, 400, 300, 450]);
    harness.feed(...start, to, end);
    expect(shown(LINE)).toMatchObject({
      x: 100,
      y: 400,
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 50 },
      ],
    });
    harness.editor.run('history.undo');
    expect(shown(LINE)).toMatchObject({
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
      ],
    });
  });

  it('draws the outline and handles where the previewed elements are', () => {
    const harness = editorHarness(documentOf(filledBox(1, [100, 100, 100, 100])));
    harness.feed(...tapper('mouse')(150, 150));
    harness.next();
    const { start, to } = dragFrom('mouse', [150, 150, 200, 170]);
    harness.feed(...start, to);
    const outline = harness
      .next()
      .at(-1)
      ?.overlay?.primitives.find(({ type }) => type === 'selection-outline');
    expect(outline).toEqual({
      type: 'selection-outline',
      corners: [
        { x: 150, y: 120 },
        { x: 250, y: 120 },
        { x: 250, y: 220 },
        { x: 150, y: 220 },
      ],
    });
  });
});
