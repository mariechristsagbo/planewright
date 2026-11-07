import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasHost } from '../../src/editor/CanvasHost.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// The canvas host (docs/architecture/engine/modules.md#web-app-structure): two stacked canvases in
// a focusable region, sized from the page, whose DOM input reaches the editor.

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 100, y: 50, width: 800, height: 600 }),
  );
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
    expect(host.querySelectorAll('canvas')).toHaveLength(2);
    expect(host).toHaveAccessibleDescription(/nothing can be drawn on it yet/);
    expect(host).toHaveAccessibleDescription(/Ctrl\+scroll or pinch to zoom/);
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

  it('ignores the back and forward buttons', () => {
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
});
