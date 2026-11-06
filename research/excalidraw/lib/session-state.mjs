// Session state that must survive a driver restart: the runLast scenarios that have started and
// the first halt reason. Kept only in memory, both were lost when the driver restarted, so a
// halted session, or one that had started a collaboration scenario, carried on as if nothing
// had happened. The file is <out>/driver-state.json and is rewritten on every change, and made
// readable only by the current user each time. A halt reason is never empty: an empty string
// would read as "not halted" and would also block every later halt.
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const isNameList = (value) => Array.isArray(value) && value.every((n) => typeof n === 'string');
const isReason = (value) => typeof value === 'string' && value.length > 0;
const NO_REASON = 'a halt was requested without a reason.';

function parseState(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const valid =
    parsed !== null &&
    typeof parsed === 'object' &&
    isNameList(parsed.runLast) &&
    (parsed.halted === null || isReason(parsed.halted));
  if (!valid) throw new Error('Driver state file is malformed; refusing to start.');
  return { runLast: [...parsed.runLast], halted: parsed.halted };
}

function stateApi(state, save) {
  return {
    runLastStarted: () => [...state.runLast],
    startRunLast(name) {
      state.runLast.push(name);
      save();
    },
    halted: () => state.halted,
    halt(reason) {
      if (state.halted !== null) return;
      state.halted = isReason(reason) ? reason : NO_REASON;
      save();
    },
  };
}

/** In-memory state, for tests and for callers that own no session directory. */
export function memoryState() {
  return stateApi({ runLast: [], halted: null }, () => undefined);
}

/**
 * Opens the state file of a session directory, creating it when absent. A malformed file stops
 * the driver instead of being treated as an empty state.
 */
export function openSessionState(file) {
  const state = existsSync(file)
    ? parseState(readFileSync(file, 'utf8'))
    : { runLast: [], halted: null };
  // `mode` applies only when the file is created, so an existing file is narrowed explicitly.
  const save = () => {
    writeFileSync(file, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
  };
  save();
  return stateApi(state, save);
}
