import { createRecordRepository } from '@planewright/engine';
import type { DocumentRepository, StoredDocument } from '@planewright/engine';

import { indexedDbBackend } from './indexeddb.ts';

// Opening the page's storage at start-up (docs/architecture/engine/persistence.md#loading): the
// most recently updated drawing, or why there is none to open.

/** Why the page opened a new drawing although storage was asked for one. */
export type StorageNotice = 'unavailable' | 'invalid';

export interface Storage {
  /** Where the editor saves, or undefined when nothing can be saved. */
  readonly repository: DocumentRepository | undefined;
  /** The drawing to open, or undefined for a new one. */
  readonly stored: StoredDocument | undefined;
  readonly notice: StorageNotice | null;
}

/** The page's IndexedDB factory, or undefined where reading it is refused or it is missing. */
export function indexedDbOf(page: { readonly indexedDB?: IDBFactory }): IDBFactory | undefined {
  try {
    return page.indexedDB;
  } catch {
    return undefined;
  }
}

/**
 * Loads the latest drawing. Invalid stored data is left as it is and a new drawing opens beside it
 * with a notice; storage that cannot be opened leaves the editor working in memory, with a notice
 * that nothing will be saved (REQ-P02, REQ-P07).
 */
export async function openStorage(
  factory: IDBFactory | undefined,
  now: () => number,
): Promise<Storage> {
  if (factory === undefined)
    return { repository: undefined, stored: undefined, notice: 'unavailable' };
  const repository = createRecordRepository(indexedDbBackend(factory, now));
  const result = await repository.load();
  switch (result.type) {
    case 'loaded':
      return { repository, stored: result.stored, notice: null };
    case 'empty':
      return { repository, stored: undefined, notice: null };
    case 'invalid':
      return { repository, stored: undefined, notice: 'invalid' };
    case 'unavailable':
      return { repository: undefined, stored: undefined, notice: 'unavailable' };
  }
}
