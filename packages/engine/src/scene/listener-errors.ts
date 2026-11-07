// What happens when a scene listener throws (docs/architecture/engine/scene-and-viewport.md#change-sets):
// the store has applied the set and tells every listener first, so whoever applied it finishes
// its own steps before the error reaches its caller.

/**
 * Runs `step`, which applies one change set to the store whose revision `store` reads. If the set
 * was applied but a listener then threw, the error is kept in `failures` for the caller to rethrow
 * once it has finished; if the set was not applied, the error is thrown at once. A listener cannot
 * apply a set while it is told of one, so the revision rises exactly when the set was applied.
 */
export function keepListenerErrors(
  store: { readonly rev: number },
  failures: unknown[],
  step: () => void,
): void {
  const rev = store.rev;
  try {
    step();
  } catch (error) {
    if (store.rev === rev) throw error;
    failures.push(error);
  }
}

/** Rethrows the first kept error, if there is one. */
export function rethrowFirst(failures: readonly unknown[]): void {
  if (failures.length > 0) throw failures[0];
}
