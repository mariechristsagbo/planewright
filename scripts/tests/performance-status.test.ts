import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { tracesFolder } from '../../apps/web/tests/perf/results.ts';
import { readBaseline } from '../lib/perf-baseline.ts';
import { missRates } from '../lib/perf-tail.ts';
import { TRACE_CATEGORIES, traceFiles } from '../lib/perf-trace.ts';

// What the repository says of B1's and B2's misses and their issues
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-41-decided): the status
// documents name the follow-up that docs/performance/baseline.json gives, no document says that
// closed issue #34 still holds B1 or B2, and the record of the CI reports agrees with its table.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const BASELINE = readBaseline(JSON.parse(read('docs/performance/baseline.json')));
const STATUS = [
  'README.md',
  'AGENTS.md',
  'docs/architecture/engine/README.md',
  'docs/architecture/overview.md',
];
const DOCUMENTS = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '*.md'],
  { cwd: ROOT, encoding: 'utf8' },
)
  .split('\0')
  .filter((path) => path.length > 0);

/** A document's clauses: its paragraphs, quoted or not, list items and table rows, split at ends. */
function clauses(markdown: string): string[] {
  const unquoted = markdown.replace(/^> ?/gmu, '');
  return unquoted.split(/\n(?=\s*(?:$|[-*|#>]|\d+\.))/u).flatMap((block) =>
    block
      .replace(/\s+/gu, ' ')
      .trim()
      .split(/(?<=[.!?]) (?=[A-Z`*[(])|; /u),
  );
}

/** The cells of the rows of the table whose header starts with `header`, none without one. */
function tableRows(markdown: string, header: string): string[][] {
  const lines = markdown.split('\n').map((line) => line.trim().replace(/ {2,}/gu, ' '));
  const start = lines.findIndex((line) => line.startsWith(header));
  if (start < 0) return [];
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break;
    rows.push(
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  }
  return rows;
}

describe('the follow-ups of B1 and B2', () => {
  it.each(STATUS)("%s names B1's follow-up from the baseline, beside the redraw", (path) => {
    const issue = `issue ${BASELINE.followUps['B1'] ?? 'none'}`;
    const named = clauses(read(path)).filter((clause) => clause.includes(issue));
    expect(named.some((clause) => /\bB1\b|redraw of 5,000 elements/u.test(clause))).toBe(true);
  });

  // Each clause is cut at its commas too, so that a word of another part of a list never counts.
  const STALE = /\b(?:still|holds|tracks|tracked|remains?|ha(?:s|ve) issues)\b|follow-up #34/iu;
  it.each(DOCUMENTS)('%s never says that closed issue #34 still holds a budget', (path) => {
    const phrases = clauses(read(path)).flatMap((clause) => clause.split(', '));
    const naming = phrases.filter((phrase) => /#34\b/u.test(phrase));
    expect(naming.filter((phrase) => STALE.test(phrase))).toEqual([]);
  });
});

describe('the record of the CI reports since issue #34', () => {
  const rendering = read('docs/architecture/engine/rendering-and-hit-testing.md');
  const section = rendering.split('\n## What issue #41 decided\n')[1]?.split('\n## ')[0] ?? '';
  const reports = tableRows(section, '| CI run (attempt) |').map((cells) => {
    const [, , branch = '', , processor = '', , b1 = '', , , b2 = '', result = ''] = cells;
    const b1Met = Number.parseFloat(b1) <= 8;
    const b2Met = Number.parseFloat(b2) <= 4;
    return { branch, result, report: { processor }, b1: { met: b1Met }, b2: { met: b2Met } };
  });

  it("gives each report the result that its 95th percentiles say, as the report's budgets", () => {
    expect(reports.length).toBeGreaterThanOrEqual(5);
    for (const { result, b1, b2 } of reports) {
      const missed = [...(b1.met ? [] : ['B1']), ...(b2.met ? [] : ['B2'])];
      expect(result).toBe(missed.length === 0 ? 'met' : `${missed.join(' and ')} missed`);
    }
  });

  it('gives the miss rates per processor model that its reports count, on main and in all', () => {
    const main = missRates(reports.filter(({ branch }) => branch === 'main'));
    const expected = missRates(reports).map(({ processor, reports: all, b1Missed, b2Missed }) => {
      const onMain = main.find((rate) => rate.processor === processor);
      const counts = [onMain?.reports ?? 0, onMain?.b1Missed ?? 0, all, b1Missed, b2Missed];
      return [processor, ...counts.map(String)];
    });
    expect(tableRows(section, '| Processor | Reports on `main` |')).toEqual(expected);
  });

  it('no longer ties B1 to the processor model where the reports show both results', () => {
    expect(rendering).not.toMatch(/depends on the runner's processor|still missed on the EPYC/u);
    expect(read('CHANGELOG.md')).not.toContain('still misses it on an AMD EPYC 7763');
  });
});

describe("the record of B1's trace", () => {
  const rendering = read('docs/architecture/engine/rendering-and-hit-testing.md');
  const section = rendering.split('\n## What issue #49 decided\n')[1]?.split('\n## ')[0] ?? '';
  const text = section.replace(/\s+/gu, ' ');

  it('names the categories that the traced pass asks Chromium for, and the folder it keeps', () => {
    const named = TRACE_CATEGORIES.filter((category) => category !== '-*');
    expect(named.filter((category) => !text.includes(`\`${category}\``))).toEqual([]);
    const folder = tracesFolder(1).split('/').slice(-4).join('/');
    expect(text).toContain(`\`${folder}B1.trace.json\``);
  });

  it("names the paired control's record beside the trace", () => {
    const folder = tracesFolder(1).split('/').slice(-4).join('/');
    expect(text).toContain(`\`${folder}${traceFiles('B1').control}\``);
  });

  it('keeps every run of the stopped D2 span with its artifact digest', () => {
    const span = [
      ['43484948475', '72be54ac0f18b54ddf4a0d958c328494d476393a7bcf764fa0c1df1419ad4bab'],
      ['43485844959', '6af51ec08df7afe28f681f3978b66ed3e7b0e44ba032b3a47eb0d0aea06a64ee'],
      ['43486777060', '14235c345b4e982c2da3438cffe1606aa780c225ec9ad587b4e5b410d605da0e'],
      ['43487661767', 'b2440711413e305f6aa78225a66b666bb5870e71584ecddcddfefc4a91e9a42a'],
    ];
    const missing = span.filter(([run, digest]) => !text.includes(run) || !text.includes(digest));
    expect(missing).toEqual([]);
  });

  it("keeps D2 to D4 open while the baseline names the issue as B1's follow-up", () => {
    const open = text.includes('**Not yet.** D2 to D4.');
    expect(BASELINE.followUps['B1'] === '#49' && !open).toBe(false);
  });
});
