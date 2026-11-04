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
node research/excalidraw/run.mjs --out "$OUT" 00-initial-load-desktop
node research/excalidraw/run.mjs --out "$OUT" 02-shapes-desktop
node research/excalidraw/timeline-summary.mjs "$OUT/timeline.jsonl"
node research/excalidraw/run.mjs --out "$OUT" --quit
research/excalidraw/browser.sh stop pw-research
```

## Driver protocol and safety

- The driver listens on `127.0.0.1` only. Every request must be a `POST` with
  `Host: 127.0.0.1:<port>` and the per-run token in the `x-research-token` header. `/run`
  also requires `Content-Type: application/json`. `/quit` is protected the same way.
- The token is 32 random bytes, written to `$OUT/driver.token` with mode `0600` at start-up.
  `run.mjs --out "$OUT"` reads it.
- Clients send a scenario **name**, which the driver resolves against its own `scenarios/`
  listing, or an inline batch. Scenario files are never forwarded over HTTP.
- Output names (`screenshot.name`, `aria.save`, `download.name`) and fixture names (`dropFile`,
  `fileChooser`) must be plain file names: letters, digits, `.`, `_` and `-`. Absolute paths and
  traversal are rejected. Fixtures resolve inside `$OUT/../fixtures`. The only fixture so far
  is a self-generated 64×48 solid-colour PNG.
- Every step, including failed ones, is appended to `timeline.jsonl`. Failures are stored as a
  sanitised one-line message with local paths replaced by `<path>`.
- The guard logic is unit-tested in `tests/guard.test.mjs`
  (`npx vitest run --project research:unit`).

## Scenario order and dependencies

Most scenarios continue from the previous one's end state. Coordinates assume that state.

| Session            | Order                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| Desktop (`s1`)     | 00 → 01 → 02 → 02b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 08 → 08b |
| Fresh rerun (`s2`) | 02 (it loads the page itself) → 03 → 05                                        |
| Mobile (`s3`)      | 09 → 10 → 10b                                                                  |
| DPR probe (`s4`)   | 09 → 11                                                                        |

- `03` clears the canvas first, so it does not depend on 02's content. `04` needs 03's end
  state.
- `05` starts by undoing twice, to remove 04b's dots. When it runs straight after 03 (as in
  `s2`), those undos revert 03 steps instead, so its zoom-to-fit scroll differs.
- `06` assumes 05's scroll of (90,45).
- `s1` ran an earlier version of `02` whose drags started on the properties panel. The
  committed `02` is the corrected version that `s2` ran.
- The suffixed scenarios (`02b` … `10b`) are ad-hoc batches from the recorded sessions. They are
  committed so that every committed screenshot or probe name has a scenario.

Keep request volume human-scale: one scenario at a time, no loops against the live site, and run
the collaboration scenarios (`08`, `08b`) once per session at most.
