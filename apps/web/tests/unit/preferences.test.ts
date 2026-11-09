import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  localStorageOf,
  readPreferences,
  writePreferences,
} from '../../src/platform/preferences.ts';

// The preferences entry (ADR 0009 decision 4): one localStorage entry, read and checked
// synchronously at start-up and written at once on change; never part of the document or the
// history (REQ-H04). P0 ships the light theme only, so that is all it can hold.

/** A storage over a map, which can refuse every call as a disabled storage does. */
function storage(entries: Record<string, string> = {}, refuse = false) {
  const map = new Map(Object.entries(entries));
  const check = () => {
    if (refuse) throw new DOMException('Storage is disabled.', 'SecurityError');
  };
  return {
    map,
    getItem: (key: string) => {
      check();
      return map.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      check();
      map.set(key, value);
    },
  };
}

describe('reading the preferences entry', () => {
  it('REQ-H04 gives the stored light theme', () => {
    const stored = storage({ [PREFERENCES_KEY]: '{"version":1,"theme":"light"}' });
    expect(PREFERENCES_KEY).toBe('planewright:preferences');
    expect(readPreferences(stored)).toEqual({ theme: 'light' });
  });

  it.each([
    ['no entry', storage()],
    ['no storage', undefined],
    ['a storage that refuses to be read', storage({}, true)],
    ['text that is not JSON', storage({ [PREFERENCES_KEY]: '{theme' })],
    ['JSON that is not an object', storage({ [PREFERENCES_KEY]: '["light"]' })],
    ['a theme P0 does not ship', storage({ [PREFERENCES_KEY]: '{"version":1,"theme":"dark"}' })],
    ['a theme of the wrong type', storage({ [PREFERENCES_KEY]: '{"version":1,"theme":7}' })],
  ])('gives the defaults for %s', (_, from) => {
    expect(readPreferences(from)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('writing the preferences entry', () => {
  it('writes the whole entry at once, and says whether storage took it', () => {
    const target = storage();
    expect(writePreferences(target, { theme: 'light' })).toBe(true);
    expect(target.map.get(PREFERENCES_KEY)).toBe('{"version":1,"theme":"light"}');
    expect(readPreferences(target)).toEqual({ theme: 'light' });
    expect(writePreferences(storage({}, true), { theme: 'light' })).toBe(false);
    expect(writePreferences(undefined, { theme: 'light' })).toBe(false);
  });
});

describe('localStorageOf', () => {
  it('gives the page’s storage, or undefined where reading it throws', () => {
    const local = {} as Storage;
    expect(localStorageOf({ localStorage: local })).toBe(local);
    const refused = Object.defineProperty({}, 'localStorage', {
      get: () => {
        throw new DOMException('Access is denied.', 'SecurityError');
      },
    });
    expect(localStorageOf(refused)).toBeUndefined();
  });
});
