import type { DocumentState } from '../../src/model/document.ts';
import { createRecordRepository } from '../../src/persistence/record-repository.ts';
import { planSave } from '../../src/persistence/records.ts';
import type { RecordBackend } from '../../src/persistence/records.ts';
import type {
  DocumentId,
  DocumentRepository,
  LoadResult,
  SaveResult,
  SessionState,
} from '../../src/persistence/repository.ts';
import { readStored } from '../../src/persistence/stored.ts';

// The tests' storage: records in maps, written in one synchronous step per transaction, so a
// transaction is atomic as an IndexedDB one is. The repository over it applies the same revision
// rule and codec as the web app's (docs/architecture/engine/modules.md#ports).

type StoredRecord = Readonly<Record<string, unknown>>;

export interface MemoryBackend extends RecordBackend {
  /** Document records by identifier, each with its `updated` count. */
  readonly records: Map<string, StoredRecord>;
  /** Element records by document, then by element identifier. */
  readonly elements: Map<string, Map<string, unknown>>;
  /** How many transactions have written anything. */
  readonly writes: () => number;
  /** The next `times` transactions throw, or report `outcome`, and write nothing. */
  readonly fail: (outcome: SaveResult | 'throw', times?: number) => void;
  /** From now on `latest` rejects, as storage that cannot be opened does. */
  readonly close: () => void;
}

export function createMemoryBackend(): MemoryBackend {
  const records = new Map<string, StoredRecord>();
  const elements = new Map<string, Map<string, unknown>>();
  let tick = 0;
  let writes = 0;
  let closed = false;
  const failures: (SaveResult | 'throw')[] = [];
  const latest = (): string | undefined =>
    [...records].sort(([, a], [, b]) => Number(b['updated']) - Number(a['updated']))[0]?.[0];
  return {
    records,
    elements,
    writes: () => writes,
    fail: (outcome, times = 1) => failures.push(...Array.from({ length: times }, () => outcome)),
    close: () => {
      closed = true;
    },
    latest() {
      if (closed) return Promise.reject(new Error('The storage cannot be opened.'));
      const id = latest();
      if (id === undefined) return Promise.resolve(null);
      const record = records.get(id);
      return Promise.resolve({ record, elements: [...(elements.get(id)?.values() ?? [])] });
    },
    transact(id, plan) {
      const failure = failures.shift();
      if (failure === 'throw') return Promise.reject(new Error('The transaction failed.'));
      if (failure !== undefined) return Promise.resolve(failure);
      const planned = plan(records.get(id));
      if (planned.type === 'none') return Promise.resolve(planned.result);
      const held = planned.clear ? new Map<string, unknown>() : new Map(elements.get(id));
      for (const removed of planned.remove) held.delete(removed);
      for (const record of planned.put) held.set(record.id, record);
      elements.set(id, held);
      records.set(id, { ...planned.record, updated: (tick += 1) });
      writes += 1;
      return Promise.resolve(planned.result);
    },
  };
}

export const NO_SESSION: SessionState = { camera: { x: 0, y: 0, zoom: 1 }, selection: [] };

export interface MemoryStorage {
  readonly backend: MemoryBackend;
  readonly repository: DocumentRepository;
  /** The stored document under an identifier, read back through the codec. */
  readonly read: (id: DocumentId) => LoadResult;
}

export function memoryStorage(): MemoryStorage {
  const backend = createMemoryBackend();
  return {
    backend,
    repository: createRecordRepository(backend),
    read: (id) => {
      const record = backend.records.get(id);
      const found =
        record === undefined
          ? null
          : { record, elements: [...(backend.elements.get(id)?.values() ?? [])] };
      return readStored(found);
    },
  };
}

/** Stores a document at a revision, as if it had been saved that many times. */
export function seed(
  backend: MemoryBackend,
  stored: { readonly id: DocumentId; readonly rev: number; readonly document: DocumentState },
  session: SessionState = NO_SESSION,
): void {
  const planned = planSave(undefined, { type: 'replace', baseRev: 0, ...stored, session });
  if (planned.type !== 'write') throw new Error('A new document is always written.');
  backend.elements.set(stored.id, new Map(planned.put.map((record) => [record.id, record])));
  backend.records.set(stored.id, { ...planned.record, rev: stored.rev, updated: 0 });
}
