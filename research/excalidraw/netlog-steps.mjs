// Builds the committed placement of every driver netlog entry against the driver timeline of the
// same session (lib/placement.mjs): the step in effect when the entry was written, the entry's
// offset from that step's start, and a summary of the drawing steps. Request entries are written
// when the request has finished or failed, so no output gives a request's start time.
//
// Usage: node research/excalidraw/netlog-steps.mjs <sessions-root> <output.json> <session...>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DRAWING, placeSession } from './lib/placement.mjs';
import { parseJson } from './lib/windows.mjs';

// A missing file or a line that is not valid JSON stops the build; the file is named by its
// session-relative name, a bad line by its number, and neither the path nor the line is quoted.
function readLines(root, session, name) {
  const label = `${session}/${name}`;
  let text;
  try {
    text = readFileSync(join(root, session, name), 'utf8');
  } catch {
    throw new Error(`${label}: cannot be read.`);
  }
  return text
    .split('\n')
    .flatMap((line, index) =>
      line ? [parseJson(line, `${label} line ${String(index + 1)}`)] : [],
    );
}

function sessionPlacement(root, session) {
  const rows = readLines(root, session, 'timeline.jsonl');
  const entries = readLines(root, session, 'netlog.jsonl');
  try {
    return { session, ...placeSession(rows, entries) };
  } catch (error) {
    throw new Error(`${session}: ${error.message}`, { cause: error });
  }
}

const [root, output, ...sessions] = process.argv.slice(2);
if (!root || !output || sessions.length === 0) {
  throw new Error('Usage: netlog-steps.mjs <sessions-root> <output.json> <session...>');
}
const placed = sessions.map((session) => sessionPlacement(root, session));
// The drawing kinds that the sessions' summaries count, in DRAWING order: a kind counted only
// when present (touchPath) is named only when a session has one.
const counted = new Set(placed.flatMap((s) => Object.keys(s.drawing.steps)));
const index = {
  schema: 'planewright-research-netlog-steps/v1',
  generated_by: 'research/excalidraw/netlog-steps.mjs',
  drawing_steps: DRAWING.filter((kind) => counted.has(kind)),
  sessions: placed,
};
const total = index.sessions.reduce((sum, s) => sum + s.netlog_entries, 0);
writeFileSync(output, `${JSON.stringify(index, null, 2)}\n`);
console.log(
  `wrote ${output} (${String(index.sessions.length)} sessions, ${String(total)} entries)`,
);
