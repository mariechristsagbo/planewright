import { expect, test } from 'vitest';

import { createAutosave } from '../../src/persistence/autosave.ts';
import type { SaveStatus } from '../../src/persistence/autosave.ts';
import type { DocumentId } from '../../src/persistence/repository.ts';
import { createManualClock, createQueueScheduler } from '../support/fakes.ts';
import { NO_SESSION, memoryStorage } from '../support/memory-backend.ts';
import {
  BENCH_SCENE,
  benchElements,
  benchStore,
  recordBench,
  runOptions,
  shuttle,
} from '../support/perf-bench.ts';

// Budget B8 (docs/architecture/engine/quality.md#performance-budgets, REQ-F03): the main-thread
// time of autosaving a 50-element change, at most 4 ms. Before each sample, untimed, a committed
// change moves 50 of the 10,000 elements; each sample is the save that its timer starts: the delta
// taken from the pending changes, the save planned and its 50 element records encoded in the
// record repository's one transaction, and its result handled, over the in-memory record backend.
// The browser's IndexedDB writes are the long-task observer's part (B9).

const CHANGED = 50;
const DOCUMENT = 'PerfAutosave0000000000' as DocumentId;

test('B8 REQ-F03 the main-thread time of autosaving a 50-element change', async ({
  bench,
  task,
}) => {
  const elements = benchElements();
  const store = benchStore(elements);
  const clock = createManualClock();
  const scheduler = createQueueScheduler(clock);
  const storage = memoryStorage();
  let saved: (() => void) | undefined;
  const statuses: SaveStatus['type'][] = [];
  createAutosave({
    ...{ id: DOCUMENT, rev: 0, store, clock, scheduler },
    repository: storage.repository,
    session: () => NO_SESSION,
    onStatus: ({ type }) => {
      statuses.push(type);
      if (type === 'saved') saved?.();
    },
  });
  const changing = elements.slice(0, CHANGED);
  const [forth, back] = shuttle(changing, 1, 0);
  const state = { moved: false };
  const change = () => {
    store.apply(state.moved ? back : forth, 'local');
    state.moved = !state.moved;
  };

  const result = await bench(
    'B8 autosave of a 50-element change, main-thread time',
    { beforeEach: change },
    async () => {
      const done = new Promise<void>((resolve) => {
        saved = resolve;
      });
      scheduler.advance(300);
      await done;
    },
  ).run(runOptions(300));

  const stored = storage.read(DOCUMENT);
  expect(stored.type).toBe('loaded');
  const shift = state.moved ? 1 : 0;
  const xs = changing.map(({ id }) =>
    stored.type === 'loaded' ? stored.stored.document.elements.get(id)?.x : undefined,
  );
  expect(xs).toEqual(changing.map(({ x }) => x + shift));
  expect(statuses.filter((type) => type !== 'pending' && type !== 'saved')).toEqual([]);
  recordBench(
    task.meta,
    {
      budget: 'B8',
      seed: BENCH_SCENE.seed,
      elements: BENCH_SCENE.count,
      checked: `every save succeeded, and storage read back through the codec holds the ${String(CHANGED)} elements where the last change put them`,
    },
    result,
  );
});
