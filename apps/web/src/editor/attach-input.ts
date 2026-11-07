import type { Editor, PointerInput } from '@planewright/engine';

import type { Platform } from '../platform/platform.ts';
import { keyInput, pointerInput, wheelInput } from './input-adapter.ts';
import type { KeySource } from './input-adapter.ts';

// The canvas host's DOM listeners (ADR 0008 decision 1): pointer events with capture, wheel events
// that never scroll the page, keys, and the window's focus loss.

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

/** Listens to the host's input and the window's focus; returns the function that stops it. */
export function attachInput(host: HTMLElement, editor: Editor, platform: Platform): () => void {
  const box = (): DOMRect => host.getBoundingClientRect();
  const pointers = POINTER_EVENTS.map(([name, type]) => {
    const listener = (event: PointerEvent): void => {
      const input = pointerInput(type, event, box(), platform);
      if (input === null) return;
      onPointer(host, type, event);
      editor.input(input);
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
  host.addEventListener('wheel', wheel, { passive: false });
  host.addEventListener('keydown', keyDown);
  host.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  return () => {
    for (const stop of pointers) stop();
    host.removeEventListener('wheel', wheel);
    host.removeEventListener('keydown', keyDown);
    host.removeEventListener('keyup', keyUp);
    window.removeEventListener('blur', blur);
  };
}

/** Reports the host's size and the device pixel ratio now and whenever the size changes. */
export function observeSize(host: HTMLElement, editor: Editor): () => void {
  const report = (): void => {
    const { width, height } = host.getBoundingClientRect();
    editor.resize({ width, height, pixelRatio: window.devicePixelRatio });
  };
  const observer = new ResizeObserver(report);
  observer.observe(host);
  report();
  return () => {
    observer.disconnect();
  };
}
