import { planSave } from './records.ts';
import type { RecordBackend } from './records.ts';
import type { DocumentRepository } from './repository.ts';
import { readStored } from './stored.ts';

// A document repository over a record backend (docs/architecture/engine/persistence.md): the
// revision rule and the codec live here, so the web app's IndexedDB adapter only reads and writes
// records, and the tests' in-memory backend applies exactly the same rule.

/**
 * The repository: loading reads the backend's latest records through the codec, and storage that
 * cannot be opened is `unavailable`; saving plans its writes from the stored record inside the
 * backend's transaction, and a backend that throws is a failed save, never a silent one.
 */
export function createRecordRepository(backend: RecordBackend): DocumentRepository {
  return {
    async load() {
      let found;
      try {
        found = await backend.latest();
      } catch {
        return { type: 'unavailable' };
      }
      return readStored(found);
    },
    async save(request) {
      try {
        return await backend.transact(request.id, (stored) => planSave(stored, request));
      } catch {
        return { ok: false, reason: 'failed' };
      }
    },
  };
}
