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

// jsdom does not scroll, and has no scrollIntoView; the element list scrolls its active option into
// view.
Element.prototype.scrollIntoView = function scrollIntoView(): void {
  // Nothing scrolls in jsdom.
};

// jsdom has no modal dialogs (About this build is one): showing one opens it, and closing it fires
// its close event, as a browser does.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
  if (!this.hasAttribute('open')) return;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};
