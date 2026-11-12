import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';

// The on-screen keyboard's inset (the v0.2 plan's S9 and responsive rule 5): how much of the layout
// viewport's bottom lies under the visual viewport, which a phone's keyboard shrinks or a pinch
// zoom moves, so that the Done bar can sit above it at `bottom: var(--kb)`. Nothing else moves for
// the keyboard: no camera, no scroll and no text area (ADR 0012, D6).

/** The heights that the inset is read from, in CSS pixels. */
export interface ViewportHeights {
  /** The layout viewport's height, as document.documentElement.clientHeight gives it. */
  readonly layoutHeight: number;
  readonly visualHeight: number;
  /** How far down the layout viewport the visual viewport starts. */
  readonly offsetTop: number;
}

/** The part of the layout viewport under the visual viewport, never below 0; 0 without one. */
export function keyboardInset(heights: ViewportHeights | null): number {
  if (heights === null) return 0;
  return Math.max(0, heights.layoutHeight - heights.visualHeight - heights.offsetTop);
}

/** What the inset is read from in a window, whose visual viewport may be missing. */
interface ViewportWindow {
  readonly visualViewport?: VisualViewport | null;
  readonly document: Document;
}

/** The window's heights now, or null where it has no visual viewport. */
function heightsOf({ visualViewport, document }: ViewportWindow): ViewportHeights | null {
  if (visualViewport === undefined || visualViewport === null) return null;
  return {
    layoutHeight: document.documentElement.clientHeight,
    visualHeight: visualViewport.height,
    offsetTop: visualViewport.offsetTop,
  };
}

/**
 * Writes the keyboard's inset into an element's --kb, in px, before the first paint and at each of
 * the visual viewport's resize and scroll events, for as long as the element is mounted. It holds no
 * React state, so that a viewport event renders nothing, and --kb is declared nowhere else.
 */
export function useKeyboardInset(element: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const target = element.current;
    const viewport: ViewportWindow = window;
    const write = (): void => {
      target?.style.setProperty('--kb', `${String(keyboardInset(heightsOf(viewport)))}px`);
    };
    write();
    const visual = viewport.visualViewport;
    if (visual === undefined || visual === null) return undefined;
    visual.addEventListener('resize', write);
    visual.addEventListener('scroll', write);
    return () => {
      visual.removeEventListener('resize', write);
      visual.removeEventListener('scroll', write);
    };
  }, [element]);
}
