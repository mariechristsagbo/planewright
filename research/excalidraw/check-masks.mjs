// Verifies, without displaying any image, that every masked region of every masked screenshot
// in a driver timeline is fully painted with the mask colour. Use it on captures of views that
// held secrets (for example a collaboration dialog) before keeping them. A masked capture without
// any recorded mask box fails.
//
// Usage: node research/excalidraw/check-masks.mjs <session-dir> [--scale 1]
// The scale recorded by the screenshot step (image px per CSS px) wins over --scale.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { decodePng, unmaskedSamples } from './lib/png.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { scale: { type: 'string', default: '1' } },
});
const [dir] = positionals;
if (!dir) throw new Error('Pass a driver session directory.');
const rows = readFileSync(join(dir, 'timeline.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((row) => row.step?.do === 'screenshot' && (row.result?.masks ?? 0) > 0);
let failed = 0;
for (const row of rows) {
  const png = decodePng(readFileSync(join(dir, 'screenshots', row.result.file)));
  const checks = (row.result.maskBoxes ?? []).map((box) =>
    unmaskedSamples(png, box, row.result.scale ?? Number(values.scale)),
  );
  // A masked capture with no recorded box proves nothing, so it fails.
  const ok = checks.length > 0 && checks.every((c) => c.samples > 0 && c.misses === 0);
  if (!ok) failed += 1;
  const summary = checks.map((c) => `${String(c.misses)}/${String(c.samples)}`).join(' ');
  console.log(`${ok ? 'PASS' : 'FAIL'} ${row.result.file} unmasked/sampled: ${summary}`);
}
console.log(`masked screenshots: ${String(rows.length)}, failed: ${String(failed)}`);
process.exitCode = failed > 0 ? 1 : 0;
