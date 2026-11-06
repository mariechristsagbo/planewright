// Asks the loopback driver to run a named scenario, or sends an inline step batch given on the
// command line, and prints the results. Scenario files are read by the driver itself from
// research/excalidraw/scenarios, so this client never forwards file contents. The per-run token
// is read from <out>/driver.token, written by the driver at start-up.
//
// Usage: node research/excalidraw/run.mjs --out <dir> <scenario name or path | '{"steps":[...]}'>
//        node research/excalidraw/run.mjs --out <dir> --quit
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import { TOKEN_HEADER, parsePort } from './lib/guard.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    port: { type: 'string', default: '9333' },
    out: { type: 'string' },
    quit: { type: 'boolean', default: false },
  },
});
const port = parsePort(values.port, '--port');
if (!values.out) throw new Error('--out <driver output directory> is required for the token.');
const token = readFileSync(join(values.out, 'driver.token'), 'utf8').trim();

function requestBody() {
  const [input] = positionals;
  if (!input) throw new Error('Pass a scenario name, a scenario path or inline JSON.');
  if (!input.trimStart().startsWith('{')) return { scenario: basename(input, '.json') };
  const batch = JSON.parse(input);
  if (!Array.isArray(batch.steps)) throw new Error('An inline batch needs a "steps" array.');
  return { continueOnError: batch.continueOnError === true, steps: batch.steps };
}

// Requests go only to the local driver on the loopback interface.
const response = await fetch(`http://127.0.0.1:${String(port)}/${values.quit ? 'quit' : 'run'}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', [TOKEN_HEADER]: token },
  body: values.quit ? '{}' : JSON.stringify(requestBody()),
});
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
