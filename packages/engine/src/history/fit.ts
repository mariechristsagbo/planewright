import { isEmptyChangeSet } from '../scene/change-set.ts';
import type { ChangeOrigin, ChangeSet } from '../scene/change-set.ts';
import type { ChangeError } from '../scene/check.ts';
import { keepListenerErrors } from '../scene/listener-errors.ts';
import { ChangeSetError } from '../scene/store.ts';
import type { SceneStore } from '../scene/store.ts';

// The last step of a conflict-safe undo or redo (docs/architecture/engine/history.md#conflict-safe-undo):
// once another origin has changed the document, the part that still applies may leave something
// the store refuses, such as a group that a removal still needs. That change is left out, so undo
// and redo never throw for a conflict and never break the store's invariants.

/** The changes of a set that the store refused, read from the paths of its reasons. */
interface Refused {
  readonly elements: ReadonlySet<number>;
  readonly groups: ReadonlySet<number>;
  readonly canvas: boolean;
  /** A reason that names no single change, such as too many elements. */
  readonly whole: boolean;
}

const CHANGE_PATH = /^(elements|groups)\[(\d+)\]/u;

function refusedBy(errors: readonly ChangeError[]): Refused {
  const refused = {
    elements: new Set<number>(),
    groups: new Set<number>(),
    canvas: false,
    whole: false,
  };
  for (const { path } of errors) {
    const match = CHANGE_PATH.exec(path);
    if (match !== null) {
      (match[1] === 'elements' ? refused.elements : refused.groups).add(Number(match[2]));
    } else if (path.startsWith('canvas')) {
      refused.canvas = true;
    } else {
      refused.whole = true;
    }
  }
  return refused;
}

function without(changes: ChangeSet, refused: Refused): ChangeSet {
  const { canvas, author, seq } = changes;
  const kept = <T>(list: readonly T[], indexes: ReadonlySet<number>): T[] =>
    refused.whole ? [] : list.filter((_, index) => !indexes.has(index));
  return {
    elements: kept(changes.elements, refused.elements),
    groups: kept(changes.groups, refused.groups),
    ...(canvas === undefined || refused.canvas || refused.whole ? {} : { canvas }),
    author,
    seq,
  };
}

/** Applies a set and returns undefined, or returns the store's reasons to refuse it. */
function attempt(
  store: SceneStore,
  changes: ChangeSet,
  origin: ChangeOrigin,
  failures: unknown[],
): readonly ChangeError[] | undefined {
  try {
    keepListenerErrors(store, failures, () => {
      store.apply(changes, origin);
    });
    return undefined;
  } catch (error) {
    if (error instanceof ChangeSetError) return error.errors;
    throw error;
  }
}

/**
 * Applies as much of a set as the store accepts: the changes it refuses are left out and the rest
 * is tried again, until a set applies or nothing is left; each try leaves out at least one change,
 * so it ends. Returns the set that was applied, or null when nothing was. A listener's error is
 * kept in `failures` for the caller to rethrow once it has finished; any other error is thrown at
 * once, with nothing applied.
 */
export function applyWhatFits(
  store: SceneStore,
  changes: ChangeSet,
  origin: ChangeOrigin,
  failures: unknown[],
): ChangeSet | null {
  let rest = changes;
  while (!isEmptyChangeSet(rest)) {
    const errors = attempt(store, rest, origin, failures);
    if (errors === undefined) return rest;
    rest = without(rest, refusedBy(errors));
  }
  return null;
}
