import { act } from '@testing-library/react';
import { onTestFinished, vi } from 'vitest';

import { SHEET_QUERY } from '../../src/shell/sheet.ts';

// The page's media queries as a viewport answers them, for the shell's unit tests in jsdom, which
// has no matchMedia: only the phone sheet's query matches, and only on a phone in portrait. The
// viewport can change during a test, as a window that turns or is resized does.

/**
 * Answers the phone sheet's query, and gives the way to change the answer and tell its listeners;
 * `between` runs once the query answers anew and before its listeners hear of it, as when a
 * browser applies the new style before the query's change event, which Chromium does at times.
 */
export function phoneQuery(phone: boolean): (next: boolean, between?: () => void) => void {
  let matches = phone;
  const listeners = new Set<() => void>();
  const answer = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: matches && query === SHEET_QUERY,
        media: query,
        addEventListener: (_type: string, listener: () => void) => {
          listeners.add(listener);
        },
        removeEventListener: (_type: string, listener: () => void) => {
          listeners.delete(listener);
        },
      }) as Partial<MediaQueryList> as MediaQueryList,
  );
  onTestFinished(() => {
    answer.mockRestore();
  });
  return (next, between) => {
    matches = next;
    if (between !== undefined) act(between);
    act(() => {
      for (const listener of [...listeners]) listener();
    });
  };
}
