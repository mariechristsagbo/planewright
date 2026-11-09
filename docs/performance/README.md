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
