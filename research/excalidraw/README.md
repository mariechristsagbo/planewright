# Guest-mode behavioural research tooling

Bounded, reproducible tooling for issue #1. It observes the public reference application as an
unauthenticated guest. It never logs in, fetches source maps, or installs reference packages, and
it never writes raw third-party content into this repository. See
[the methodology](../../docs/reverse-engineering/methodology.md) for the evidence rules.

| File                     | Purpose                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser.sh`             | Starts/stops a disposable Chromium in a non-root container on a per-run network; DevTools published on `127.0.0.1` only. A failed start removes only what it created; stop removes only labelled resources. |
| `isolation-check.sh`     | Proves the DevTools isolation on `about:blank`: host access works, other containers cannot connect. A probe that cannot run is a FAIL.                                                                      |
| `driver.mjs`             | Loopback-only interaction driver (Playwright over CDP); appends every step, including failures, to `timeline.jsonl`.                                                                                        |
| `run.mjs`                | Sends a scenario name or an inline step batch; `--quit` stops the driver.                                                                                                                                   |
| `selftest.sh`            | End-to-end driver self-test on `about:blank` and `fixtures/selftest.html`; contacts no website.                                                                                                             |
| `lib/server.mjs`         | HTTP wiring, request checks, body cap, batch admission (one at a time, `runLast` lock), step runner and token file.                                                                                         |
| `lib/guard.mjs`          | Request, name, path, port and navigation rules.                                                                                                                                                             |
| `lib/steps.mjs`          | Emulation with read-back assertions (offline included), navigation, fixtures, downloads, dialogs, select options, role clicks that can leave an expanded menu item alone, ARIA.                             |
| `lib/capture.mjs`        | CDP screenshots with masks, and the refusal rules for captures.                                                                                                                                             |
| `lib/files.mjs`          | Exclusive-create writes: an output name is never overwritten.                                                                                                                                               |
| `lib/session-state.mjs`  | Keeps the `runLast` lock and the halt reason in `$OUT/driver-state.json`, so a driver restart keeps both.                                                                                                   |
| `lib/navwatch.mjs`       | Halts the session when the page itself navigates off the allowlist or opens a popup.                                                                                                                        |
| `lib/probe-outcome.sh`   | Classifies isolation probe runs; a probe error never counts as isolation.                                                                                                                                   |
| `lib/resource-state.sh`  | Reports a container or network as PRESENT, ABSENT or UNKNOWN; a failed docker listing never counts as removed.                                                                                              |
| `lib/selftest-checks.sh` | The self-test's driver-stopped, ARIA and removal checks; each passes only on positive proof (a refused connection, a non-empty redacted file, a successful listing).                                        |
| `lib/input.mjs`          | Pointer, keyboard, wheel and touch input, including a one-finger touch path through waypoints.                                                                                                              |
| `lib/metrics.mjs`        | Layout metric read-back and the fail-fast comparison.                                                                                                                                                       |
| `lib/sanitise.mjs`       | URL shapes, query stripping, secret-shape counting and redaction.                                                                                                                                           |
| `lib/png.mjs`            | Minimal PNG codec used to paint masks and to verify them.                                                                                                                                                   |
| `lib/probes.mjs`         | Reads of session-created state: storage key inventory, scene and appState shape (an arrow's elbowed flag, a link's origin and path, freehand pressure, Preferences flags), clipboard and URL shape.         |
| `lib/view-probes.mjs`    | The focused element and live regions, the connection and service worker state, and the language and named button boxes.                                                                                     |
| `lib/netlog.mjs`         | Metadata-only network log (no headers, cookies, bodies or query values).                                                                                                                                    |
| `scenarios/*.json`       | Replayable step batches; coordinates assume the stated viewport and default zoom.                                                                                                                           |
| `check-masks.mjs`        | Verifies, without displaying images, that every masked region of every masked capture is painted.                                                                                                           |
| `secret-scan.mjs`        | Scans trees or stdin for secret-shaped values and prints only file names, shape names and counts.                                                                                                           |
| `timeline-summary.mjs`   | Reduces labelled probes to geometry/selection/zoom rows; `--points` adds point counts, `--text` a text's font fields, `--modes` the stored mode flags; elbowed, link and pressure fields kept when read.    |
| `rea-extract.mjs`        | Verifies saved REA screenshot Evidence (digest, bytes, PNG size) or reduces page inspections to names and keys.                                                                                             |
| `api-surface.mjs`        | Counts standard web-platform identifiers in REA-exported shipped scripts; prints counts only.                                                                                                               |
| `build-evidence.mjs`     | Builds the committed, sanitized evidence index from external session directories.                                                                                                                           |
| `rea-windows.mjs`        | Summarises each saved REA observation window (bounds, what the tool retains, event counts) against the driver steps that started inside it; pure logic in `lib/windows.mjs`.                                |
| `netlog-steps.mjs`       | Sets every netlog entry against the timeline step that had started last when the driver wrote it, and summarises the drawing steps; pure logic in `lib/placement.mjs`.                                      |
| `rea-bundle.mjs`         | Lays saved REA records (CLI output or MCP records) out as one canonical Evidence bundle for REA's own import to validate; pure logic in `lib/bundle.mjs`.                                                   |

## Checks that contact no website

```sh
research/excalidraw/isolation-check.sh        # DevTools isolation, 11 checks
research/excalidraw/selftest.sh               # driver end to end on a self-authored fixture, 19 checks
npx vitest run --project 'research:*'         # unit and integration tests
```

## Reproduce a session

```sh
OUT=/absolute/path/outside/the/repo/s12-desktop     # a new directory per session
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

REA observes the same browser through `http://127.0.0.1:9222`. From s6 to s11 this ran through the
CLI of the REA build, started in the background just before a driver batch: in s6 and s7 for
example `node ../rea-build/scripts/rea.mjs observe-web-session http://127.0.0.1:9222 <target>
--observation-ms 40000 --format json --full-output`, and in s8–s11 `inspect-web-page` with
`--allowed-origins https://excalidraw.com --observation-ms 40000 --include-storage-keys` (45000
in s11), started 5 s before the batch (8 s in s11). The initial-page inspections of s8–s11 used
`--observation-ms 2000` with accessibility, console and WebSocket-shape text approved, as s1's
did. In s12–s16 `inspect-web-page` ran with one `--allowed-origins` flag for each of the 7
HTTP(S) origins of the s1–s11 netlogs and `--include-storage-keys`, started 6–8 s before the
batch. Each output went straight to `$OUT/rea/` in the workspace artifact tree.
`rea-bundle.mjs` lays saved records out as a bundle for REA's own import (`rea evidence-import`,
or the MCP `import_evidence_bundle` and `export_evidence_bundle` tools; R-73).

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
  are accepted, and each runs at most once. Inline batches cannot set or pass the lock. The lock
  and any halt reason are kept in `$OUT/driver-state.json`, so a driver restarted on the same
  `--out` keeps both; a malformed state file stops the driver.
- **Navigation.** `goto` accepts only `about:blank` and `https:` URLs on `https://excalidraw.com`
  without credentials; `blob:` URLs are refused even though they report that origin. A `goto`
  that lands off the allowlist after redirects is fatal. Navigations the page starts itself are
  watched: when the main frame leaves the allowlist or a popup opens, the popup is closed and every
  later step fails fatally (`Session halted: …`). A driver that attaches to a page already off
  the allowlist starts halted. A room or `json` link value in the URL, at attach or after a
  navigation, also halts the session unless a `runLast` scenario has started, so a driver
  restarted on a new `--out` against a page still in a room cannot run other scenarios there.
  Such a request has already been sent by then;
  see [limitations](../../docs/reverse-engineering/limitations.md#tooling-limits). Self-authored
  pages load through the `fixture` step from `$OUT/../fixtures`.
- **Names.** Output names (`screenshot.name`, `aria.save`, `download.name`) and fixture names
  must be plain file names. Screenshots, ARIA files and downloads are created with `O_EXCL`, so
  a used name fails with `EEXIST` and the earlier file stays intact.
- **Emulation.** `emulate` sets the device metrics, screen, touch and user agent, then asserts the
  read-back. A step may also name a `screenOrientation` (a CDP type and an angle of 0, 90, 180
  or 270), which is checked before any CDP call and expected back; without one, headless
  Chromium keeps the landscape-primary orientation of its 800×600 default screen even for a
  portrait phone screen, so `09` asks for portrait-primary at angle 0 (from s15 on).
  `assertMetrics` checks a loaded page, including the screen orientation when expected and
  canvas backing store = CSS size × DPR. Any mismatch is fatal and stops the batch even with
  `continueOnError`.
- **Offline.** `offline` sets the browser context offline or back online, which sends CDP network
  conditions to the page and to each service worker Playwright has attached, and then reads
  `navigator.onLine` back; a read that disagrees is fatal. It changes nothing else, the user agent
  included, and the driver itself stays reachable, as it listens on the host's loopback.
  Playwright skips a value its context already holds, while an offline reload leaves
  `navigator.onLine` true (s60, s63, and a local reload of `about:blank`), so the step also sends
  the same conditions to the page on the driver's own CDP session: repeated after a reload, it
  applies the value again.
- **Screenshots** use CDP `Page.captureScreenshot` on the driver's own session. Playwright's
  `page.screenshot()` was found to reset emulated DPR and screen until the next navigation.
  `mask` selectors are painted onto the decoded image before writing. Every requested mask must
  yield at least one non-empty box that lies at least partly inside the viewport, or nothing is
  captured; an off-screen box paints nothing, so it does not count. While the live URL fragment
  holds a `room` or `json` link value (in any of the forms listed under Privacy), a screenshot
  is refused unless its masks produced boxes and every on-screen element that may show the value
  lies inside one mask box: each input, textarea, image and canvas in a `[role=dialog]`, and
  each element whose text names a room or link key. An SVG code, a value split across elements
  or a shadow root is not detected. A URL that gains such a value while the capture runs is
  refused. `refuseIf` refuses the capture while a selector matches. `check-masks.mjs` fails a
  masked capture that recorded no box.
- **Privacy.** ARIA text, dialog messages, error text, download names (reported and on disk) and
  clipboard previews are redacted, including `room` and `json` link values. The key name and its
  `=` and `,` separators match in any case and any mix of literal and percent-encoded
  characters, at any depth (`room=<id>%2C<key>`, `room%3D`, `%72oom=`, `room%253D`, ...); the
  whole value up to the next delimiter is replaced, however it is encoded. The secret-shape
  count also reads the ASCII-decoded text, so a value whose own characters are encoded is
  counted. The clipboard text is redacted in full before its preview is cut. URL probes and the netlog return key names and value
  lengths only; a key that is not a plain identifier is replaced by `<non-identifier>`.
- **Failures.** Every step is appended to `timeline.jsonl`, with every string of the step and of
  its result redacted, keys included. The HTTP reply, and so what `run.mjs` prints, carries that
  redacted result, not the one the handler returned; handlers still receive the step as sent.
  Failures keep a sanitised one-line message, redacted before it is cut to length, because these
  messages reach the committed `sessions.json`. A failed trigger in `download`, `fileChooser` or `acceptDialog` fails its step
  and leaves no pending waiter that could stop the driver.
- **Cleanup checks.** `isolation-check.sh` and `selftest.sh` pass a removal check only when a
  successful docker listing omits the name; a failed listing is a FAIL. `browser.sh stop` reports
  "no … with the research label" only after a listing that worked, and otherwise fails with
  state UNKNOWN.
- **REA extraction.** `rea-extract.mjs` reads an Evidence record saved by the MCP server or the
  `{ ok, data }` output of the REA CLI. CLI output that does not report `ok: true`, or holds no
  Evidence record, is refused with a message and nothing is written; `rea-windows.mjs` reads
  records the same way, so a failed call stops its build instead of being summarised as a
  window or left out without notice, and its message names the session and file. A file that is
  not valid JSON is refused the same way by both scripts, and so is a timeline line that is not
  by `rea-windows.mjs`: the message names the file, or the line by its number, and never quotes
  it, because a JSON parse error can quote a page URL. `rea-extract.mjs` needs an input ending
  in `.json` and never replaces an existing PNG with different bytes. The optional summary file
  is created exclusively, so an existing file, the input included, is never replaced.
  Accessible names and descriptions, and REA's own condition and limitation text, are redacted
  before they are copied into a summary.
- **Netlog placement.** `netlog-steps.mjs` sets every netlog entry against the timeline step
  that had started last when the driver wrote it, with its offset from that step's start. Both
  files take their times from the driver process's clock. The netlog writes a request once it has
  finished or failed, so a placement bounds when the request started but never gives that time,
  and the timeline records when each step started, not when it ended. Rows that started in the
  same millisecond keep the order in which their steps started: a step with a trigger comes before
  the rows of its trigger, which the driver writes before it, and other rows keep their line
  order. A missing file, or a line that is not valid JSON or has no time in the canonical form
  that the driver writes (`toISOString`, with milliseconds and `Z`), stops the build and is
  named, never quoted. Netlogs written from s12 on also carry each request's start (`startedAt`,
  null when the driver did not see it); a placed entry then ends with its start offset from the
  same step start, and the drawing summary counts the request starts that fell in a drawing step.

## Scenario order and dependencies

Most scenarios continue from the previous one's end state. `00` (desktop) and `09` (mobile) emulate
before the first navigation; `00c` re-emulates after a driver restart, and `11` re-emulates on
purpose to probe DPR; `52` and `57` re-emulate on purpose to resize the loaded page (R-23). Every
main scenario asserts the metrics before its first input (02 right after its own load; 00b, 00c and 09b after their reload); the short follow-on
scenarios 02b, 02c, 03b, 04b, 07b, 08b and 10b rely on the one before them.

| Session                | Order                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop (`s1`)         | 00 → 01 → 02 → 02b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 08 → 08b (earlier versions; see below)                                                                                                                                           |
| Fresh rerun (`s2`)     | 02 (it loads the page itself) → 03 → 05                                                                                                                                                                                                                |
| Mobile (`s3`)          | 09 → 10 → 10b (earlier versions)                                                                                                                                                                                                                       |
| DPR probe (`s4`)       | 09 → 11                                                                                                                                                                                                                                                |
| Aborted (`s5`)         | 00 → 01 (aborted at its first step by the metrics assertion)                                                                                                                                                                                           |
| Desktop rerun (`s6`)   | 00 → 01✗ → 02 → 00b✗ → 00c → 00b → 02c → 00b → 02b → 12✗ → 01✗ → 00c → 12 → 01 → 13 → 00b → 03 → 03b → 04 → 04b → 05 → 06 → 06b → 07 → 07b → 15 → 08 → 08b (✗ = aborted by the metrics assertion: 01 and 12 at their first step, 00b after its reload) |
| Mobile rerun (`s7`)    | 09 → 10 → 10b → 14 → 11                                                                                                                                                                                                                                |
| Desktop R-76 (`s8`)    | 00 → 12 → 16                                                                                                                                                                                                                                           |
| Desktop R-76 (`s9`)    | 00 → 13 → 16                                                                                                                                                                                                                                           |
| Desktop R-76 (`s10`)   | 00 → 07c → 15 → 16                                                                                                                                                                                                                                     |
| Mobile R-76 (`s11`)    | 09 → 16 → 10 → 14 → 16                                                                                                                                                                                                                                 |
| Observation (`s12`)    | 09 → 10 → 22 → 16                                                                                                                                                                                                                                      |
| Observation (`s13`)    | 00 → 12✗ → 23✗ → 16 (✗ = stopped at its first step, the metrics assertion, on the verification page)                                                                                                                                                   |
| Observation (`s14`)    | 00 → 17✗                                                                                                                                                                                                                                               |
| Follow-up (`s15`)      | 09 → 19                                                                                                                                                                                                                                                |
| Follow-up (`s16`)      | 09 → 10 → 22 → 16 → 24                                                                                                                                                                                                                                 |
| Priority-1 (`s17`)     | 09 → 25 → 27 → 24 → 16                                                                                                                                                                                                                                 |
| Priority-1 (`s18`)     | 09 → 26 → 16                                                                                                                                                                                                                                           |
| Priority-1 (`s19`)     | 09 → 25 → 27 → 24 → 16                                                                                                                                                                                                                                 |
| Priority-1 (`s20`)     | 09 → 26 → 16                                                                                                                                                                                                                                           |
| Priority-1 (`s21`)     | 09 → 25 → 27 → 24 → 16                                                                                                                                                                                                                                 |
| Touch controls (`s22`) | 09 → 28 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s23`) | 09 → 29 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s24`) | 09 → 30 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s25`) | 09 → 31 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s26`) | 09 → 32 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s27`) | 09 → 33 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s28`) | 09 → 29 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s29`) | 09 → 30 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s30`) | 09 → 31 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s31`) | 09 → 32 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s32`) | 09 → 33 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s33`) | 09 → 34 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s34`) | 09 → 35 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s35`) | 09 → 34 → 16                                                                                                                                                                                                                                           |
| Touch controls (`s36`) | 09 → 35 → 16                                                                                                                                                                                                                                           |
| Controls (`s37`)       | 09 → 36 → 16                                                                                                                                                                                                                                           |
| Controls (`s38`)       | 09 → 37 → 16                                                                                                                                                                                                                                           |
| Controls (`s39`)       | 09 → 38 → 16                                                                                                                                                                                                                                           |
| Controls (`s40`)       | 09 → 39 → 16                                                                                                                                                                                                                                           |
| Controls (`s41`)       | 09 → 40 → 16                                                                                                                                                                                                                                           |
| Controls (`s42`)       | 09 → 37 → 16                                                                                                                                                                                                                                           |
| Controls (`s43`)       | 09 → 38 → 16                                                                                                                                                                                                                                           |
| Controls (`s44`)       | 09 → 39 → 16                                                                                                                                                                                                                                           |
| Controls (`s45`)       | 09 → 40 → 16                                                                                                                                                                                                                                           |
| Controls (`s46`)       | 09 → 41 → 16                                                                                                                                                                                                                                           |
| Controls (`s47`)       | 09 → 41 → 16                                                                                                                                                                                                                                           |
| Controls (`s48`)       | 09 → 42 → 16                                                                                                                                                                                                                                           |
| Controls (`s49`)       | 09 → 42 → 43 → 16                                                                                                                                                                                                                                      |
| Controls (`s50`)       | 09, stopped by the load gate (verification page), so 44 never ran                                                                                                                                                                                      |
| Keyboard (`s58`)       | 09 (load check)                                                                                                                                                                                                                                        |
| Keyboard (`s59`)       | 09 → 49 → 52 → 16                                                                                                                                                                                                                                      |
| Offline (`s60`)        | 09 → 50 → 51 → 24 → 16                                                                                                                                                                                                                                 |
| Menus (`s61`)          | 09 → 53 → 54 → 55 → 16                                                                                                                                                                                                                                 |
| Keyboard (`s62`)       | 09 → 49 → 56 → 52 → 57 → 16                                                                                                                                                                                                                            |
| Offline (`s63`)        | 09 → 50 → 51 → 24 → 16                                                                                                                                                                                                                                 |
| Menus (`s64`)          | 09 → 53 → 54 → 58 → 59 → 16; a 403 on 54's locale chunk then stopped live contact, so the s65 planned then never ran                                                                                                                                   |
| Replays (`s65`)        | 09 → 49 → 56 → 52 → 57 → 16                                                                                                                                                                                                                            |
| Replays (`s66`)        | 09 → 53 → 58 → 59 → 16                                                                                                                                                                                                                                 |
| Replays (`s67`)        | 09 → 53 → 55 → 16                                                                                                                                                                                                                                      |
| Library undo (`s68`)   | 09 → 60 → 09b → 50 → 61 → 51 → 24 → 16                                                                                                                                                                                                                 |
| Library undo (`s69`)   | 09 → 60 → 09b → 50 → 61 → 51 → 24 → 16                                                                                                                                                                                                                 |
| Language (`s70`)       | 09 → 53 → 54 → 16                                                                                                                                                                                                                                      |

- **R-76 sessions (s8–s11).** Each ran in its own new container and profile, on 2026-11-05.
  Between the driver batches the REA CLI listed the targets and ran a 2 s initial-page
  inspection after 00 or 09, then an `inspect-web-page` window armed before 12, 13, 15 or 14.
  The two `16` runs of s11 read storage before 10 and after 14.
- **Planned s6 order.** It was 00 → 01 → 02 → 02c → 02b → 12 → 13 → 03 …. The extra `00b`/`00c`
  runs and the late 01 come from the metric aborts and two driver restarts recorded in the
  [checkpoint](../../docs/reverse-engineering/checkpoint.md#interrupted-and-aborted-runs).
  The aborted 01 and 12 runs stopped at their first step, the assertion, and changed nothing.
  The aborted 00b stopped at its assertion, after its reload had run; that reload is counted
  among s6's 9 page loads. One 02c attempt never reached
  the driver (a client path error), and one diagnostic `metrics` read was sent inline.
- **Dependencies:**
  - `03` clears the canvas first, so it does not depend on 02's content.
  - `12` and `13` clear the canvas and leave it empty.
  - `04` needs 03's end state.
  - `05` starts by undoing twice, to remove 04b's dots. When it runs straight after 03 (as in
    `s2`), those undos revert 03 steps instead, so its zoom-to-fit scroll differs.
  - `06` and `15` assume 05's scroll of (90,45).
  - `07c` repeats only 07's dark-theme switch, with a read-back and no capture, so that 15 can
    run in a fresh session straight after 00 (R-76). 15 then starts without the scene, scroll
    and style defaults that 01–07b leave.
  - `17`, `18`, `20`, `21` and `23` run after `00`, and `19` and `22` after `09`, each in a fresh
    session (17–19 keep each export alone in its session; 20 publishes the scene once).
  - `24` sends no input: it reads and captures a drawn scene, reloads with 09b's reload, wait and
    assertion, and reads and captures again, so it runs after a scenario that leaves a drawn
    scene (after 22 and 16 in s16, and after 27 in s17, s19 and s21).
  - `25` and `26` run right after `09`, each in a fresh session, because their touch points
    assume zoom 1, scroll (0,0) and an empty canvas. `27` runs after `25`, whose rectangles stay
    above its pinch, and before `24`, so that 24 reloads with a selection at a zoom other than 1.
  - `28` to `35` run right after `09`, each in a fresh session, for the same reason. `28` saves
    the ARIA of every popover of the compact property bar, and `31`–`33` click each control by
    the exact name it saved in s22; `32` touches the style popover's unnamed radios at the button
    centres of s22's capture. `31` and `32` deselect and reselect before every popover they
    open, so no step depends on whether an action closes its popover. `34` and `35` cover what
    s25–s27 left open, with names that those sessions saved.
  - `36` runs right after `09` in a fresh session too. It saves what the next mobile scenarios
    need and s22 did not save: the Stroke colour popover once a colour with shades is picked, the
    bar for a text, for the Draw tool and for a freehand stroke, the result of Edit arrow, and the
    Save to... dialog, which it closes without touching any entry, so nothing is saved or uploaded.
  - `37` to `40` run right after `09`, each in a fresh session, and use the names and positions
    that s22, s34 and s37 saved: the four handles that 30 left and a two-element resize (37),
    Diamond and Ellipse from the Rectangle tool's choice with three alignments (38), the Arrow
    type popover's unnamed radios, touched at the centres measured on s34's capture, and Edit
    arrow (39), and a shade, a typed hex code, Duplicate and the text and freehand popovers (40).
    40 types into the hex box and a new text with the keyboard, which stands in for the phone's.
  - `41` and `42` run right after `09`, each in a fresh session: 41 opens Text align and picks a
    font, 42 inserts the Mermaid dialog's offered definition, each with Undo and Redo. `43` sends
    one Text to diagram prompt; run it once, after 42 in one session only, to keep the generation
    requests to one. `44` uploads the scene once with Export to Link; run it once, right after
    `09` in its own fresh session, with no REA call during or after it, because REA records keep
    URL fragments and DOM attributes, and in no other session.
  - `45` and `46` run right after `09`, each in a fresh session: 45 touches the unnamed Font size,
    Text align, Stroke width and Pressure radios at the centres measured on s46's and s41's captures
    and draws an Autoshape stroke with `touchPath`, 46 taps Delete, adds a fourth point to a sharp
    arrow and deletes a point in Edit arrow, and aligns a group with a rectangle, with Undo after each
    change. `47` runs right after 46 in the same session and adds a self-authored link on a reserved
    example domain; it stops at its first failed step, so nothing is typed unless its textbox was
    clicked, and it never follows the link.
  - `48` runs right after 45 in the same session: s54 found midpoint handles on a three-point
    arrow only in Edit arrow, so 48 adds the fourth point from one there, with Undo and Redo, then
    taps the new point and Delete in the Actions popover, then Undo.
  - `49` to `55` run right after `09`, each in a fresh session unless named below, and use only the
    names that s7, s22 and s58 saved. `49` presses Tab 30 times and Shift+Tab 4 times and reads the
    focus after each press; it presses no Enter or Space, so nothing is activated and no link is
    followed. `50` draws, goes offline with the `offline` step and reloads offline, and sends no
    input after its reload; `51` runs straight after it, still offline, asserts the metrics, draws,
    and goes back online with no input after that; `24` then reloads online. `52` emulates ten
    viewports in turn on the loaded page, with no input, no reload and no user agent, asserts each,
    and ends at 390×844 portrait again. `53` writes two self-authored words and searches for one
    with Find on canvas; it stops at its first failed step, so nothing is typed unless its textbox
    was clicked. `54` switches the language to Français and back with `selectOption` and opens
    Canvas background without picking a colour, and `55` opens the Library sidebar with and
    without a selection, adding nothing and following no link.
  - `56` to `59` use what s59 and s61 saved. `56` presses Enter and Space only on the Library
    button it has just clicked, which s61 found then holds the focus, and before any Tab; it then
    reads the focus after each Tab from Selection, in the main menu and in the Help dialog. `57`
    refines 52's ladder where s59 saw the layout switch, with no input. `58` adds a selection to
    the library with the add tile at (136,214), where s61's capture shows it, and places the item
    from the same point. `59` types a hex code into the box named Canvas background; it stops at
    its first failed step, so nothing is typed unless that box was clicked.
  - The replay batch (s65–s67) ran s62's chain again, and s64's and s61's without 54, whose locale
    chunk got HTTP 403 in s64: 58 and 59 after 53 (s66), and 55 after 53 (s67).
  - `60` runs right after `09`, with an empty library and nothing on the canvas where it draws or
    taps. It repeats 58's add and placement at (136,214) and presses Undo and Redo by name after
    each, reading the scene and the app state after every press; it taps Close before the first
    Undo, so that no sidebar covers the button. `61` runs right after `50`, still offline, and
    before `51`. It sends no input: it reads the connection state that 50's offline reload left and
    repeats the `offline` step with the value 50 set, which the driver applies again on its own
    session, then waits 6 s and reads again, so 51 then draws offline in a page that reads offline.
  - s68 and s69 ran 60 right after 09, then 09b, whose reload had never run, then 50, and 61 and 51
    inside one REA window, because in a local test a DevTools session that detached from the page
    turned `navigator.onLine` true again; 24 reloaded last. s70 ran 54 again after 53, last in the
    batch, because its locale chunk got HTTP 403 in s64.
  - `62` to `65` run in this order in one session, right after `09`, and use only names s11 and
    s70 saved. `62` draws three rectangles and an arrow and erases a free rectangle, the arrow's
    end target and the arrow with one-finger strokes, with Undo and Redo after each. `63` deselects
    a new rectangle, then picks Toggle grid and Dark mode from the main menu, each followed by Undo
    and Redo, and draws twice with Tool lock on. `64` picks System mode under an emulated colour
    scheme, drags one selection box over part of a rectangle before and after picking Overlap,
    draws an arrow with Arrow binding off and one with it on, and turns the wheel before and after
    picking Mouse. `65` turns Dark mode, Snap to objects and Zen mode on and reloads, then turns View
    mode on and reloads again. Each menu choice reopens the menu, never collapses Preferences
    (`unlessExpanded`) and is closed by a tap at (330,300), outside the menu and its submenu.
  - `66` runs right after `62`: s71 found that Undo and Redo after an erase leave the Selection
    tool active, so 66 picks the Eraser again before it erases the arrow's end target, with Undo,
    Redo and Undo, and before it erases the arrow, with Undo; it then picks the Eraser and presses
    Escape. Its last Undo leaves the scene as 62 left it, so 63 to 65 can follow it.
  - `16` reads the storage key inventory (names, value lengths and shapes; no values). It has no
    input and no navigation, so it runs on desktop or mobile at any point before 08.
- **Earlier versions.** `s1` ran an earlier `02` whose drags started on the properties panel, an
  earlier `07b` that overwrote 07's captures, and earlier emulate steps that `s6` replaced with
  assertions. `s3` ran an earlier `10` that re-emulated. `s3`, `s4`, `s7`, `s11` and `s12` ran `09`
  before it asked for a portrait screen orientation (from `s15` on), and `s12` ran `22` before its
  assertions expected it. `s17` ran an earlier `25` that asked for a swatch named `#a5d8ff`; the
  Background popover names its colours with their shortcut letter (`Blue — s`), so that step
  failed and both of its rectangles stayed transparent.
- **REA.** Run REA calls only outside the collaboration window (`08`, `08b`): REA target
  listings keep URL fragments. The driver's `runLast` lock keeps 08/08b at the end of a session,
  but it cannot see REA calls, so this rule stays manual.

Keep request volume human-scale: one scenario at a time, no loops against the live site, and run
the collaboration scenarios at most once per session.
