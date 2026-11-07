import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver; the canvas host reports its size once on mount, which is enough.
class StillResizeObserver {
  observe(): void {
    // Nothing is ever resized in jsdom.
  }
  unobserve(): void {
    // Nothing to stop.
  }
  disconnect(): void {
    // Nothing to stop.
  }
}
vi.stubGlobal('ResizeObserver', StillResizeObserver);
