# Guest-mode behavioural research tooling

Bounded, reproducible tooling for issue #1. It observes the public reference application as an
unauthenticated guest. It never logs in, fetches source maps, or installs reference packages, and
it never writes raw third-party content into this repository. See
[the methodology](../../docs/reverse-engineering/methodology.md) for the evidence rules.

| File                   | Purpose                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `browser.sh`           | Starts/stops a disposable Chromium in a non-root container; DevTools published on `127.0.0.1` only.                   |
| `driver.mjs`           | Loopback-only interaction driver (Playwright over CDP); appends every step to `timeline.jsonl`.                       |
| `run.mjs`              | Sends a scenario name (or path) or an inline step batch.                                                              |
| `lib/steps.mjs`        | Pointer, keyboard, wheel, touch, file-drop, download, native-dialog and accessibility-snapshot steps.                 |
| `lib/probes.mjs`       | Reads of session-created state: storage key inventory, scene and appState shape, clipboard shape, URL fragment shape. |
| `lib/netlog.mjs`       | Metadata-only network log (no headers, cookies, bodies or query values).                                              |
| `scenarios/*.json`     | Replayable step batches; coordinates assume the stated viewport and default zoom.                                     |
| `timeline-summary.mjs` | Reduces labelled probes to geometry/selection/zoom rows.                                                              |
| `rea-extract.mjs`      | Verifies saved REA screenshot Evidence (digest, bytes, PNG size) or reduces page inspections to names and keys.       |
| `api-surface.mjs`      | Counts standard web-platform identifiers in REA-exported shipped scripts; prints counts only.                         |
| `build-evidence.mjs`   | Builds the committed, sanitized evidence index from external session directories.                                     |

## Reproduce a session

```sh
OUT=/absolute/path/outside/the/repo/s1-desktop
research/excalidraw/browser.sh start pw-research 9222
node research/excalidraw/driver.mjs --cdp http://127.0.0.1:9222 --port 9333 --out "$OUT" &
node research/excalidraw/run.mjs 02-shapes-desktop
node research/excalidraw/timeline-summary.mjs "$OUT/timeline.jsonl"
curl -s http://127.0.0.1:9333/quit
research/excalidraw/browser.sh stop pw-research
```

Scenarios that use the `fileChooser` or `dropFile` steps resolve relative file names against
`$OUT/../fixtures`. The only fixture used so far is a self-generated 64×48 solid-colour PNG.

Keep request volume human-scale: one scenario at a time, no loops against the live site, and run
the collaboration scenario (`08`) once per session at most.
