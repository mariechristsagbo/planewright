// What happens when a scene listener throws (docs/architecture/engine/scene-and-viewport.md#change-sets):
// the store has applied the set, tells every listener, and only then rethrows the first error.

/** Rethrows the first kept error, if there is one. */
export function rethrowFirst(failures: readonly unknown[]): void {
  if (failures.length > 0) throw failures[0];
}
