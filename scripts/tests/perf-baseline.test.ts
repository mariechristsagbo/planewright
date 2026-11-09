import { describe, expect, it } from 'vitest';

import {
  MAIN_EVENTS,
  REPOSITORY,
  appendRun,
  isMainRun,
  notMainRun,
  readBaseline,
  readReport,
  runAddress,
} from '../lib/perf-baseline.ts';
import type { MainHistory, PerfBaseline, ReportedRun } from '../lib/perf-baseline.ts';

// The performance baseline's runs (docs/architecture/engine/quality.md#what-issue-38-decided):
// only a run of this repository's CI on main, from a push or a manual dispatch, at its first
// attempt, with a report that does not fail, counts towards the gate; main runs are recorded once
// each, in the order of their run ids, at commits that main reached in that order; any other run
// is recorded only as information, on request, and never counts.

const ADDRESS = `https://github.com/${REPOSITORY}/actions/runs`;
const COMMITS = ['a', 'b', 'c', 'd'].map((letter) => letter.repeat(40));
const [FIRST, SECOND, THIRD, OFF_MAIN] = COMMITS as [string, string, string, string];

const MACHINE = {
  Processor: 'Test CPU A',
  Cores: '4',
  Memory: '15.6 GiB',
  System: 'linux 7.0.0 x64',
  'Runner image': 'ubuntu24 1',
  'Node.js': 'v24.22.1',
  Browser: 'Chromium 156',
};

/** A report of CI run `id` on main at `commit`, with `changes` to its run, as report.json says. */
function report(
  id: number,
  commit = FIRST,
  changes: Partial<ReportedRun['run']> = {},
): ReportedRun {
  const url = `${ADDRESS}/${String(id)}/attempts/1`;
  return {
    run: { branch: 'main', event: 'push', commit, url, ...changes },
    date: '2026-11-09T15:02:41.091Z',
    machine: { ...MACHINE, Commit: commit, Branch: 'main', Event: 'push', Run: url },
    values: { B1: 10.9, B6: 9.247 },
    evaluation: { failures: [] },
  };
}

/** Main as the recorder fetched it: FIRST, then SECOND, then THIRD; OFF_MAIN is not on it. */
const HISTORY: MainHistory = {
  onMain: (commit) => COMMITS.indexOf(commit) < 3,
  precedes: (earlier, later) => COMMITS.indexOf(earlier) <= COMMITS.indexOf(later),
};

const NONE: PerfBaseline = { runs: [], followUps: {} };

const record = (baseline: PerfBaseline, reported: ReportedRun, information = false) =>
  appendRun(baseline, reported, { label: 'run', information, history: HISTORY });

describe('runAddress', () => {
  it('reads the repository, run id and attempt of a CI run, and nothing else', () => {
    expect(runAddress(`${ADDRESS}/42640366479/attempts/1`)).toEqual({
      repository: REPOSITORY,
      id: 42640366479,
      attempt: 1,
    });
    expect(runAddress('https://github.com/fork/planewright/actions/runs/7/attempts/2')).toEqual({
      repository: 'fork/planewright',
      id: 7,
      attempt: 2,
    });
    expect(runAddress('local')).toBeNull();
    expect(runAddress(`${ADDRESS}/7`)).toBeNull();
    expect(runAddress(`http://github.com/${REPOSITORY}/actions/runs/7/attempts/1`)).toBeNull();
  });
});

describe('notMainRun', () => {
  const run = (changes: Partial<ReportedRun['run']>) => report(9, FIRST, changes).run;

  it('counts a push or a manual dispatch on main of this repository, at its first attempt', () => {
    expect(MAIN_EVENTS).toEqual(['push', 'workflow_dispatch']);
    expect(notMainRun(run({}))).toBeNull();
    expect(notMainRun(run({ event: 'workflow_dispatch' }))).toBeNull();
  });

  it('says why any other run does not count', () => {
    expect(notMainRun(run({ event: 'pull_request' }))).toBe(
      'it is a pull_request run, not a push or a manual dispatch',
    );
    expect(notMainRun(run({ event: 'schedule' }))).toContain('schedule');
    expect(notMainRun(run({ branch: 'perf/33-x' }))).toBe('it ran on perf/33-x, not on main');
    const fork = 'https://github.com/fork/planewright/actions/runs/9/attempts/1';
    expect(notMainRun(run({ url: fork }))).toBe(`it is not a CI run of ${REPOSITORY}`);
    expect(notMainRun(run({ url: 'local', event: 'local' }))).toContain('not a CI run');
    expect(notMainRun(run({ url: `${ADDRESS}/9/attempts/2` }))).toBe(
      'it is attempt 2 of its CI run, not the first',
    );
    expect(notMainRun(run({ commit: 'abc1234' }))).toBe(
      'its commit abc1234 is not a full commit id',
    );
  });
});

describe('appendRun for runs on main', () => {
  it('records the run with its label, address, commit, date, machine and values', () => {
    const next = appendRun(NONE, report(42640366479), {
      label: 'main run 1/3',
      history: HISTORY,
    });
    expect(next.runs).toEqual([
      {
        label: 'main run 1/3',
        branch: 'main',
        event: 'push',
        commit: FIRST,
        run: `${ADDRESS}/42640366479/attempts/1`,
        date: '2026-11-09T15:02:41.091Z',
        machine: MACHINE,
        values: { B1: 10.9, B6: 9.247 },
      },
    ]);
    expect(next.runs.filter(isMainRun)).toHaveLength(1);
  });

  it('records runs in the order of their ids, at commits that main reached in that order', () => {
    const one = record(NONE, report(10, FIRST));
    const two = record(one, report(11, FIRST, { event: 'workflow_dispatch' }));
    const three = record(two, report(13, SECOND));
    expect(three.runs.map(({ commit }) => commit)).toEqual([FIRST, FIRST, SECOND]);
    expect(() => record(three, report(12, THIRD))).toThrow(
      'Run 12 is older than run 13, the last run on main recorded',
    );
    expect(() => record(three, report(14, FIRST))).toThrow(
      `its commit ${FIRST} is older than ${SECOND}`,
    );
    expect(() => record(three, report(14, OFF_MAIN))).toThrow(`${OFF_MAIN} is not on main`);
  });

  it('refuses the same run twice, whatever its attempt or how it was recorded', () => {
    const once = record(NONE, report(10));
    expect(() => record(once, report(10))).toThrow('The baseline already holds run 10.');
    const again = report(10, FIRST, { url: `${ADDRESS}/10/attempts/2` });
    expect(() => record(once, again, true)).toThrow('already holds run 10');
  });

  it('refuses a report that fails, or that names no processor', () => {
    const failing = { ...report(10), evaluation: { failures: ['B3 was not measured.'] } };
    expect(() => record(NONE, failing)).toThrow('its report fails: B3 was not measured.');
    const nameless = { ...report(10), machine: { ...MACHINE, Processor: 'unknown' } };
    expect(() => record(NONE, nameless)).toThrow('names no processor');
    const partial = Object.fromEntries(
      Object.entries(MACHINE).filter(([key]) => key !== 'Browser'),
    );
    expect(() => record(NONE, { ...report(10), machine: partial })).toThrow('lacks Browser');
  });
});

describe('appendRun for other runs', () => {
  it('refuses a pull request, a fork or a re-run as a main run, and says how to keep it', () => {
    const pullRequest = report(10, OFF_MAIN, { event: 'pull_request', branch: 'perf/33-x' });
    expect(() => record(NONE, pullRequest)).toThrow(
      'This run does not count towards the gate: it ran on perf/33-x, not on main. Record it with --information to keep it as information.',
    );
    const forkMain = report(10, FIRST, {
      url: 'https://github.com/fork/planewright/actions/runs/10/attempts/1',
    });
    expect(() => record(NONE, forkMain)).toThrow(`it is not a CI run of ${REPOSITORY}`);
    const namedMain = report(10, OFF_MAIN, { event: 'pull_request' });
    expect(() => record(NONE, namedMain)).toThrow('it is a pull_request run');
  });

  it('keeps such a run as information, which never counts and needs no order', () => {
    const main = record(NONE, report(20, SECOND));
    const pullRequest = report(10, OFF_MAIN, { event: 'pull_request', branch: 'perf/33-x' });
    const next = record(main, pullRequest, true);
    expect(next.runs.map(isMainRun)).toEqual([true, false]);
  });

  it('refuses a report of no CI run even as information', () => {
    const local = report(10, FIRST, { url: 'local', event: 'local' });
    expect(() => record(NONE, local, true)).toThrow('Only CI runs make the baseline');
  });
});

describe('readBaseline', () => {
  const recorded = record(record(NONE, report(10)), report(11));

  it('reads a baseline whose runs on main are recorded once each, in order', () => {
    expect(readBaseline(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);
    expect(readBaseline({ runs: [], followUps: { B6: '#35' } })).toEqual({
      runs: [],
      followUps: { B6: '#35' },
    });
  });

  it('refuses a malformed baseline, a run without its machine, and runs out of order or twice', () => {
    expect(() => readBaseline({ runs: [{ branch: 'main' }], followUps: {} })).toThrow(
      'not well formed',
    );
    expect(() => readBaseline({ runs: [] })).toThrow('followUps');
    const [first, second] = recorded.runs as [
      PerfBaseline['runs'][number],
      PerfBaseline['runs'][number],
    ];
    const bare = { ...first, machine: null };
    expect(() => readBaseline({ runs: [bare], followUps: {} })).toThrow('not well formed');
    expect(() => readBaseline({ runs: [second, first], followUps: {} })).toThrow(
      'The runs on main of the performance baseline are out of order: run 11 before run 10.',
    );
    expect(() => readBaseline({ runs: [first, first], followUps: {} })).toThrow(
      'The performance baseline holds run 10 twice.',
    );
  });
});

describe('readReport', () => {
  it('reads what a baseline run records of a report.json, refusing anything else', () => {
    const reported = report(10);
    expect(readReport(JSON.parse(JSON.stringify(reported)), 'report.json')).toEqual(reported);
    expect(() => readReport({ ...reported, evaluation: {} }, 'a.json')).toThrow(
      'a.json is not a performance report.',
    );
    expect(() => readReport({ ...reported, run: { branch: 'main' } }, 'b.json')).toThrow('b.json');
    expect(() => readReport({ ...reported, values: { B1: 'fast' } }, 'c.json')).toThrow('c.json');
    expect(() => readReport([], 'd.json')).toThrow('d.json');
  });
});
