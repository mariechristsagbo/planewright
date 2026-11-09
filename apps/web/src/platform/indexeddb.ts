import type {
  DocumentId,
  ElementRecord,
  RecordBackend,
  SaveFailure,
  SavePlan,
  SaveResult,
} from '@planewright/engine';

// The IndexedDB record backend (docs/architecture/engine/persistence.md#indexeddb-layout): the
// database `planewright`, version 1, with a `documents` store keyed by identifier, an `elements`
// store keyed by document and element and indexed by document, and a `files` store for P2. The
// engine's record repository checks revisions and decodes; this module only reads and writes
// records, each save in one `readwrite` transaction. It is tested end to end in Chromium.

export const DATABASE = 'planewright';
export const VERSION = 1;

/** How many element records a transaction writes before it waits for them to land. */
const BATCH = 500;

/** Creates the stores of version 1; later versions migrate here, inside the upgrade. */
function upgrade(database: IDBDatabase): void {
  database.createObjectStore('documents', { keyPath: 'id' });
  const elements = database.createObjectStore('elements', { keyPath: ['document', 'id'] });
  elements.createIndex('document', 'document');
  database.createObjectStore('files');
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      upgrade(request.result);
    };
    request.onsuccess = () => {
      const database = request.result;
      // A newer version opened in another tab may upgrade: this one steps aside.
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('The database could not be opened.'));
    };
    request.onblocked = () => {
      reject(new Error('Another tab holds an older version of the database open.'));
    };
  });
}

const failureOf = (error: DOMException | null): SaveFailure =>
  error?.name === 'QuotaExceededError' ? 'quota' : 'failed';

/** Every element record of a document: keys from [id] up to, not including, [id, []]. */
const ofDocument = (id: DocumentId): IDBKeyRange => IDBKeyRange.bound([id], [id, []]);

/**
 * Writes the element records in batches, each started once the last request of the one before
 * has landed, so that a replacement of many elements never holds the page for long.
 */
function putInBatches(store: IDBObjectStore, records: readonly ElementRecord[], from = 0): void {
  const batch = records.slice(from, from + BATCH);
  const requests = batch.map((record) => store.put(record));
  const last = requests.at(-1);
  if (last !== undefined && from + BATCH < records.length) {
    last.onsuccess = () => {
      putInBatches(store, records, from + BATCH);
    };
  }
}

/** Carries out what the plan says to write, all in the transaction that read the record. */
function write(
  transaction: IDBTransaction,
  id: DocumentId,
  plan: Extract<SavePlan, { readonly type: 'write' }>,
  updated: number,
): void {
  const documents = transaction.objectStore('documents');
  const elements = transaction.objectStore('elements');
  documents.put({ ...plan.record, updated });
  if (plan.clear) elements.delete(ofDocument(id));
  for (const removed of plan.remove) elements.delete([id, removed]);
  putInBatches(elements, plan.put);
}

/** The newest document record by its update time, with its element records, or null. */
function readLatest(
  database: IDBDatabase,
): Promise<{ record: unknown; elements: unknown[] } | null> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['documents', 'elements'], 'readonly');
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('The stored drawing could not be read.'));
    };
    const all = transaction.objectStore('documents').getAll();
    all.onsuccess = () => {
      const records = all.result as Readonly<Record<string, unknown>>[];
      const newest = records.reduce<Readonly<Record<string, unknown>> | undefined>(
        (best, record) =>
          best === undefined || Number(record['updated']) > Number(best['updated']) ? record : best,
        undefined,
      );
      if (newest === undefined) {
        resolve(null);
        return;
      }
      const index = transaction.objectStore('elements').index('document');
      const elements = index.getAll(IDBKeyRange.only(newest['id']));
      elements.onsuccess = () => {
        resolve({ record: newest, elements: elements.result });
      };
    };
  });
}

/** One save: read the record, ask the plan, write, and report once the transaction completes. */
function transactOn(
  database: IDBDatabase,
  id: DocumentId,
  plan: (record: unknown) => SavePlan,
  now: () => number,
): Promise<SaveResult> {
  return new Promise((resolve) => {
    const transaction = database.transaction(['documents', 'elements'], 'readwrite');
    let result: SaveResult = { ok: false, reason: 'failed' };
    transaction.oncomplete = () => {
      resolve(result);
    };
    transaction.onabort = () => {
      resolve({ ok: false, reason: failureOf(transaction.error) });
    };
    const read = transaction.objectStore('documents').get(id);
    read.onsuccess = () => {
      try {
        const planned = plan(read.result);
        result = planned.result;
        if (planned.type === 'write') write(transaction, id, planned, now());
      } catch {
        transaction.abort();
      }
    };
  });
}

/**
 * The backend over a browser's IndexedDB factory and wall clock, whose time orders documents by
 * their last update across tabs and sessions. The database opens on first use; a failed open is
 * tried again by the next call.
 */
export function indexedDbBackend(factory: IDBFactory, now: () => number): RecordBackend {
  let database: Promise<IDBDatabase> | undefined;
  const opened = (): Promise<IDBDatabase> => {
    database ??= open(factory).catch((error: unknown) => {
      database = undefined;
      throw error;
    });
    return database;
  };
  return {
    latest: async () => readLatest(await opened()),
    async transact(id, plan) {
      let db: IDBDatabase;
      try {
        db = await opened();
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
      return transactOn(db, id, plan, now);
    },
  };
}
