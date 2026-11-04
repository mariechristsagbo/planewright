import { readFile } from 'node:fs/promises';

import { build } from 'esbuild';

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
}

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8')) as PackageManifest;

// Workspace packages are source-only, so they are bundled; registry dependencies stay external.
const external = Object.keys(manifest.dependencies ?? {}).filter(
  (name) => !name.startsWith('@planewright/'),
);

await build({
  absWorkingDir: new URL('..', import.meta.url).pathname,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
});
