// Scans directory trees (or stdin) for secret-shaped values and prints only file names, shape
// names and counts, never a value. Also lists driver token files, which must not outlive a run.
// Images are not decoded: a QR code or rendered link in a screenshot cannot be detected here,
// so captures of secret-bearing views must be masked when taken (see check-masks.mjs).
//
// Usage: node research/excalidraw/secret-scan.mjs <dir...>
//        git log -p --all | node research/excalidraw/secret-scan.mjs --stdin
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { countSecretShapes } from './lib/sanitise.mjs';

const SKIP = new Set(['node_modules', '.git']);
const MAX_BYTES = 200 * 1024 * 1024;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

function report(label, counts, totals) {
  const names = Object.keys(counts);
  if (names.length === 0) return;
  for (const name of names) totals[name] = (totals[name] ?? 0) + counts[name];
  console.log(`${label}: ${names.map((n) => `${n}=${String(counts[n])}`).join(' ')}`);
}

const args = process.argv.slice(2);
if (args.length === 0) throw new Error('Pass directories to scan, or --stdin.');
const totals = {};
const tokens = [];

function scanTrees(roots) {
  let count = 0;
  for (const file of roots.flatMap((root) => [...walk(root)])) {
    if (file.endsWith('/driver.token')) tokens.push(file);
    if (statSync(file).size > MAX_BYTES) continue;
    count += 1;
    report(file, countSecretShapes(readFileSync(file, 'latin1')), totals);
  }
  return count;
}

let files = 1;
if (args[0] === '--stdin') report('<stdin>', countSecretShapes(readFileSync(0, 'latin1')), totals);
else files = scanTrees(args);
console.log(`files scanned: ${String(files)}`);
console.log(`totals: ${JSON.stringify(totals)}`);
console.log(
  `driver token files: ${String(tokens.length)}${tokens.length ? ` (${tokens.join(', ')})` : ''}`,
);
