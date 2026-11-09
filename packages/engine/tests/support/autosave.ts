import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import { createAutosave } from '../../src/persistence/autosave.ts';
import type { Autosave, SaveStatus } from '../../src/persistence/autosave.ts';
import type {
  DocumentId,
  DocumentRepository,
  SaveRequest,
  SessionState,
} from '../../src/persistence/repository.ts';
import { createSceneStore } from '../../src/scene/store.ts';
import type { SceneStore } from '../../src/scene/store.ts';
import { shapeElement, testId } from './elements.ts';
import { createManualClock, createQueueScheduler } from './fakes.ts';
import type { ManualClock, QueueScheduler } from './fakes.ts';
import { NO_SESSION, memoryStorage, seed } from './memory-backend.ts';
import type { MemoryStorage } from './memory-backend.ts';
import { changeSet, color } from './scene-state.ts';
import { documentOf } from './selection-scene.ts';

// An autosave scheduler over a scene store, a fake clock and scheduler, and the in-memory
// repository, whose saves a test can hold back and release.

export const DOCUMENT = 'D000000000000000000001' as DocumentId;

export const square = (id: number, x = 0): Element => shapeElement('rectangle', 10, 10, { id, x });

export interface AutosaveHarness {
  readonly store: SceneStore;
  readonly clock: ManualClock;
  readonly scheduler: QueueScheduler;
  readonly storage: MemoryStorage;
  readonly autosave: Autosave;
  /** Every status the scheduler reported, in order. */
  readonly statuses: SaveStatus[];
  /** Every request that reached the repository, in order. */
  readonly requests: SaveRequest[];
  /** What the scheduler reads as the session. */
  session: SessionState;
  /** From now on saves wait until `release`. */
  readonly hold: () => void;
  /** Lets the waiting saves through and lets their results arrive. */
  readonly release: () => Promise<void>;
  /** Moves the clock, running due timers, then lets save results arrive. */
  readonly advance: (ms: number) => Promise<void>;
}

/** Lets pending promise callbacks run. */
export async function settle(): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
}

/** A local change that moves an element to `x`, as a committed gesture would. */
export function moveTo(store: SceneStore, id: ElementId, x: number, transient = false): void {
  const before = { x: store.get(id)?.x ?? 0 };
  const changes = changeSet([{ type: 'update', id, before, after: { x } }]);
  store.apply(changes, 'local', { transient });
}

export const add = (store: SceneStore, element: Element): void => {
  store.apply(changeSet([{ type: 'add', element }]), 'local');
};

/** A store holding squares 1 and 2, stored at `rev`, and a scheduler that builds on that revision. */
export function autosaveHarness(rev = 1): AutosaveHarness {
  const clock = createManualClock();
  const scheduler = createQueueScheduler(clock);
  const storage = memoryStorage();
  const document = documentOf(square(1), square(2, 50));
  seed(storage.backend, { id: DOCUMENT, rev, document });
  const store = createSceneStore({ background: color('#ffffff') });
  const adds = [...document.elements.values()].map(
    (element) => ({ type: 'add', element }) as const,
  );
  store.apply(changeSet(adds), 'load');
  const waiting: (() => void)[] = [];
  let held = false;
  const requests: SaveRequest[] = [];
  const repository: DocumentRepository = {
    load: () => storage.repository.load(),
    save: (request) => {
      requests.push(request);
      if (!held) return storage.repository.save(request);
      return new Promise((resolve) => {
        waiting.push(() => {
          resolve(storage.repository.save(request));
        });
      });
    },
  };
  const statuses: SaveStatus[] = [];
  const harness: AutosaveHarness = {
    store,
    clock,
    scheduler,
    storage,
    statuses,
    requests,
    session: NO_SESSION,
    autosave: createAutosave({
      id: DOCUMENT,
      rev,
      store,
      clock,
      scheduler,
      repository,
      session: () => harness.session,
      onStatus: (status) => statuses.push(status),
    }),
    hold: () => {
      held = true;
    },
    release: async () => {
      held = false;
      for (const run of waiting.splice(0)) run();
      await settle();
    },
    advance: async (ms) => {
      scheduler.advance(ms);
      await settle();
    },
  };
  return harness;
}

/** The x of an element as stored, read back through the codec. */
export function storedX(harness: AutosaveHarness, index: number): number | undefined {
  const result = harness.storage.read(DOCUMENT);
  return result.type === 'loaded'
    ? result.stored.document.elements.get(testId(index))?.x
    : undefined;
}

/** The stored revision of the document. */
export function storedRev(harness: AutosaveHarness): number | undefined {
  const result = harness.storage.read(DOCUMENT);
  return result.type === 'loaded' ? result.stored.rev : undefined;
}
