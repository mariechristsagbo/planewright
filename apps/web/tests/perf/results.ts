import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Where the browser measurements are written for the performance report
// (docs/architecture/engine/quality.md#what-issue-38-decided), and how an earlier run's are
// removed before the measurements start, so that the report never reads a file that a failing
// test of this run did not write again.

/** The folder of the browser measurements, perf-results/browser, or one per CPU slowdown. */
export function resultsFolder(slowdown: number): string {
  const name = slowdown === 1 ? 'browser' : `browser-cpu-${String(slowdown)}x`;
  return fileURLToPath(new URL(`../../../../perf-results/${name}/`, import.meta.url));
}

/**
 * The folder of the traces that the browser measurements keep, inside theirs, so that clearing
 * that removes them too and the report, which reads only its JSON files, never takes one for a
 * measurement (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided).
 */
export const tracesFolder = (slowdown: number): string => `${resultsFolder(slowdown)}traces/`;

/** Removes the folder with every measurement in it; a missing folder is no error. */
export function clearResults(folder: string): void {
  rmSync(folder, { recursive: true, force: true });
}
