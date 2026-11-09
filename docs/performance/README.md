# Performance baseline

[`baseline.json`](baseline.json) keeps the CI runs of the performance report that make the
baseline of the [performance budgets](../architecture/engine/quality.md#performance-budgets), and
the issue that will fix each missed budget. Statistical budgets only report until it holds three
runs on `main`; a run on another branch is kept as information and never counts. How runs are
recorded, and what fails CI once they are, is in
[what ENG-15 decided](../architecture/engine/quality.md#what-eng-15-decided).

Record a run from the `report.json` of its `performance-report` artifact:

```sh
gh run download <run id> --name performance-report --dir perf-results/main-1
npm run perf:baseline -- --label "main run 1/3" perf-results/main-1/report.json
```
