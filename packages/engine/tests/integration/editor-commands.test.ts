import { describe, expect, it } from 'vitest';

import type { RenderFrame } from '../../src/editor/render-frame.ts';
import type { KeyInput } from '../../src/input/events.ts';
import { editorHarness } from '../support/editors.ts';
import type { EditorHarness } from '../support/editors.ts';
import { keyEvent } from '../support/inputs.ts';
import { tapper } from '../support/selection-input.ts';
import {
  ELLIPSE,
  LINE,
  RECTANGLE,
  SMALL,
  TEXT,
  selectionDocument,
} from '../support/selection-scene.ts';
import { boxOf, dragFrom, sceneWatcher } from '../support/transform-scene.ts';

// Duplicate, Delete and the nudges through the editor's keymap
// (docs/architecture/engine/interaction.md#commands-and-shortcuts): each is one undo step.

const MOD_D = keyEvent('key-down', 'd', 'KeyD', { mod: true });
const arrow = (key: string, shift = false): KeyInput => keyEvent('key-down', key, key, { shift });
const repeat = (event: KeyInput): KeyInput => ({ ...event, repeat: true });

/** The identifiers of the elements that the last frame redrawing the scene shows, bottom first. */
const shownIds = (frames: readonly RenderFrame[]) =>
  frames.findLast((frame) => frame.scene !== undefined)?.scene?.elements.map(({ id }) => id);

function selected(harness: EditorHarness, ...points: readonly (readonly [number, number])[]) {
  const tap = tapper('mouse');
  points.forEach(([x, y], index) => {
    harness.feed(...tap(x, y, index > 0));
  });
}

describe('duplicating and deleting through the editor', () => {
  it('REQ-T08 REQ-T11 Mod+D copies the selection by +10, +10 just above it, selects the copies, in one undo step', () => {
    const harness = editorHarness(selectionDocument());
    const shown = sceneWatcher(harness);
    selected(harness, [200, 150], [450, 150]);
    expect(harness.editor.input(MOD_D)).toBe(true);
    const copies = harness.editor.view.selection;
    expect(copies).toHaveLength(2);
    expect(copies.map((id) => boxOf(shown(id)))).toEqual([
      [110, 110, 200, 100],
      [410, 110, 100, 100],
    ]);
    harness.editor.run('history.undo');
    expect([
      shownIds(harness.next()),
      harness.editor.view.selection,
      harness.editor.view.canUndo,
    ]).toEqual([[RECTANGLE, ELLIPSE, LINE, TEXT, SMALL], [RECTANGLE, ELLIPSE], false]);
    harness.editor.run('history.redo');
    expect(shownIds(harness.next())).toEqual([
      RECTANGLE,
      copies[0],
      ELLIPSE,
      copies[1],
      LINE,
      TEXT,
      SMALL,
    ]);
    expect(harness.editor.view.selection).toEqual(copies);
  });

  it('REQ-T09 Delete and Backspace remove the selection, and undo restores the elements, selected', () => {
    const harness = editorHarness(selectionDocument());
    selected(harness, [200, 150], [450, 150]);
    expect(harness.editor.input(keyEvent('key-down', 'Delete', 'Delete'))).toBe(true);
    expect([shownIds(harness.next()), harness.editor.view.selection]).toEqual([
      [LINE, TEXT, SMALL],
      [],
    ]);
    selected(harness, [610, 110]);
    harness.editor.input(keyEvent('key-down', 'Backspace', 'Backspace'));
    expect(shownIds(harness.next())).toEqual([LINE, TEXT]);
    harness.editor.run('history.undo');
    expect([shownIds(harness.next()), harness.editor.view.selection]).toEqual([
      [LINE, TEXT, SMALL],
      [SMALL],
    ]);
    harness.editor.run('history.undo');
    expect([shownIds(harness.next()), harness.editor.view.selection]).toEqual([
      [RECTANGLE, ELLIPSE, LINE, TEXT, SMALL],
      [RECTANGLE, ELLIPSE],
    ]);
    expect(harness.editor.view.canUndo).toBe(false);
  });

  it('does nothing with nothing selected, or while a drag is open', () => {
    const harness = editorHarness(selectionDocument());
    expect(
      ['selection.duplicate', 'selection.delete', 'selection.nudge-left'].map((id) =>
        harness.editor.run(id as 'selection.delete'),
      ),
    ).toEqual(['disabled', 'disabled', 'disabled']);
    const shown = sceneWatcher(harness);
    selected(harness, [200, 150]);
    const { start, to, end } = dragFrom('mouse', [200, 150, 230, 150]);
    harness.feed(...start, to);
    harness.editor.input(keyEvent('key-down', 'Delete', 'Delete'));
    harness.editor.input(MOD_D);
    harness.feed(end);
    expect([boxOf(shown(RECTANGLE)), harness.editor.view.selection]).toEqual([
      [130, 100, 200, 100],
      [RECTANGLE],
    ]);
    harness.editor.run('history.undo');
    expect(harness.editor.view.canUndo).toBe(false);
  });
});

describe('nudging through the editor', () => {
  it('REQ-T10 arrow keys nudge by 1 unit and Shift+arrow keys by 10, each press one undo step', () => {
    const harness = editorHarness(selectionDocument());
    const shown = sceneWatcher(harness);
    selected(harness, [200, 150]);
    const origins: number[][] = [];
    for (const shift of [false, true]) {
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
        expect(harness.editor.input(arrow(key, shift))).toBe(true);
        const { x, y } = shown(RECTANGLE);
        origins.push([x, y]);
      }
    }
    expect(origins).toEqual([
      [101, 100],
      [101, 101],
      [100, 101],
      [100, 100],
      [110, 100],
      [110, 110],
      [100, 110],
      [100, 100],
    ]);
    harness.editor.run('history.undo');
    expect(shown(RECTANGLE)).toMatchObject({ x: 100, y: 110 });
    for (let step = 1; step < 8; step += 1) harness.editor.run('history.undo');
    expect(harness.editor.view.canUndo).toBe(false);
  });

  it('REQ-T10 one held key is one undo step, and the next press is another', () => {
    const harness = editorHarness(selectionDocument());
    const shown = sceneWatcher(harness);
    selected(harness, [200, 150], [450, 150]);
    const right = arrow('ArrowRight');
    harness.feed(
      right,
      repeat(right),
      repeat(right),
      repeat(right),
      keyEvent('key-up', 'ArrowRight', 'ArrowRight'),
    );
    harness.feed(
      arrow('ArrowRight', true),
      keyEvent('key-up', 'ArrowRight', 'ArrowRight', { shift: true }),
    );
    expect([shown(RECTANGLE).x, shown(ELLIPSE).x]).toEqual([114, 414]);
    harness.editor.run('history.undo');
    expect([shown(RECTANGLE).x, harness.editor.view.canUndo]).toEqual([104, true]);
    harness.editor.run('history.undo');
    expect([shown(RECTANGLE).x, shown(ELLIPSE).x, harness.editor.view.canUndo]).toEqual([
      100,
      400,
      false,
    ]);
  });
});
