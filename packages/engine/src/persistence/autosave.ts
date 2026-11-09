import type { Cancel, Clock, Scheduler } from '../ports/ports.ts';
import type { SceneStore } from '../scene/store.ts';
import { createPending } from './pending.ts';
import type { Pending, Taken } from './pending.ts';
import type {
  DocumentId,
  DocumentRepository,
  SaveFailure,
  SaveRequest,
  SaveResult,
  SessionState,
} from './repository.ts';

// The autosave scheduler (docs/architecture/engine/persistence.md#autosave): clean, dirty or
// saving; a save 300 ms after the last committed change and never later than 1 s after the first
// unsaved one (REQ-P01); session state with the next save or 1 s after the last camera or
// selection change; failures retried with back-off and reported (REQ-P05); a stale refusal stops
// every save until the user chooses (REQ-P06). Time and timers come only through the ports.

/** What the interface shows about saving. */
export type SaveStatus =
  /** Nothing waits to be saved. */
  | { readonly type: 'saved' }
  /** Changes wait for their save, or are being saved. */
  | { readonly type: 'pending' }
  /** The last save failed; the changes are kept and the save is retried. */
  | { readonly type: 'failed'; readonly reason: SaveFailure }
  /** Another tab saved a newer version: nothing is saved until the user chooses. */
  | { readonly type: 'stale' };

export interface AutosaveOptions {
  readonly id: DocumentId;
  /** The stored revision that was loaded, 0 for a new document. */
  readonly rev: number;
  /** The store, holding the loaded document and no preview. */
  readonly store: SceneStore;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly repository: DocumentRepository;
  /** The camera and selection as they are now. */
  readonly session: () => SessionState;
  readonly onStatus: (status: SaveStatus) => void;
}

export interface Autosave {
  readonly status: SaveStatus;
  /** Starts a waiting save at once, as when the page is hidden or unloaded. */
  saveNow(): void;
  /** The camera or the selection changed. */
  sessionChanged(): void;
  /** After a stale refusal: saves this whole document over the stored one. */
  keep(): void;
  /** The store now holds this stored document and revision: nothing waits any more. */
  reset(id: DocumentId, rev: number): void;
  dispose(): void;
}

const LAST_CHANGE_DELAY = 300;
const FIRST_CHANGE_CEILING = 1_000;
const SESSION_DELAY = 1_000;
const RETRY_DELAYS = [1_000, 2_000, 4_000, 8_000, 16_000];
const LAST_RETRY_DELAY = 30_000;

const SAVED: SaveStatus = { type: 'saved' };

interface State {
  id: DocumentId;
  /** The stored revision that the next delta or replacement builds on. */
  base: number;
  phase: 'idle' | 'saving' | 'stale';
  /** The next save writes the whole document, after the user kept this version. */
  replace: boolean;
  /** The stored revision that the last stale refusal reported. */
  storedRev: number;
  failure: SaveFailure | null;
  attempts: number;
  firstChange: number | null;
  lastChange: number;
  sessionDirty: boolean;
  lastSession: number;
  /** Whether the save in flight carries document changes. */
  savingDocument: boolean;
  timer: Cancel | null;
  /** Raised by reset and dispose, so that a result from before is ignored. */
  generation: number;
  disposed: boolean;
  status: SaveStatus;
}

const sameStatus = (a: SaveStatus, b: SaveStatus): boolean =>
  a.type === b.type && (a.type !== 'failed' || b.type !== 'failed' || a.reason === b.reason);

/** The scheduler's parts: its options, its state and what it has to save. */
interface Machine {
  readonly options: AutosaveOptions;
  readonly state: State;
  readonly pending: Pending;
}

function statusOf({ state, pending }: Machine): SaveStatus {
  if (state.phase === 'stale') return { type: 'stale' };
  if (state.failure !== null) return { type: 'failed', reason: state.failure };
  const waiting = pending.dirty() || state.replace || state.savingDocument;
  return waiting ? { type: 'pending' } : SAVED;
}

function report(machine: Machine): void {
  const next = statusOf(machine);
  if (sameStatus(next, machine.state.status)) return;
  machine.state.status = next;
  machine.options.onStatus(next);
}

function stopTimer(state: State): void {
  state.timer?.();
  state.timer = null;
}

/** When the next save is due, or null when nothing waits. */
function dueTime({ state, pending }: Machine): number | null {
  if (pending.dirty() || state.replace) {
    const first = state.firstChange ?? state.lastChange;
    return Math.min(state.lastChange + LAST_CHANGE_DELAY, first + FIRST_CHANGE_CEILING);
  }
  return state.sessionDirty ? state.lastSession + SESSION_DELAY : null;
}

/** Sets the timer for the next save; a failed save's retry timer is left as it is. */
function schedule(machine: Machine): void {
  const { state, options } = machine;
  if (state.disposed || state.phase !== 'idle' || state.failure !== null) return;
  stopTimer(state);
  const due = dueTime(machine);
  if (due === null) return;
  const delay = Math.max(0, due - options.clock.now());
  state.timer = options.scheduler.after(delay, () => {
    state.timer = null;
    flush(machine);
  });
}

/** The save that the waiting changes need, with the changes it takes, or null. */
function nextRequest({ options, state, pending }: Machine) {
  const session = options.session();
  const { id, base: baseRev } = state;
  if (state.replace) {
    const document = pending.document();
    return {
      request: { type: 'replace', id, baseRev, document, session },
      taken: pending.take().taken,
    } as const;
  }
  if (pending.dirty()) {
    const { delta, taken } = pending.take();
    return { request: { type: 'delta', id, baseRev, delta, session }, taken } as const;
  }
  return state.sessionDirty
    ? ({ request: { type: 'session', id, session }, taken: null } as const)
    : null;
}

/** Starts the save of whatever waits, unless a save runs or autosave is stopped. */
function flush(machine: Machine): void {
  const { state, options } = machine;
  if (state.disposed || state.phase !== 'idle') return;
  const next = nextRequest(machine);
  if (next === null) return;
  stopTimer(state);
  state.sessionDirty = false;
  state.firstChange = null;
  state.phase = 'saving';
  state.savingDocument = next.request.type !== 'session';
  report(machine);
  const { generation } = state;
  const done = (result: SaveResult): void => {
    if (generation === state.generation) finish(machine, next, result);
  };
  options.repository.save(next.request).then(done, () => {
    done({ ok: false, reason: 'failed' });
  });
}

/** A failed save: its changes wait again, and it is retried after the next back-off delay. */
function retryLater(machine: Machine, reason: SaveFailure): void {
  const { state, options } = machine;
  state.failure = reason;
  state.attempts += 1;
  const delay = RETRY_DELAYS[state.attempts - 1] ?? LAST_RETRY_DELAY;
  state.timer = options.scheduler.after(delay, () => {
    state.timer = null;
    flush(machine);
  });
}

function finish(
  machine: Machine,
  { request, taken }: { readonly request: SaveRequest; readonly taken: Taken | null },
  result: SaveResult,
): void {
  const { state, pending } = machine;
  state.phase = 'idle';
  state.savingDocument = false;
  if (result.ok) {
    state.failure = null;
    state.attempts = 0;
    // A session save reports the stored revision without checking it, so it never moves the base.
    if (request.type !== 'session') {
      state.base = result.rev;
      state.replace = false;
    }
    schedule(machine);
  } else {
    if (taken !== null) pending.giveBack(taken);
    state.sessionDirty = true;
    if (result.reason === 'stale') {
      state.phase = 'stale';
      state.storedRev = result.storedRev;
    } else {
      retryLater(machine, result.reason);
    }
  }
  report(machine);
}

function initialState(options: AutosaveOptions): State {
  return {
    id: options.id,
    base: options.rev,
    phase: 'idle',
    replace: false,
    storedRev: options.rev,
    failure: null,
    attempts: 0,
    firstChange: null,
    lastChange: 0,
    sessionDirty: false,
    lastSession: 0,
    savingDocument: false,
    timer: null,
    generation: 0,
    disposed: false,
    status: SAVED,
  };
}

/** Starts following the store; the store must hold the loaded document and no preview. */
export function createAutosave(options: AutosaveOptions): Autosave {
  const { store, clock } = options;
  const machine: Machine = { options, state: initialState(options), pending: createPending(store) };
  const { state, pending } = machine;
  const stop = store.subscribe((update) => {
    pending.follow(update);
    if (update.transient || update.origin === 'load' || state.disposed) return;
    state.lastChange = clock.now();
    state.firstChange ??= state.lastChange;
    schedule(machine);
    report(machine);
  });
  return {
    get status() {
      return state.status;
    },
    saveNow() {
      // A failed save always leaves its changes waiting, so its retry starts now instead.
      if (state.failure !== null) stopTimer(state);
      flush(machine);
    },
    sessionChanged() {
      if (state.disposed || state.phase === 'stale') return;
      state.sessionDirty = true;
      state.lastSession = clock.now();
      schedule(machine);
    },
    keep() {
      if (state.disposed || state.phase !== 'stale') return;
      Object.assign(state, {
        phase: 'idle',
        replace: true,
        base: state.storedRev,
        failure: null,
        attempts: 0,
      });
      flush(machine);
    },
    reset(id, rev) {
      stopTimer(state);
      pending.reset();
      Object.assign(state, {
        ...initialState({ ...options, id, rev }),
        generation: state.generation + 1,
      });
      report(machine);
    },
    dispose() {
      state.disposed = true;
      state.generation += 1;
      stopTimer(state);
      stop();
    },
  };
}
