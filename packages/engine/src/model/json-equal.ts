type JsonRecord = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

function arraysEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((item, index) => jsonEqual(item, b[index]));
}

function recordsEqual(a: JsonRecord, b: JsonRecord): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]))
  );
}

/**
 * Whether two JSON values are equal: the same primitive, or arrays with equal items, or objects
 * with the same keys holding equal values in any order. Change sets compare fields with it
 * (docs/architecture/engine/scene-and-viewport.md#change-sets); 0 and −0 are equal, as JSON
 * writes them alike.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  return Array.isArray(a)
    ? arraysEqual(a, b as readonly unknown[])
    : recordsEqual(a as JsonRecord, b as JsonRecord);
}
