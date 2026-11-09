import { clearResults, resultsFolder } from './results.ts';
import { CPU_SLOWDOWN } from './support.ts';

/** Before the first browser measurement, removes those of an earlier run at the same slowdown. */
export default function globalSetup(): void {
  clearResults(resultsFolder(CPU_SLOWDOWN));
}
