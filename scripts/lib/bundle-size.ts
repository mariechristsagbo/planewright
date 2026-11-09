import { gzipSync } from 'node:zlib';

import { PERF_BUDGETS } from './perf-budgets.ts';
import type { Measurement } from './perf-budgets.ts';

/**
 * The bundle-size guardrail's rules (docs/architecture/engine/quality.md#performance-budgets,
 * REQ-F04): the engine's and the renderer's entries bundled and minified on their own, and the
 * web app's initial JavaScript as the build serves it, each compressed at gzip level 9 and read
 * in KB of 1,000 bytes against budgets B11 to B13.
 */

export interface BundleSizes {
  /** Gzip-compressed bytes of each bundle. */
  readonly engine: number;
  readonly renderer: number;
  readonly web: number;
}

const BUNDLES = [
  ['B11', 'engine'],
  ['B12', 'renderer'],
  ['B13', 'web'],
] as const;

/** The bytes of some content once compressed at gzip level 9. */
export const gzipSize = (content: Uint8Array): number => gzipSync(content, { level: 9 }).length;

const ATTRIBUTE = (name: string): RegExp => new RegExp(`\\b${name}="([^"]+)"`, 'u');

/**
 * The scripts that a built page loads before anything else, as paths within the build: its module
 * scripts and the modules it preloads. A script from another origin is refused, since P0 loads
 * only its own assets.
 */
export function initialScripts(html: string): string[] {
  const tags = html.match(/<script\b[^>]*>|<link\b[^>]*>/gu) ?? [];
  const sources = tags.flatMap((tag) => {
    const isScript = tag.startsWith('<script') && /\btype="module"/u.test(tag);
    const isPreload = tag.startsWith('<link') && /\brel="modulepreload"/u.test(tag);
    const source = ATTRIBUTE(isScript ? 'src' : 'href').exec(tag)?.[1];
    return (isScript || isPreload) && source !== undefined ? [source] : [];
  });
  if (sources.length === 0) throw new Error('The built page loads no module script.');
  return sources.map((source) => {
    if (!source.startsWith('/') || source.startsWith('//')) {
      throw new Error(`The built page loads ${source}, which is not one of its own assets.`);
    }
    return source.slice(1);
  });
}

const kilobytes = (bytes: number): number => bytes / 1000;

const budgetOf = (id: string) => {
  const found = PERF_BUDGETS.find((budget) => budget.id === id);
  if (found === undefined) throw new Error(`No budget ${id}.`);
  return found;
};

/** B11 to B13 as the performance report reads them. */
export const bundleMeasurements = (sizes: BundleSizes): Measurement[] =>
  BUNDLES.map(([id, bundle]) => ({
    id,
    samples: [kilobytes(sizes[bundle])],
    details: { gzipBytes: sizes[bundle] },
  }));

/** Every bundle over its budget, by its budget's id and target; none at the budget itself. */
export const bundleViolations = (sizes: BundleSizes): string[] =>
  BUNDLES.flatMap(([id, bundle]) => {
    const budget = budgetOf(id);
    const size = kilobytes(sizes[bundle]);
    return size > budget.target ? [`${id} ${budget.targetText}: ${String(size)} KB`] : [];
  });
