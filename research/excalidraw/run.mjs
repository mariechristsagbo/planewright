// Sends a step batch (a JSON file or inline JSON) to the loopback driver and prints the results.
//
// Usage: node research/excalidraw/run.mjs <scenario.json | '{"steps":[...]}'> [--port 9333]
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string', default: '9333' } },
});
const [input] = positionals;
if (!input) throw new Error('Pass a scenario file or inline JSON.');
const body = existsSync(input) ? readFileSync(input, 'utf8') : input;
JSON.parse(body);

const response = await fetch(`http://127.0.0.1:${values.port}/run`, { method: 'POST', body });
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
