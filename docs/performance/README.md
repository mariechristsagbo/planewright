# Performance baseline

[`baseline.json`](baseline.json) keeps the CI runs of the performance report that make the
baseline of the [performance budgets](../architecture/engine/quality.md#performance-budgets), each
with the machine it ran on, and the issue that will fix each missed budget. A run is compared only
with the runs on `main` recorded on its own processor model, and its statistical budgets only
report until that model has three. The file holds three runs on `main` at `4db483f`, one on each of
three processors, so CI reports only; a pull request's run is kept as information and never counts.
Which runs count, and what fails CI once a processor has its three, is in
[what issue #38 decided](../architecture/engine/quality.md#what-issue-38-decided).

Record each later CI run on `main`, a push or a manual dispatch, in the order of the runs, from the
`report.json` of its `performance-report` artifact:

```sh
git fetch origin main
gh run download <run id> --name performance-report --dir perf-results/main-4
npm run perf:baseline -- --label "main run 4, CI run <number>" perf-results/main-4/report.json
```

`perf:baseline` refuses a run that is not a push or a manual dispatch of this repository's CI on
`main` at its first attempt, a report that fails, a run older than the last recorded run on `main`
or at an older commit, and a run that the file already holds. `--information` keeps a refused CI
run, such as a pull request's, as information.

`followUps` names the open issue of each budget that CI still misses, which the report prints beside
a miss: issue #49 for B1, whose misses vary by run, and none for B2, which every CI report has met.
`npm run perf:tail -- <report.json>...` prints B1's and B2's median and 95th percentile, B1's frames
of 9 ms or more and the misses per processor model of any CI reports, as
[what issue #41 decided](../architecture/engine/rendering-and-hit-testing.md#what-issue-41-decided)
records them; it refuses a report given twice and names a file that is not JSON.

Each `performance-report` artifact also keeps `browser/traces/`: a Chromium trace of B1's pans, run
again after B1's own frames, and the record of that pass's frames with their starts, whose path,
size and SHA-256 `report.json` gives under `traces`
([what issue #49 decided](../architecture/engine/rendering-and-hit-testing.md#what-issue-49-decided)).
The report fails when that trace is missing or does not hold its frames.
