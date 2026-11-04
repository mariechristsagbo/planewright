// Asks the loopback driver to run a named scenario, or sends an inline step batch given on the
// command line, and prints the results. Scenario files are read by the driver itself from
// research/excalidraw/scenarios, so this client never forwards file contents.
//
// Usage: node research/excalidraw/run.mjs <scenario name or path | '{"steps":[...]}'> [--port 9333]
import { basename } from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string', default: '9333' } },
});
const [input] = positionals;
if (!input) throw new Error('Pass a scenario name, a scenario path or inline JSON.');
const inline = input.trimStart().startsWith('{');
const body = inline
  ? JSON.stringify(JSON.parse(input))
  : JSON.stringify({ scenario: basename(input, '.json') });

const response = await fetch(`http://127.0.0.1:${values.port}/run`, { method: 'POST', body });
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
