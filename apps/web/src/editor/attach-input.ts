import type { Editor, PointerInput } from '@planewright/engine';

import type { Platform } from '../platform/platform.ts';
import { keyInput, pointerInput, wheelInput } from './input-adapter.ts';
import type { KeySource } from './input-adapter.ts';

// The canvas host's DOM listeners (ADR 0008 decision 1): pointer events with capture, wheel events
// that never scroll the page, keys, the host's focus loss and the window's. A freehand stroke reads
// the coalesced moves of each pointer move, so that a fast stroke keeps every point the browser saw.

const POINTER_EVENTS = [
  ['pointerdown', 'pointer-down'],
  ['pointermove', 'pointer-move'],
  ['pointerup', 'pointer-up'],
  ['pointercancel', 'pointer-cancel'],
] as const;

/** Sends a key press to the editor and prevents the browser's default if a command took it. */
export function sendKeyDown(
  editor: Editor,
  platform: Platform,
  event: KeySource & { preventDefault(): void },
): boolean {
  const handled = editor.input(keyInput('key-down', event, platform));
  if (handled) event.preventDefault();
  return handled;
}

function onPointer(host: HTMLElement, type: PointerInput['type'], event: PointerEvent): void {
  if (type === 'pointer-down') {
    host.focus({ preventScroll: true });
    host.setPointerCapture(event.pointerId);
    // A middle press would start the browser's autoscroll.
    if (event.button === 1) event.preventDefault();
  } else if (type !== 'pointer-move' && host.hasPointerCapture(event.pointerId)) {
    host.releasePointerCapture(event.pointerId);
  }
}

/**
 * The moves that a pointer move stands for: its coalesced events while the freehand tool is
 * active, where the browser offers them, or the move itself.
 */
function movesOf(event: PointerEvent, editor: Editor): readonly PointerEvent[] {
  if (editor.view.tool !== 'freehand' || typeof event.getCoalescedEvents !== 'function') {
    return [event];
  }
  const coalesced = event.getCoalescedEvents();
  return coalesced.length > 0 ? coalesced : [event];
}

/**
 * Listens to the host's input and the window's focus; returns the function that stops it. Points
 * are relative to the scene canvas, which sits inside the host's border.
 */
export function attachInput(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  editor: Editor,
  platform: Platform,
): () => void {
  const box = (): DOMRect => canvas.getBoundingClientRect();
  const pointers = POINTER_EVENTS.map(([name, type]) => {
    const listener = (event: PointerEvent): void => {
      const events = type === 'pointer-move' ? movesOf(event, editor) : [event];
      const inputs = events.flatMap((each) => pointerInput(type, each, box(), platform) ?? []);
      if (inputs.length === 0) return;
      onPointer(host, type, event);
      for (const input of inputs) editor.input(input);
    };
    host.addEventListener(name, listener);
    return () => {
      host.removeEventListener(name, listener);
    };
  });
  const wheel = (event: WheelEvent): void => {
    if (editor.input(wheelInput(event, box(), platform))) event.preventDefault();
  };
  const keyDown = (event: KeyboardEvent): void => {
    // Space is held for camera drags, so it must not scroll the page either.
    if (!sendKeyDown(editor, platform, event) && event.code === 'Space') event.preventDefault();
  };
  const keyUp = (event: KeyboardEvent): void => {
    editor.input(keyInput('key-up', event, platform));
  };
  const blur = (): void => {
    editor.input({ type: 'focus-lost', time: performance.now() });
  };
  // A Space released after focus left the host never reaches it, and a held Space would turn every
  // later press into a camera drag (REQ-S05, REQ-S06, REQ-S10), so Space is let go with the focus.
  const letGoOfSpace = (): void => {
    const modifiers = { shift: false, alt: false, mod: false };
    const time = performance.now();
    editor.input({ type: 'key-up', key: ' ', code: 'Space', repeat: false, modifiers, time });
  };
  host.addEventListener('wheel', wheel, { passive: false });
  host.addEventListener('keydown', keyDown);
  host.addEventListener('keyup', keyUp);
  host.addEventListener('blur', letGoOfSpace);
  window.addEventListener('blur', blur);
  return () => {
    for (const stop of pointers) stop();
    host.removeEventListener('wheel', wheel);
    host.removeEventListener('keydown', keyDown);
    host.removeEventListener('keyup', keyUp);
    host.removeEventListener('blur', letGoOfSpace);
    window.removeEventListener('blur', blur);
  };
}

/**
 * Reports the scene canvas's CSS size and the device pixel ratio now and whenever that size changes.
 * The canvas has no border or padding, so its box is its content box, inside the host's border.
 */
export function observeSize(canvas: HTMLCanvasElement, editor: Editor): () => void {
  const report = (): void => {
    const { width, height } = canvas.getBoundingClientRect();
    editor.resize({ width, height, pixelRatio: window.devicePixelRatio });
  };
  const observer = new ResizeObserver(report);
  observer.observe(canvas);
  report();
  return () => {
    observer.disconnect();
  };
}
