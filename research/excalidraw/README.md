# Guest-mode behavioural research tooling

Bounded, reproducible tooling for issue #1. It observes the public reference application as an
unauthenticated guest. It never logs in, fetches source maps, or installs reference packages, and
it never writes raw third-party content into this repository. See
[the methodology](../../docs/reverse-engineering/methodology.md) for the evidence rules.

| File                   | Purpose                                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser.sh`           | Starts/stops a disposable Chromium in a non-root container on a per-run network; DevTools published on `127.0.0.1` only. A failed start removes only what it created; stop removes only labelled resources. |
| `isolation-check.sh`   | Proves the DevTools isolation on `about:blank`: host access works, other containers cannot connect. A probe that cannot run is a FAIL.                                                                      |
| `driver.mjs`           | Loopback-only interaction driver (Playwright over CDP); appends every step, including failures, to `timeline.jsonl`.                                                                                        |
| `run.mjs`              | Sends a scenario name or an inline step batch; `--quit` stops the driver.                                                                                                                                   |
| `selftest.sh`          | End-to-end driver self-test on `about:blank` and `fixtures/selftest.html`; contacts no website.                                                                                                             |
| `lib/server.mjs`       | HTTP wiring, request checks, body cap, batch admission (one at a time, `runLast` lock), step runner and token file.                                                                                         |
| `lib/guard.mjs`        | Request, name, path, port and navigation rules.                                                                                                                                                             |
| `lib/steps.mjs`        | Emulation with read-back assertions, navigation, fixtures, downloads, dialogs, ARIA.                                                                                                                        |
| `lib/capture.mjs`      | CDP screenshots with masks, and the refusal rules for captures.                                                                                                                                             |
| `lib/files.mjs`        | Exclusive-create writes: an output name is never overwritten.                                                                                                                                               |
| `lib/navwatch.mjs`     | Halts the session when the page itself navigates off the allowlist or opens a popup.                                                                                                                        |
| `lib/probe-outcome.sh` | Classifies isolation probe runs; a probe error never counts as isolation.                                                                                                                                   |
| `lib/input.mjs`        | Pointer, keyboard, wheel and touch input.                                                                                                                                                                   |
| `lib/metrics.mjs`      | Layout metric read-back and the fail-fast comparison.                                                                                                                                                       |
| `lib/sanitise.mjs`     | URL shapes, query stripping, secret-shape counting and redaction.                                                                                                                                           |
| `lib/png.mjs`          | Minimal PNG codec used to paint masks and to verify them.                                                                                                                                                   |
| `lib/probes.mjs`       | Reads of session-created state: storage key inventory, scene and appState shape, clipboard shape, URL fragment shape.                                                                                       |
| `lib/netlog.mjs`       | Metadata-only network log (no headers, cookies, bodies or query values).                                                                                                                                    |
| `scenarios/*.json`     | Replayable step batches; coordinates assume the stated viewport and default zoom.                                                                                                                           |
| `check-masks.mjs`      | Verifies, without displaying images, that every masked region of every masked capture is painted.                                                                                                           |
| `secret-scan.mjs`      | Scans trees or stdin for secret-shaped values and prints only file names, shape names and counts.                                                                                                           |
| `timeline-summary.mjs` | Reduces labelled probes to geometry/selection/zoom rows.                                                                                                                                                    |
| `rea-extract.mjs`      | Verifies saved REA screenshot Evidence (digest, bytes, PNG size) or reduces page inspections to names and keys.                                                                                             |
| `api-surface.mjs`      | Counts standard web-platform identifiers in REA-exported shipped scripts; prints counts only.                                                                                                               |
| `build-evidence.mjs`   | Builds the committed, sanitized evidence index from external session directories.                                                                                                                           |

## Checks that contact no website

```sh
research/excalidraw/isolation-check.sh        # DevTools isolation, 11 checks
research/excalidraw/selftest.sh               # driver end to end on a self-authored fixture
npx vitest run --project 'research:*'         # unit and integration tests
```

## Reproduce a session

```sh
OUT=/absolute/path/outside/the/repo/s8-desktop      # a new directory per session
research/excalidraw/browser.sh start pw-research 9222
node research/excalidraw/driver.mjs --cdp http://127.0.0.1:9222 --port 9333 --out "$OUT" &
node research/excalidraw/run.mjs --out "$OUT" 00-initial-load-desktop
node research/excalidraw/run.mjs --out "$OUT" 02-shapes-desktop
node research/excalidraw/timeline-summary.mjs "$OUT/timeline.jsonl"
node research/excalidraw/check-masks.mjs "$OUT"     # after any masked capture
node research/excalidraw/run.mjs --out "$OUT" --quit
research/excalidraw/browser.sh stop pw-research     # also removes the run network
rm -f "$OUT/driver.token"
```

REA observes the same browser through `http://127.0.0.1:9222`. In s6 and s7 this ran through the
CLI of the REA build (for example `node ../rea-build/scripts/rea.mjs observe-web-session
http://127.0.0.1:9222 <target> --observation-ms 40000 --format json --full-output`), started in
the background just before a driver batch.

## Driver protocol and safety

- **Requests.** The driver listens on `127.0.0.1` only. Every request must:
  - be a `POST` with `Host: 127.0.0.1:<port>`;
  - carry no foreign `Origin` and no cross-site Fetch Metadata;
  - carry the per-run token in the `x-research-token` header.

  `/run` also needs `Content-Type: application/json`. Bodies over 256 KiB are refused (declared
  or streamed) before any parsing. `/quit` is protected the same way.

- **Token.** The token is 32 random bytes, written to `$OUT/driver.token` with mode `0600`. A
  stale file is replaced, never reused. `run.mjs --out "$OUT"` reads it.
- **Scenarios.** Clients send a scenario **name**, which the driver resolves against the
  `scenarios/` listing it read at start-up, or an inline batch. One batch runs at a time; a batch
  sent while another runs gets `409` and runs nothing. Scenario files marked `runLast` (`08`,
  `08b`) lock the session: once one starts, only the other unrun `runLast` scenario and `--quit`
  are accepted, and each runs at most once. Inline batches cannot set or pass the lock.
- **Navigation.** `goto` accepts only `about:blank` and `https:` URLs on `https://excalidraw.com`
  without credentials; `blob:` URLs are refused even though they report that origin. A `goto`
  that lands off the allowlist after redirects is fatal. Navigations the page starts itself are
  watched: when the main frame leaves the allowlist or a popup opens, the popup is closed and every
  later step fails fatally (`Session halted: …`). Such a request has already been sent by then;
  see [limitations](../../docs/reverse-engineering/limitations.md#tooling-limits). Self-authored
  pages load through the `fixture` step from `$OUT/../fixtures`.
- **Names.** Output names (`screenshot.name`, `aria.save`, `download.name`) and fixture names
  must be plain file names. Screenshots, ARIA files and downloads are created with `O_EXCL`, so
  a used name fails with `EEXIST` and the earlier file stays intact.
- **Emulation.** `emulate` sets the device metrics, screen, touch and user agent, then asserts the
  read-back. `assertMetrics` checks a loaded page, including canvas backing store = CSS size ×
  DPR. Any mismatch is fatal and stops the batch even with `continueOnError`.
- **Screenshots** use CDP `Page.captureScreenshot` on the driver's own session. Playwright's
  `page.screenshot()` was found to reset emulated DPR and screen until the next navigation.
  `mask` selectors are painted onto the decoded image before writing. Every requested mask must
  yield at least one visible, non-empty box, or nothing is captured. While the live URL fragment
  holds a `room` or `json` link value (also percent-encoded), checked before and after the
  capture, a screenshot is refused unless its masks produced boxes. `refuseIf` refuses the capture
  while a selector matches. `check-masks.mjs` fails a masked capture that recorded no box.
- **Privacy.** ARIA text, dialog messages, download names and clipboard previews are redacted,
  including percent-encoded `room%3D` values and `json=` link values. The clipboard text is
  redacted in full before its preview is cut. URL probes and the netlog return key names and value
  lengths only; a key that is not a plain identifier is replaced by `<non-identifier>`.
- **Failures.** Every step is appended to `timeline.jsonl`; failures keep a sanitised one-line
  message.

## Scenario order and dependencies

Most scenarios continue from the previous one's end state. Only `00` (desktop) and `09` (mobile)
emulate, before the first navigation; every later scenario asserts the metrics first.

| Session              | Order                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop (`s1`)       | 00 → 01 → 02 → 02b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 08 → 08b (earlier versions; see below)                                                                               |
| Fresh rerun (`s2`)   | 02 (it loads the page itself) → 03 → 05                                                                                                                                                    |
| Mobile (`s3`)        | 09 → 10 → 10b (earlier versions)                                                                                                                                                           |
| DPR probe (`s4`)     | 09 → 11                                                                                                                                                                                    |
| Aborted (`s5`)       | 00 → 01 (aborted at its first step by the metrics assertion)                                                                                                                               |
| Desktop rerun (`s6`) | 00 → 01✗ → 02 → 00b✗ → 00c → 00b → 02c → 00b → 02b → 12✗ → 01✗ → 00c → 12 → 01 → 13 → 00b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 15 → 08 → 08b (✗ = aborted at its first step) |
| Mobile rerun (`s7`)  | 09 → 10 → 10b → 14 → 11                                                                                                                                                                    |

- **Planned s6 order.** It was 00 → 01 → 02 → 02c → 02b → 12 → 13 → 03 …. The extra `00b`/`00c`
  runs and the late 01 come from the metric aborts and two driver restarts recorded in the
  [checkpoint](../../docs/reverse-engineering/checkpoint.md#interrupted-and-aborted-runs).
  Aborted runs stopped at their first step and changed nothing. One 02c attempt never reached
  the driver (a client path error), and one diagnostic `metrics` read was sent inline.
- **Dependencies:**
  - `03` clears the canvas first, so it does not depend on 02's content.
  - `12` and `13` clear the canvas and leave it empty.
  - `04` needs 03's end state.
  - `05` starts by undoing twice, to remove 04b's dots. When it runs straight after 03 (as in
    `s2`), those undos revert 03 steps instead, so its zoom-to-fit scroll differs.
  - `06` and `15` assume 05's scroll of (90,45).
- **Earlier versions.** `s1` ran an earlier `02` whose drags started on the properties panel, an
  earlier `07b` that overwrote 07's captures, and earlier emulate steps that `s6` replaced with
  assertions. `s3` ran an earlier `10` that re-emulated.
- **REA.** Run REA calls only outside the collaboration window (`08`, `08b`): REA target
  listings keep URL fragments. The driver's `runLast` lock keeps 08/08b at the end of a session,
  but it cannot see REA calls, so this rule stays manual.

Keep request volume human-scale: one scenario at a time, no loops against the live site, and run
the collaboration scenarios at most once per session.
