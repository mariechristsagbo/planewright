/**
 * Planewright is an independent implementation: Excalidraw packages, source and assets must
 * never enter the dependency graph. See docs/adr/0003-clean-room-reference-policy.md.
 */
const FORBIDDEN_PACKAGE_PATTERN = /excalidraw/i;

interface LockfileEntry {
  readonly name?: unknown;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function packageNameFromPath(path: string): string {
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  return index === -1 ? path : path.slice(index + marker.length);
}

/** Returns every package in an npm v3 lockfile whose name violates the dependency policy. */
export function findForbiddenPackages(lockfile: unknown): string[] {
  if (!isRecord(lockfile) || !isRecord(lockfile['packages'])) {
    throw new Error('Expected an npm lockfile with a "packages" map (lockfileVersion 3).');
  }
  const violations = new Set<string>();
  for (const [path, entry] of Object.entries(lockfile['packages'])) {
    const declared = isRecord(entry) ? (entry as LockfileEntry).name : undefined;
    const candidates = [packageNameFromPath(path), typeof declared === 'string' ? declared : ''];
    for (const name of candidates) {
      if (FORBIDDEN_PACKAGE_PATTERN.test(name)) {
        violations.add(name);
      }
    }
  }
  return [...violations].sort();
}
