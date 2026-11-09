import { describe, expect, it } from 'vitest';

import type { EditorView } from '../../src/editor/editor.ts';
import type { InputEvent } from '../../src/input/events.ts';
import { editorHarness } from '../support/editors.ts';
import { down, keyEvent, move, up, wheelEvent } from '../support/inputs.ts';

// Scripted input sessions through the editor: camera gestures in any tool, the Hand tool, the
// keymap, and Undo and Redo, which no camera action enables (REQ-V10, REQ-H04).

const touch = (id: number) => ({ id, pointer: 'touch' as const });
const middle = { button: 'middle' } as const;
const space = (type: 'key-down' | 'key-up') => keyEvent(type, ' ', 'Space');
const undoState = (view: EditorView) => [view.canUndo, view.canRedo];

describe('camera gestures in any tool', () => {
  it('REQ-V06 Space+drag pans by exactly the pointer delta and leaves the tool unchanged', () => {
    const { editor, feed } = editorHarness();
    feed(space('key-down'), down(300, 300), move(250, 280), move(200, 250), up(200, 250));
    feed(space('key-up'));
    expect(editor.view.camera).toEqual({ x: 100, y: 50, zoom: 1 });
    expect(editor.view.tool).toBe('selection');
  });

  it('REQ-V06 a middle-button drag pans in the Hand tool and in the Selection tool', () => {
    const { editor, feed } = editorHarness();
    feed(down(0, 0, middle), move(-30, -40, middle), up(-30, -40, middle));
    editor.run('tool.hand');
    feed(down(0, 0, middle), move(-70, -10, middle), up(-70, -10, middle));
    expect(editor.view.camera).toEqual({ x: 100, y: 50, zoom: 1 });
  });

  it('REQ-V07 a second finger cancels the Hand tool’s drag, then pans and zooms', () => {
    const { editor, feed } = editorHarness();
    editor.run('tool.hand');
    feed(down(400, 300, touch(1)), move(420, 300, touch(1)));
    expect(editor.view).toMatchObject({ camera: { x: -20, y: 0 }, cursor: 'grabbing' });
    feed(down(520, 300, touch(2)));
    expect(editor.view.cursor).toBe('grab');
    feed(move(620, 300, touch(2)));
    expect(editor.view.camera.zoom).toBeCloseTo(2, 9);
    feed(up(620, 300, touch(2)), move(100, 100, touch(1)), up(100, 100, touch(1)));
    expect(editor.view.camera.zoom).toBeCloseTo(2, 9);
    expect(editor.view.camera.x).toBeCloseTo(-20 + 470 - 520 / 2, 9);
  });
});

describe('the Hand tool', () => {
  it('REQ-V06 pans by exactly the pointer delta, with an open and a closed hand', () => {
    const { editor, feed } = editorHarness();
    expect(editor.input(keyEvent('key-down', 'h', 'KeyH'))).toBe(true);
    expect(editor.view).toMatchObject({ tool: 'hand', cursor: 'grab' });
    feed(down(10, 10));
    expect(editor.view.cursor).toBe('grabbing');
    feed(move(30, 20), move(60, 60), up(60, 60));
    expect(editor.view).toMatchObject({ camera: { x: -50, y: -50, zoom: 1 }, cursor: 'grab' });
    editor.run('tool.selection');
    expect(editor.view).toMatchObject({ tool: 'selection', cursor: 'default' });
  });
});

describe('keys', () => {
  it('reports a command’s chord and a wheel as handled, so the host prevents their default', () => {
    const { editor } = editorHarness();
    expect(editor.input(keyEvent('key-down', '=', 'Equal', { mod: true }))).toBe(true);
    expect(editor.view.camera.zoom).toBeCloseTo(1.1, 9);
    expect(editor.input(keyEvent('key-down', 'z', 'KeyZ', { mod: true }))).toBe(true);
    expect(editor.input(wheelEvent({ x: 0, y: 0 }, { x: 0, y: 5 }))).toBe(true);
    expect(editor.input(keyEvent('key-down', 'a', 'KeyA'))).toBe(false);
    expect(editor.input(keyEvent('key-up', '=', 'Equal', { mod: true }))).toBe(false);
    expect(editor.input(down(0, 0))).toBe(false);
    expect(editor.input({ type: 'focus-lost', time: 0 })).toBe(false);
  });
});

describe('Undo and Redo', () => {
  it('AC REQ-V10 REQ-H04 start disabled, and panning and zooming leave them disabled', () => {
    const { editor, feed, views } = editorHarness();
    expect(undoState(editor.view)).toEqual([false, false]);
    const session: InputEvent[][] = [
      [wheelEvent({ x: 0, y: 0 }, { x: 0, y: 200 })],
      [wheelEvent({ x: 0, y: 0 }, { x: 0, y: 200 }, { shift: true })],
      [wheelEvent({ x: 640, y: 360 }, { x: 0, y: -100 }, { zoom: true })],
      [
        keyEvent('key-down', '=', 'Equal', { mod: true }),
        keyEvent('key-down', '0', 'Digit0', { mod: true }),
      ],
      [space('key-down'), down(0, 0), move(50, 50), up(50, 50), space('key-up')],
      [down(0, 0, middle), move(-20, 0, middle), up(-20, 0, middle)],
      [keyEvent('key-down', 'h', 'KeyH'), down(0, 0), move(40, 40), up(40, 40)],
      [down(0, 0, touch(1)), down(100, 0, touch(2)), move(200, 0, touch(2)), up(200, 0, touch(2))],
    ];
    for (const events of session) {
      const before = editor.view.camera;
      feed(...events);
      expect(editor.view.camera).not.toEqual(before);
      expect(undoState(editor.view)).toEqual([false, false]);
    }
    expect(views.every((view) => !view.canUndo && !view.canRedo)).toBe(true);
    expect(editor.run('history.undo')).toBe('disabled');
    expect(editor.run('history.redo')).toBe('disabled');
  });
});

describe('the view and the commands', () => {
  it('publishes a new view after each change, to each listener until it leaves', () => {
    const { editor } = editorHarness();
    const seen: EditorView[] = [];
    const leave = editor.subscribe((view) => seen.push(view));
    const before = editor.view;
    editor.run('tool.hand');
    expect(seen).toEqual([editor.view]);
    expect(editor.view).not.toBe(before);
    leave();
    editor.run('tool.selection');
    expect(seen).toHaveLength(1);
  });

  it('lists the registry’s commands with their labels, shortcuts and tools only', () => {
    const { editor } = editorHarness();
    expect(editor.commands.map(({ id }) => id)).toEqual([
      'tool.hand',
      'tool.selection',
      'tool.rectangle',
      'tool.ellipse',
      'tool.diamond',
      'tool.line',
      'tool.freehand',
      'tool.text',
      'tool.lock',
      'history.undo',
      'history.redo',
      'selection.select-all',
      'selection.cancel',
      'view.zoom-in',
      'view.zoom-out',
      'view.zoom-reset',
      'view.zoom-to-fit',
      'selection.duplicate',
      'selection.delete',
      'selection.nudge-left',
      'selection.nudge-left-10',
      'selection.nudge-right',
      'selection.nudge-right-10',
      'selection.nudge-up',
      'selection.nudge-up-10',
      'selection.nudge-down',
      'selection.nudge-down-10',
      'canvas.enter',
    ]);
    expect(editor.commands.filter(({ id }) => id.startsWith('selection.nudge-down'))).toEqual([
      { id: 'selection.nudge-down', label: 'Nudge down', shortcuts: [{ key: 'arrowdown' }] },
      {
        id: 'selection.nudge-down-10',
        label: 'Nudge down by 10',
        shortcuts: [{ key: 'arrowdown', shift: true }],
      },
    ]);
    expect(editor.commands[0]).toEqual({
      id: 'tool.hand',
      label: 'Hand',
      shortcuts: [{ key: 'h' }],
      tool: 'hand',
    });
    expect(editor.commands.find(({ id }) => id === 'history.undo')).toEqual({
      id: 'history.undo',
      label: 'Undo',
      shortcuts: [{ key: 'z', mod: true }],
    });
    expect(editor.commands.find(({ id }) => id === 'tool.lock')).toEqual({
      id: 'tool.lock',
      label: 'Tool lock',
      shortcuts: [{ key: 'q' }],
    });
  });
});
