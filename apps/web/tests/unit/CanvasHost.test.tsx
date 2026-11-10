import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { CanvasHost } from '../../src/editor/CanvasHost.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The canvas host (docs/architecture/engine/modules.md#web-app-structure): two stacked canvases in
// a focusable region, sized from the page, whose DOM input reaches the editor.

// The host has a 1 px border and the canvases fill the box inside it, as in styles/canvas.css.
const HOST = DOMRect.fromRect({ x: 99, y: 49, width: 802, height: 602 });
let canvasRect = DOMRect.fromRect({ x: 100, y: 50, width: 800, height: 600 });

/** The size observers made so far, each with what it observes and the report it calls. */
const observed: { target: Element; report: () => void }[] = [];
class RecordingObserver {
  readonly #report: () => void;
  constructor(report: () => void) {
    this.#report = report;
  }
  observe(target: Element): void {
    observed.push({ target, report: this.#report });
  }
  unobserve(): void {
    // Nothing to stop.
  }
  disconnect(): void {
    // Nothing to stop.
  }
}
vi.stubGlobal('ResizeObserver', RecordingObserver);

beforeEach(() => {
  canvasRect = DOMRect.fromRect({ x: 100, y: 50, width: 800, height: 600 });
  observed.length = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this instanceof HTMLCanvasElement ? canvasRect : HOST;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(platform: 'apple' | 'other' = 'other') {
  const harness = surfaceHarness(platform);
  const view = render(harness.wrap(<CanvasHost />));
  harness.flush();
  const host = screen.getByRole('region', { name: 'Drawing canvas' });
  return { ...harness, ...view, host };
}

describe('the canvas host', () => {
  it('is a focusable region named Drawing canvas, described by what works and what does not', () => {
    const { host } = mount();
    expect(host).toHaveAttribute('tabindex', '0');
    expect(host).toHaveAttribute('id', CANVAS_ID);
    expect(host.querySelectorAll('canvas')).toHaveLength(2);
    expect(host).toHaveAccessibleDescription(
      /^Choose a drawing tool, then drag on the canvas to draw, or tap for the default size; the Selection tool \(V\) selects, moves, resizes and rotates what is drawn\./,
    );
    expect(host).toHaveAccessibleDescription(/Ctrl\+scroll or pinch to zoom/);
    expect(host).toHaveAccessibleDescription(
      /With the Text tool \(T\), click or tap to place a text and type it; Escape, Ctrl\+Enter or a press elsewhere ends it, and a double-click or double tap on a text edits it again\./,
    );
    expect(host).toHaveAccessibleDescription(
      /From the keyboard, Enter draws the drawing tool’s element at the centre of the canvas, or edits the one selected text with the Selection tool\.$/,
    );
  });

  it('names Cmd in its instructions on Apple platforms', () => {
    const { host } = mount('apple');
    expect(host).toHaveAccessibleDescription(/Cmd\+scroll or pinch to zoom/);
  });

  it('makes a renderer over its scene and overlay canvases and hands it every frame', () => {
    const { host, made, editor, flush } = mount();
    const [scene, overlay] = host.querySelectorAll('canvas');
    expect(made).toHaveLength(1);
    expect(made[0]?.canvases).toEqual([scene, overlay]);
    expect(made[0]?.frames.at(-1)?.viewport).toEqual({ width: 800, height: 600, pixelRatio: 1 });
    editor.run('view.zoom-in');
    flush();
    expect(made[0]?.frames.at(-1)?.camera.zoom).toBeCloseTo(1.1, 9);
  });

  it('stops frames, input and sizing and disposes its renderer when it leaves', () => {
    const { host, made, editor, unmount, flush } = mount();
    unmount();
    expect(made[0]?.disposed).toBe(true);
    const count = made[0]?.frames.length;
    editor.run('view.zoom-in');
    flush();
    expect(made[0]?.frames).toHaveLength(count ?? 0);
    const camera = editor.view.camera;
    fireEvent.wheel(host, { deltaY: 100, clientX: 200, clientY: 200 });
    expect(editor.view.camera).toBe(camera);
  });

  it('shows the active tool’s cursor', () => {
    const { host, editor } = mount();
    expect(host).toHaveStyle({ cursor: 'default' });
    act(() => {
      editor.run('tool.hand');
    });
    expect(host.style.cursor).toBe('grab');
  });
});

describe('input on the canvas host', () => {
  it('REQ-V01 pans with the wheel from canvas-relative points and prevents the page scroll', () => {
    const { host, editor } = mount();
    expect(fireEvent.wheel(host, { deltaY: 200, clientX: 500, clientY: 350 })).toBe(false);
    expect(editor.view.camera).toEqual({ x: 0, y: 200, zoom: 1 });
  });

  it('REQ-V06 pans with a middle-button drag, focusing the canvas and capturing the pointer', () => {
    const { host, editor } = mount();
    const capture = vi.fn();
    host.setPointerCapture = capture;
    host.hasPointerCapture = () => true;
    const release = vi.fn();
    host.releasePointerCapture = release;
    const at = (x: number, y: number) => ({
      pointerId: 3,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    });
    expect(fireEvent.pointerDown(host, { ...at(300, 300), button: 1, buttons: 4 })).toBe(false);
    expect(host).toHaveFocus();
    expect(capture).toHaveBeenCalledWith(3);
    fireEvent.pointerMove(host, { ...at(250, 260), button: -1, buttons: 4 });
    fireEvent.pointerUp(host, { ...at(250, 260), button: 1, buttons: 0 });
    expect(release).toHaveBeenCalledWith(3);
    expect(editor.view.camera).toEqual({ x: 50, y: 40, zoom: 1 });
  });

  it('REQ-S06 ends a press released on the back or forward button, so a later hover drags nothing (ENG-08 m2)', () => {
    const { host, editor } = mount();
    host.setPointerCapture = vi.fn();
    host.hasPointerCapture = () => true;
    host.releasePointerCapture = vi.fn();
    editor.run('tool.hand');
    const at = (x: number, button: number, buttons: number) => ({
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: 300,
      button,
      buttons,
    });
    fireEvent.pointerDown(host, at(300, 0, 1));
    fireEvent.pointerMove(host, at(250, -1, 9));
    fireEvent.pointerUp(host, at(250, 3, 0));
    fireEvent.pointerMove(host, at(100, -1, 0));
    expect(editor.view).toMatchObject({ camera: { x: 50, y: 0, zoom: 1 }, cursor: 'grab' });
  });

  it('ignores a press of the back or forward button', () => {
    const { host, editor } = mount();
    const capture = vi.fn();
    host.setPointerCapture = capture;
    fireEvent.pointerDown(host, { pointerId: 1, button: 3, buttons: 8, clientX: 0, clientY: 0 });
    expect(capture).not.toHaveBeenCalled();
    expect(editor.view.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('REQ-V05 runs Ctrl+= and prevents its default, but leaves an unbound key alone', () => {
    const { host, editor } = mount();
    expect(fireEvent.keyDown(host, { key: '=', code: 'Equal', ctrlKey: true })).toBe(false);
    expect(editor.view.camera.zoom).toBeCloseTo(1.1, 9);
    expect(fireEvent.keyDown(host, { key: 'a', code: 'KeyA' })).toBe(true);
    expect(fireEvent.keyUp(host, { key: '=', code: 'Equal', ctrlKey: true })).toBe(true);
  });

  it('holds Space for camera drags without scrolling the page, and lets it go when the window loses focus', () => {
    const { host, editor } = mount();
    host.setPointerCapture = vi.fn();
    const at = (x: number) => ({
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: 300,
      button: 0,
      buttons: 1,
    });
    expect(fireEvent.keyDown(host, { key: ' ', code: 'Space' })).toBe(false);
    fireEvent.blur(window);
    fireEvent.pointerDown(host, at(300));
    fireEvent.pointerMove(host, { ...at(200), button: -1 });
    expect(editor.view.camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('REQ-S06 lets Space go when the canvas host loses focus, so a later drag selects instead of panning (ENG-08 m1)', () => {
    const { host, editor } = mount();
    host.setPointerCapture = vi.fn();
    host.hasPointerCapture = () => true;
    host.releasePointerCapture = vi.fn();
    const at = (x: number) => ({
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: 300,
      button: 0,
      buttons: 1,
    });
    act(() => {
      host.focus();
    });
    fireEvent.keyDown(host, { key: ' ', code: 'Space' });
    act(() => {
      host.blur();
    });
    fireEvent.pointerDown(host, at(300));
    fireEvent.pointerMove(host, { ...at(200), button: -1 });
    fireEvent.pointerUp(host, { ...at(200), buttons: 0 });
    expect(editor.view).toMatchObject({ camera: { x: 0, y: 0, zoom: 1 }, tool: 'selection' });
  });
});

describe('the scene canvas inside the host’s border', () => {
  it('REQ-V04 zooms about the scene canvas’s own top-left pixel, which is the screen origin', () => {
    const { host, editor } = mount();
    expect(fireEvent.wheel(host, { deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 })).toBe(
      false,
    );
    const { x, y, zoom } = editor.view.camera;
    expect(zoom).toBeCloseTo(Math.exp(0.1), 9);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(0, 9);
  });

  it('gives pointer points relative to the scene canvas, not to the host’s border box', () => {
    const { host, editor } = mount();
    host.setPointerCapture = vi.fn();
    const input = vi.spyOn(editor, 'input');
    const at = (x: number, y: number) => ({
      pointerId: 1,
      pointerType: 'mouse',
      clientX: x,
      clientY: y,
    });
    fireEvent.pointerDown(host, { ...at(100, 50), button: 0, buttons: 1 });
    fireEvent.pointerMove(host, { ...at(900, 650), button: -1, buttons: 1 });
    expect(input.mock.calls.map(([event]) => ('at' in event ? event.at : null))).toEqual([
      { x: 0, y: 0 },
      { x: 800, y: 600 },
    ]);
  });

  it('sizes the editor from the scene canvas at pixel ratio 2, and again when that canvas resizes', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const { host, made, flush } = mount();
    expect(observed).toHaveLength(1);
    expect(observed[0]?.target).toBe(host.querySelector('canvas'));
    expect(made[0]?.frames.at(-1)?.viewport).toEqual({ width: 800, height: 600, pixelRatio: 2 });
    canvasRect = DOMRect.fromRect({ x: 100, y: 50, width: 640.5, height: 480.25 });
    act(() => {
      for (const { report } of observed) report();
    });
    flush();
    expect(made[0]?.frames.at(-1)?.viewport).toEqual({
      width: 640.5,
      height: 480.25,
      pixelRatio: 2,
    });
  });
});
