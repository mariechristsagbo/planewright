// Builds the committed summary of REA observation windows (observe_web_session and
// inspect_web_page records) set against the driver timeline of the same session. It records
// what each window could retain, what it did retain, and which driver steps started inside it.
//
// Usage: node research/excalidraw/rea-windows.mjs <sessions-root> <output.json> <session...>
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { recordOf, summariseWindow } from './lib/windows.mjs';

const readRows = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

function sessionWindows(root, session) {
  const dir = join(root, session, 'rea');
  if (!existsSync(dir)) return [];
  const rows = readRows(join(root, session, 'timeline.jsonl'));
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const summary = summariseWindow(
        recordOf(JSON.parse(readFileSync(join(dir, name), 'utf8'))),
        rows,
      );
      return summary ? { session, file: name, ...summary } : null;
    })
    .filter(Boolean);
}

const [root, output, ...sessions] = process.argv.slice(2);
if (!root || !output || sessions.length === 0) {
  throw new Error('Usage: rea-windows.mjs <sessions-root> <output.json> <session...>');
}
const index = {
  schema: 'planewright-research-rea-windows/v1',
  generated_by: 'research/excalidraw/rea-windows.mjs',
  windows: sessions.flatMap((session) => sessionWindows(root, session)),
};
writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`);
console.log(`wrote ${output} (${String(index.windows.length)} windows)`);
