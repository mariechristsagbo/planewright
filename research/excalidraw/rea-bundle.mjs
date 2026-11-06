// Lays saved REA Evidence records out as one canonical Evidence bundle (lib/bundle.mjs), so that
// REA's own importer can validate them: `rea evidence-import`, or the MCP import_evidence_bundle
// tool followed by export_evidence_bundle. Each input is the { ok, data } output of the REA CLI
// or a bare record saved from the MCP server. A file that is not valid JSON, a failed CLI call or
// an output that holds no record stops the run and is named, never quoted. The output is created
// exclusively, so an existing file is never replaced. Prints the output name and a count only.
//
// Usage: node research/excalidraw/rea-bundle.mjs <output.json> <record.json...>
import { readFileSync } from 'node:fs';

import { bundleOf } from './lib/bundle.mjs';
import { writeExclusive } from './lib/files.mjs';
import { parseJson, recordOf } from './lib/windows.mjs';

function readRecord(file) {
  try {
    return recordOf(parseJson(readFileSync(file, 'utf8'), file));
  } catch (error) {
    const message = error.message.startsWith(file) ? error.message : `${file}: ${error.message}`;
    throw new Error(message, { cause: error });
  }
}

const [output, ...inputs] = process.argv.slice(2);
if (!output || inputs.length === 0) {
  throw new Error('Usage: rea-bundle.mjs <output.json> <record.json...>');
}
const bundle = bundleOf(inputs.map(readRecord));
writeExclusive(output, `${JSON.stringify(bundle)}\n`);
console.log(`wrote ${output} (${String(bundle.records.length)} records)`);
