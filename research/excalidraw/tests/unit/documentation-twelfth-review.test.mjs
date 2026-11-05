// Checks the claims that the review of 4e9c663 found incomplete: where the record checks run in
// CI, which jobs fetch the Git history, and that neither set is narrowed to one spelling.
import { describe, expect, it } from 'vitest';

import { RE, flat, read } from './r76-evidence.mjs';

const SCRIPTS = JSON.parse(read('package.json')).scripts;

// Whether a shell text runs Vitest, directly or through a root npm script (validate runs
// test:coverage, for example).
const runsVitest = (text, depth = 0) =>
  /\bvitest\b/u.test(text) ||
  (depth < 4 &&
    [...text.matchAll(/\bnpm (?:run )?([\w:-]+)/gu)].some(
      ([, name]) => Object.hasOwn(SCRIPTS, name) && runsVitest(SCRIPTS[name], depth + 1),
    ));

// Whether a job gets more than one commit of history: a checkout deeper than one commit, or any
// step that fetches, pulls, clones, deepens or unshallows. Every such form counts, so a job is
// never said to lack the history only because it does not spell fetch-depth.
const fetchesHistory = (text) =>
  [...text.matchAll(/fetch-depth:\s*(\S+)/gu)].some(([, depth]) => depth !== '1') ||
  /\bgit\b[^\n]*\b(?:fetch|pull|clone)\b/u.test(text) ||
  /--(?:unshallow|deepen|shallow-since|shallow-exclude)\b/u.test(text);

// The CI jobs, by id, each with its own text.
const ciJobs = () =>
  read('.github/workflows/ci.yml')
    .split('\njobs:\n')[1]
    .split(/\n(?= {2}[\w-]+:\n)/u)
    .map((text) => ({ id: /^ {2}([\w-]+):\n/u.exec(text)[1], text }));

// "a, b and c", as the documents join a list.
const joined = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const note = () =>
  flat(
    read(`${RE}/checkpoint.md`)
      .split('## Independent reviews\n')[1]
      .split(/\n\d+\. /u)[0],
  );

describe('the detectors of the CI history note', () => {
  it('count every way a job runs Vitest or gets history, and nothing else', () => {
    for (const run of ['npm run test:coverage', 'npm test', 'npm run validate', 'npx vitest run'])
      expect(runsVitest(`- run: ${run}`), run).toBe(true);
    for (const run of ['npm ci', 'npm run test:e2e', 'npm run build', 'npx --no -- commitlint'])
      expect(runsVitest(`- run: ${run}`), run).toBe(false);
    for (const step of [
      'fetch-depth: 0',
      'fetch-depth: 2',
      '- run: git fetch --unshallow',
      '- run: git fetch origin main',
      '- run: git -c protocol.version=2 pull',
      '- run: git clone https://example.test/repo.git',
      '- run: git fetch --deepen=50',
    ])
      expect(fetchesHistory(step), step).toBe(true);
    for (const step of ['fetch-depth: 1', '- run: npm ci', '- run: gitleaks git --redact .'])
      expect(fetchesHistory(step), step).toBe(false);
  });
});

describe('the CI history note under the exit rule', () => {
  it('names the one job that runs the record checks, which gets no history', () => {
    const tests = ciJobs().filter((job) => runsVitest(job.text));
    expect(tests).toHaveLength(1);
    const [job] = tests;
    expect(job.text).toMatch(/uses: actions\/checkout@/u);
    expect(job.text).not.toMatch(/fetch-depth/u);
    expect(fetchesHistory(job.text)).toBe(false);
    expect(note()).toContain(
      `In CI they run only in the ${job.id} job, which checks out one commit, at the checkout ` +
        "action's default depth, and fetches nothing more.",
    );
  });

  it('names every job that fetches the history, none of which runs them', () => {
    const history = ciJobs().filter((job) => fetchesHistory(job.text));
    expect(history.length).toBeGreaterThan(0);
    for (const job of history) {
      expect(runsVitest(job.text), job.id).toBe(false);
      expect(job.text, job.id).toMatch(/\n {10}fetch-depth: 0\n/u);
    }
    expect(note()).toContain(
      `The jobs that fetch the whole history, ${joined(history.map((job) => job.id))} ` +
        '(fetch-depth: 0), do not run them',
    );
    const host = /A check of the bullet against the history could run in ([\w-]+), but none/u.exec(
      note(),
    );
    expect(history.map((job) => job.id)).toContain(host?.[1]);
  });
});
