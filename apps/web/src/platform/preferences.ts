// The preferences entry (ADR 0009 decision 4, docs/architecture/engine/persistence.md): one small
// localStorage entry, read and checked synchronously at start-up so that the first frame has the
// right theme, and written at once on change. It is never part of the document or the history
// (REQ-H04). P0 ships the light theme only and no view toggle, so the entry holds the theme alone
// and nothing in P0 changes it yet; the dark theme and the view toggles join it with their issues.

export const PREFERENCES_KEY = 'planewright:preferences';

/** The themes this build draws. */
const THEMES = ['light'] as const;

export interface Preferences {
  readonly theme: (typeof THEMES)[number];
}

export const DEFAULT_PREFERENCES: Preferences = { theme: 'light' };

const isTheme = (value: unknown): value is Preferences['theme'] =>
  THEMES.some((theme) => theme === value);

/** The stored preferences, each one checked; anything unreadable gives the defaults. */
export function readPreferences(storage: Pick<Storage, 'getItem'> | undefined): Preferences {
  let entry: unknown;
  try {
    entry = JSON.parse(storage?.getItem(PREFERENCES_KEY) ?? 'null');
  } catch {
    return DEFAULT_PREFERENCES;
  }
  const theme: unknown =
    typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'theme') : undefined;
  return isTheme(theme) ? { theme } : DEFAULT_PREFERENCES;
}

/** Writes the whole entry at once; false when storage refuses it or there is none. */
export function writePreferences(
  storage: Pick<Storage, 'setItem'> | undefined,
  preferences: Preferences,
): boolean {
  if (storage === undefined) return false;
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 1, theme: preferences.theme }));
    return true;
  } catch {
    return false;
  }
}

/** The page's localStorage, or undefined where reading it is refused. */
export function localStorageOf(page: { readonly localStorage?: Storage }): Storage | undefined {
  try {
    return page.localStorage;
  } catch {
    return undefined;
  }
}
