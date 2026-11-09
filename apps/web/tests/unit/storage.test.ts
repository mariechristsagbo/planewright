import { describe, expect, it } from 'vitest';

import { indexedDbOf, openStorage } from '../../src/platform/storage.ts';

// Opening storage at start-up where it cannot work (REQ-P02): the editor then works in memory,
// with a notice that nothing will be saved. The IndexedDB repository itself is tested end to end
// in Chromium, since no IndexedDB emulation is added (docs/architecture/engine/quality.md).

describe('openStorage', () => {
  it('without an IndexedDB factory opens a new drawing with nothing to save to', async () => {
    expect(await openStorage(undefined, () => 0)).toEqual({
      repository: undefined,
      stored: undefined,
      notice: 'unavailable',
    });
  });

  it('with a factory that cannot open the database does the same', async () => {
    const refusing = {
      open: () => {
        throw new DOMException('Storage is disabled.', 'SecurityError');
      },
    } as unknown as IDBFactory;
    expect(await openStorage(refusing, () => 0)).toEqual({
      repository: undefined,
      stored: undefined,
      notice: 'unavailable',
    });
  });
});

describe('indexedDbOf', () => {
  it('gives the page’s factory, or undefined where reading it throws', () => {
    const factory = {} as IDBFactory;
    expect(indexedDbOf({ indexedDB: factory })).toBe(factory);
    const refused = Object.defineProperty({}, 'indexedDB', {
      get: () => {
        throw new DOMException('Access is denied.', 'SecurityError');
      },
    });
    expect(indexedDbOf(refused)).toBeUndefined();
  });
});
