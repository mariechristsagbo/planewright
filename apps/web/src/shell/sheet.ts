import { useSyncExternalStore } from 'react';

/**
 * Where the Elements drawer is a sheet: a phone in portrait, under 600 px wide and at least 500 px
 * high (the v0.2 plan's S5). styles/responsive.css lays the sheet out under the same query, which
 * a tooling test keeps equal; a phone in landscape keeps the side drawer.
 */
export const SHEET_QUERY = '(max-width: 599px) and (min-height: 500px)';

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(SHEET_QUERY);
  media.addEventListener('change', listener);
  return () => {
    media.removeEventListener('change', listener);
  };
}

/** Whether the window is a phone in portrait now, as the style sheets read it. */
export const matchesSheet = (): boolean => window.matchMedia(SHEET_QUERY).matches;

/** Whether the drawer shows as the phone's sheet, following the window as it changes. */
export function useSheet(): boolean {
  return useSyncExternalStore(subscribe, matchesSheet);
}
