import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';

import {
  bundleMeasurements,
  bundleViolations,
  gzipSize,
  initialScripts,
} from './lib/bundle-size.ts';

// The bundle-size guardrail (docs/architecture/engine/quality.md#what-eng-15-decided, REQ-F04):
// the engine's and the renderer's entries are bundled and minified on their own, the renderer
// without the engine it imports, and the web app's initial JavaScript is read from its build, so
// run `npm run build` first. Each is compressed at gzip level 9; the sizes go to
// perf-results/bundle.json for the performance report, and a bundle over its budget fails.

const WEB_BUILD = 'apps/web/dist';

/** The gzip-compressed size of one package entry, bundled and minified as an ES module. */
async function entrySize(entry: string, external: readonly string[]): Promise<number> {
  const { outputFiles } = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2024',
    external: [...external],
    write: false,
    logLevel: 'error',
  });
  return outputFiles.reduce((sum, file) => sum + gzipSize(file.contents), 0);
}

function webSize(): number {
  let html: string;
  try {
    html = readFileSync(join(WEB_BUILD, 'index.html'), 'utf8');
  } catch (error) {
    throw new Error(`${WEB_BUILD}/index.html is missing: run npm run build first.`, {
      cause: error,
    });
  }
  return initialScripts(html).reduce(
    (sum, path) => sum + gzipSize(readFileSync(join(WEB_BUILD, path))),
    0,
  );
}

const sizes = {
  engine: await entrySize('packages/engine/src/index.ts', []),
  renderer: await entrySize('packages/render-canvas/src/index.ts', ['@planewright/engine']),
  web: webSize(),
};
mkdirSync('perf-results', { recursive: true });
writeFileSync(
  'perf-results/bundle.json',
  `${JSON.stringify(bundleMeasurements(sizes), null, 2)}\n`,
);

const kb = (bytes: number): string => `${(bytes / 1000).toFixed(1)} KB`;
const violations = bundleViolations(sizes);
console.log(
  `Bundle sizes, minified and gzip-compressed: engine ${kb(sizes.engine)} (budget 60 KB), renderer ${kb(sizes.renderer)} (15 KB), the web app's initial JavaScript ${kb(sizes.web)} (200 KB).`,
);
if (violations.length > 0) {
  console.error('Bundle-size guardrail violations:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exitCode = 1;
}
