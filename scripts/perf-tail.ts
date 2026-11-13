import { readFileSync } from 'node:fs';

import { parseTailReport, tailMarkdown, tailRows } from './lib/perf-tail.ts';

// B1's tail across CI performance reports
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-41-decided):
// `npm run perf:tail -- <report.json>...` with the report.json of each run's performance-report
// artifact prints each report's B1 and B2, B1's frames of 9 ms or more and the misses per
// processor model as Markdown. It changes no file and fails no run.

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error('Usage: npm run perf:tail -- <report.json>...');
const reports = paths.map((path) => parseTailReport(readFileSync(path, 'utf8'), path));
console.log(tailMarkdown(tailRows(reports)));
