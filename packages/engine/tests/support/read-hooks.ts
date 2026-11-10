// Values that run code when they are read (issue 45), which no change set holds (ADR 0010 §2):
// the tests read change sets through them to show that such code can neither clear what planning
// a set reports nor change a store while it plans one.

/**
 * A copy of a JSON value in which each field of an object and each item of an array is a getter
 * that calls `onRead`, then returns its own copy. An object keeps its prototype, so that a field
 * it only inherits stays inherited, and a primitive is returned as it is.
 */
export function readThrough<T>(value: T, onRead: () => void): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const copy = (
    Array.isArray(value)
      ? new Array<unknown>(value.length)
      : Object.create(Object.getPrototypeOf(value) as object | null)
  ) as object;
  for (const [key, field] of Object.entries(value)) {
    const read = readThrough<unknown>(field, onRead);
    Object.defineProperty(copy, key, {
      enumerable: true,
      get: () => {
        onRead();
        return read;
      },
    });
  }
  return copy as T;
}
