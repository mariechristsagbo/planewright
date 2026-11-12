import { act } from '@testing-library/react';
import { onTestFinished } from 'vitest';

// An emulated on-screen keyboard for the Done bar's unit tests (the v0.2 plan's S9): jsdom has no
// visualViewport, and its documentElement is 0 px high, so a test gives the window a visual
// viewport, an EventTarget with a height and an offset, and the layout viewport a height, and
// counts the listeners that the page holds on the visual viewport.

export interface KeyboardControls {
  /** Moves the visual viewport and tells its listeners, as the browser does with `type`. */
  readonly move: (
    heights: { height?: number; offsetTop?: number },
    type: 'resize' | 'scroll',
  ) => void;
  /** How many listeners the page holds on the visual viewport now. */
  readonly listeners: () => number;
}

/** A visual viewport of this height and offset over a layout viewport of `layout` px. */
export function emulateKeyboard(layout: number, height: number, offsetTop = 0): KeyboardControls {
  const viewport = new EventTarget();
  let state = { height, offsetTop };
  let held = 0;
  const add = viewport.addEventListener.bind(viewport);
  const remove = viewport.removeEventListener.bind(viewport);
  Object.defineProperties(viewport, {
    height: { get: () => state.height },
    offsetTop: { get: () => state.offsetTop },
    addEventListener: {
      value: (...args: Parameters<EventTarget['addEventListener']>) => {
        held += 1;
        add(...args);
      },
    },
    removeEventListener: {
      value: (...args: Parameters<EventTarget['removeEventListener']>) => {
        held -= 1;
        remove(...args);
      },
    },
  });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => layout,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(window, 'visualViewport');
    Reflect.deleteProperty(document.documentElement, 'clientHeight');
  });
  return {
    move: (heights, type) => {
      state = { ...state, ...heights };
      act(() => {
        viewport.dispatchEvent(new Event(type));
      });
    },
    listeners: () => held,
  };
}
