import { describe, expect, it } from 'vitest';

import { editorHarness } from '../support/editors.ts';
import { down, keyEvent, move, up, wheelEvent } from '../support/inputs.ts';

// The editor composes the render loop (docs/architecture/engine/rendering-and-hit-testing.md):
// what input does reaches the listener's next animation frame (REQ-F02).

describe('frames after input', () => {
  it('AC REQ-F02 draws the effect of a pointer move in the next animation frame', () => {
    const { editor, scheduler, feed, next } = editorHarness();
    editor.run('tool.hand');
    feed(down(100, 100), move(110, 100));
    expect(scheduler.pending()).toBe(1);
    const [frame, ...rest] = next();
    expect(rest).toEqual([]);
    expect(frame?.camera).toEqual({ x: -10, y: 0, zoom: 1 });
    expect(frame?.scene).toBeDefined();
    feed(move(150, 120));
    expect(next().map(({ camera }) => camera)).toEqual([{ x: -50, y: -20, zoom: 1 }]);
    feed(up(150, 120));
    expect(next()).toEqual([]);
  });

  it('REQ-F02 draws a wheel pan and a keyboard zoom in the next animation frame', () => {
    const { feed, next } = editorHarness();
    feed(wheelEvent({ x: 10, y: 10 }, { x: 0, y: 200 }));
    expect(next().map(({ camera }) => camera)).toEqual([{ x: 0, y: 200, zoom: 1 }]);
    feed(keyEvent('key-down', '=', 'Equal', { mod: true }));
    expect(next().map(({ camera }) => camera.zoom)).toEqual([1.1]);
  });

  it('asks for no frame when a gesture changes nothing, as a press with the Selection tool', () => {
    const { scheduler, feed, views } = editorHarness();
    feed(down(100, 100), move(160, 100), up(160, 100), keyEvent('key-down', 'a', 'KeyA'));
    expect(scheduler.pending()).toBe(0);
    expect(views).toEqual([]);
  });
});

describe('the viewport', () => {
  it('keeps the camera at the first size the canvas host reports, then keeps the centre', () => {
    const { editor, next } = editorHarness();
    expect(editor.view.camera).toEqual({ x: 0, y: 0, zoom: 1 });
    editor.resize({ width: 1000, height: 600, pixelRatio: 2 });
    expect(editor.view.camera).toEqual({ x: 140, y: 60, zoom: 1 });
    const [frame] = next();
    expect(frame?.viewport).toEqual({ width: 1000, height: 600, pixelRatio: 2 });
  });

  it('refuses a size that is not finite and changes nothing', () => {
    const { editor, scheduler } = editorHarness();
    expect(() => {
      editor.resize({ width: Number.NaN, height: 600, pixelRatio: 1 });
    }).toThrow(RangeError);
    expect(editor.view.camera).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(scheduler.pending()).toBe(0);
  });
});

describe('a disposed editor', () => {
  it('cancels its frame and refuses to be used', () => {
    const { editor, scheduler, feed } = editorHarness();
    feed(wheelEvent({ x: 0, y: 0 }, { x: 0, y: 10 }));
    editor.dispose();
    expect(scheduler.pending()).toBe(0);
    expect(() => editor.input(wheelEvent({ x: 0, y: 0 }, { x: 0, y: 10 }))).toThrow(
      'This editor has been disposed.',
    );
    expect(() => editor.run('tool.hand')).toThrow('This editor has been disposed.');
  });
});
