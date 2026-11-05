# Methodology: clean-room guest-mode behavioural research

Issue: #1. Reference: the public `https://excalidraw.com/` application, used as an
unauthenticated guest. Planewright is not affiliated with Excalidraw or REA; see
[ADR 0003](../adr/0003-clean-room-reference-policy.md).

## Clean-room rules applied

| Rule                                                   | How it was applied                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No reference source repository, package or source maps | Nothing was cloned or installed. `analyze_web_bundle`, the only REA operation that can fetch source maps, ran with `fetch_source_maps: false`. The driver netlogs of all seven sessions contain 0 `.map` requests.                                                                                                                                                                              |
| Shipped bundles are observable artefacts only          | REA captured the scripts the browser received and exported them to a directory **outside** the repository. The only derived output is `evidence/static-api-surface.json`: occurrence counts of standard web-platform identifiers, with no code excerpts.                                                                                                                                        |
| No copied code, components, assets or text             | Docs describe behaviour in our own words. Control names are quoted only where they are needed to identify the control. Screenshots, ARIA snapshot text and bundles are not committed.                                                                                                                                                                                                           |
| Guest only; no protection bypass                       | No login, sign-up, Excalidraw+ or generation feature was used. Two live-collaboration sessions were started, one in s1 and one in s6. "Export to Link" was not clicked, because it publishes the scene.                                                                                                                                                                                         |
| Human-scale request volume                             | 7 short sessions. The reference page was loaded or navigated 17 times in total (s1: 3, s2–s5: 1 each, s6: 9 including the reloads that restore emulation, s7: 1), counted from the `goto` and `reload` steps in `evidence/sessions.json`. Two collaboration rooms were created. Everything else (isolation check, self-test, emulation probes) ran on `about:blank` or a self-authored fixture. |

## Evidence labels

Every claim in this directory carries one label:

- **[O] Observed**: reproduced through runtime interaction and read back from the DOM or
  accessibility tree, storage, screenshot or network metadata.
- **[S] Static**: found in the shipped bundle by REA or by identifier counting. It does not
  prove that the code ran.
- **[I] Inference**: a direct engineering deduction from [O] or [S] facts with no plausible
  alternative reading.
- **[H] Hypothesis**: a plausible explanation that is not confirmed and may be wrong.
- **[U] Unverified**: not observed in this baseline. Each one is tracked in the
  [residual matrix](residual-matrix.md).

Confidence follows one rule:

- **high**: observed with identical results in at least two sessions, at least one of them from
  a fresh profile. Two tools reading the same session (for example REA and the driver) count as
  one session;
- **medium**: observed in one session only, or in sessions whose results differ;
- **low**: indirect.

## Environment

| Item      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date      | 2026-11-04: s1–s4 13:29–14:25 UTC, s5–s7 16:00–16:18 UTC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Browser   | Chrome 156.0.8078.80, headless, from `mcr.microsoft.com/playwright:v1.64.1-noble`, pinned by digest `sha256:2f05f8a7…` from s5 on                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Isolation | One disposable container per session: non-root user, all capabilities dropped, `no-new-privileges`, profile in tmpfs, no host mounts. Chromium's own sandbox cannot run under the container's seccomp profile, so the container is the boundary.                                                                                                                                                                                                                                                                                                                           |
| Network   | s1–s4 used the default Docker bridge. There the DevTools forwarder was reachable from other containers (verified afterwards: a default-bridge probe got `REACHABLE`). From s5 on, each run has its own bridge network with inter-container traffic disabled, and the forwarder accepts only the network gateway, the host side of the published port. `isolation-check.sh` verifies this                                                                                                                                                                                   |
| Ports     | DevTools published only on the host's `127.0.0.1:9222`; driver on `127.0.0.1:9333`, guarded by a per-run token, Host, Origin, method, content-type and body-size checks                                                                                                                                                                                                                                                                                                                                                                                                    |
| REA       | 6.8.0 at build `5b953e13c4451df3afcaab7724c06db5eedf58f7`: the project-local MCP server for s1–s3, the CLI of the same build for s5–s7 (the MCP tools were denied permission)                                                                                                                                                                                                                                                                                                                                                                                              |
| Driver    | Playwright-core 1.64.1 over CDP (`research/excalidraw/driver.mjs`). From s6 on, screenshots use CDP `Page.captureScreenshot` on the driver's own session                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Viewports | Desktop 1280×720 at DPR 1, with a 1280×720 screen. Mobile 390×844 CSS px at DPR 3, with a 390×844 screen, 5 touch points, a coarse pointer and an Android Chrome user agent. Emulation is applied once, before the first navigation. Every main scenario asserts the CSS viewport, DPR, screen, touch points and canvas backing store (CSS size × DPR) before its first input and aborts on any mismatch (02 right after its own load, 00b, 00c and 09b after their reload); the short follow-on scenarios (02b, 02c, 03b, 04b, 07b, 08b, 10b) rely on the one before them |
| Sessions  | `s1-desktop` (472 steps), `s2-desktop-fresh` (179), `s3-mobile` (71), `s4-dpr-probe` (14), `s5-desktop-aborted` (10, stopped by the metrics assertion), `s6-desktop-fresh` (616, the whole desktop chain in one fresh profile), `s7-mobile-fresh` (142, the mobile chain at a verified DPR 3)                                                                                                                                                                                                                                                                              |

## Division of labour

1. REA collected passive evidence: target listing, page inspection (DOM, accessibility, storage
   keys, scripts), navigation lifecycle, viewport screenshots, script export, static bundle
   analysis, and observation windows armed **while the driver drew on the canvas** (s6 and s7).
   Two of those windows used `observe_web_session`, which retains navigation and lifecycle
   metadata only; one used `inspect_web_page`, which also retained same-origin request,
   WebSocket and console metadata. Their bounds and contents are in `evidence/rea-windows.json`.
2. The Playwright driver performed the canvas inputs REA cannot express: pointer drags,
   modifier clicks, wheel, keyboard chords, multi-touch, file drop and native-dialog handling.
   Between batches it read back session-created state and layout metrics.
3. REA and the driver worked on the **same** isolated browser.

## Reproduction

```sh
OUT=/absolute/path/outside/the/repo/s8-desktop   # a new directory per session
research/excalidraw/isolation-check.sh            # optional: proves DevTools isolation
research/excalidraw/browser.sh start pw-research 9222
node research/excalidraw/driver.mjs --cdp http://127.0.0.1:9222 --port 9333 --out "$OUT" &
node research/excalidraw/run.mjs --out "$OUT" 00-initial-load-desktop
node research/excalidraw/run.mjs --out "$OUT" 02-shapes-desktop
node research/excalidraw/timeline-summary.mjs "$OUT/timeline.jsonl"
node research/excalidraw/run.mjs --out "$OUT" --quit   # authenticated POST /quit
research/excalidraw/browser.sh stop pw-research        # also removes the run network
```

- `run.mjs` needs `--out` to read the per-run token. A plain `curl …/quit` is refused (405 for
  GET, 401 without the token).
- The full scenario order is in the
  [research README](../../research/excalidraw/README.md#scenario-order-and-dependencies).
- To rebuild the committed index, run:
  `node research/excalidraw/build-evidence.mjs <root> docs/reverse-engineering/evidence/sessions.json <sessions...>`
  and then `npx prettier --write` on the output. The REA window summary is rebuilt the same way
  with `node research/excalidraw/rea-windows.mjs <root> docs/reverse-engineering/evidence/rea-windows.json <sessions...>`.
- Coordinates assume the stated viewport and default zoom. Drags that create shapes must start
  at x ≥ 260 on desktop, because the properties panel covers x≈16–211 as soon as a drawing tool
  is active
  ([B-02](behavior-analysis.md#b-02-properties-panel-occupies-the-canvas-while-a-tool-is-active)).

## Sanitisation and storage

- **Committed** under `docs/reverse-engineering/evidence/`:
  - screenshot names, SHA-256 digests and pixel sizes, including retired captures (digest only);
  - ARIA snapshot names and line counts;
  - labelled probe summaries (geometry, selection, zoom and style values of shapes we drew);
  - network metadata (method, origin, path, query **key names**, type, status, service-worker
    flag and counts);
  - failed-step counts with sanitised messages;
  - REA Evidence IDs and identifier counts.
- **Kept outside Git** in the workspace `artifacts/research/excalidraw/`: PNG screenshots, ARIA
  YAML, timelines, netlogs, raw REA results and bundles, and exported scripts.
- **What leaked before, and what was done:**
  - s1 redacted room values in its ARIA files by hand, but the earlier claim that "only the
    fragment shape was ever recorded" was **false**.
  - The room id and key were also kept in two REA files, in a session log, in a capture
    transcript and in one of its cached tool results.
  - Three s1 screenshots showed the link and a QR code encoding it.

  The REA files were already removed. The other text copies were overwritten in place with
  placeholders, and the three screenshots were shredded. Details are in
  [checkpoint](checkpoint.md#privacy-remediation). No copy is known to remain: the capture
  transcript and its cached tool results were later securely deleted, and a search for their
  names finds none.

- **Controls from s5 on:**
  - The driver redacts collaboration fragments and secret-shaped values from ARIA text, dialog
    messages and clipboard previews.
  - URL probes return only key names and value lengths.
  - Screenshots of the share dialog paint every dialog input and image before writing, and
    `check-masks.mjs` verifies the painted pixels.
  - A screenshot is refused while a dialog that may show the link is open.
- **Controls added after s7** (remediation of the third review; no live session has run with
  them yet, and they are covered by stub-based unit and integration tests):
  - Any screenshot is refused while the live URL fragment holds a room or `json` link value,
    raw or percent-encoded, checked before and after the capture, unless every requested mask
    produced a visible box (tightened after the review of `cb11dff`, below). A mask with no
    usable box always refuses the capture, and `check-masks.mjs` fails a masked capture without
    boxes.
  - Redaction covers `room%3D` and `json=` forms, the clipboard text is redacted before its
    preview is cut, and non-identifier URL keys are never stored.
  - One batch runs at a time, and the `runLast` collaboration scenarios lock the session.
  - `blob:` navigation is refused, and page-started navigation off the allowlist halts the
    session.
  - Outputs are created with `O_EXCL`; downloads can no longer overwrite.
  - The s6 timeline was rechecked by step name and count only: both masked collaboration
    captures recorded 2 masks and 7 boxes, the in-session capture was refused, and no capture
    followed. The new rules would not have changed which s6 captures were written.
  - No REA call runs during a collaboration window.
  - `secret-scan.mjs` scans trees by shape and prints only counts.
- **Controls added after the review of cb11dff** (untested in a live session; stub-based tests
  only. The self-test loads `about:blank` and a fixture, so it never reaches a room view, and
  neither it nor the isolation check runs the halt, state-file or `rea-extract` checks):
  - In a room view the masks must also cover every on-screen input, textarea, image and canvas
    in a dialog and every element whose text names a room or link key, and a capture whose URL
    gains a value while it runs is refused. Whether this rule would have accepted the two s6
    masked captures is not established: the surfaces it checks were not recorded in s6.
  - Redaction and the secret-shape count match the room and `json` key names and their `=` and
    `,` separators in any mix of literal and percent-encoded characters, and the count also
    reads the ASCII-decoded text.
  - A session halts when the URL holds a room or link value while no `runLast` scenario has
    started, at attach or after a navigation.
  - The driver state file rejects an empty halt reason and is narrowed to mode 0600 on every
    write.
  - `rea-extract.mjs` redacts copied accessible names and REA text and never replaces an
    existing summary; `build-evidence.mjs` redacts failure text again.
- **Controls added after the review of 46b2b01** (stub-based tests only, for the same reason):
  - A `goto` target whose fragment holds a room or `json` link value is refused before any
    navigation. Rooms are opened only through the UI, as scenario 08 does; the watcher still
    handles that path.
  - Every string of a step record, keys included, is redacted before the row reaches the raw
    timeline.
  - In a room view the surfaces that may show the value are measured again after the capture,
    so an element that appears while the capture runs is refused.
  - `browser.sh stop` fails with state UNKNOWN when docker cannot list the resource, instead of
    reporting that nothing was found.

## Validation of the evidence

- Every screenshot's PNG header was checked. From s6 on, layout metrics are asserted before the
  first input of every main scenario (see Environment).
- Committed JSON is produced by scripts and formatted by Prettier, so `npm run format:check`
  parses it. All five probe summaries (s1, s2, s3, s6 and s7) regenerate unchanged with the current tools, and
  `evidence/rea-windows.json` regenerates byte for byte from the retained REA records and
  timelines.
- `research/excalidraw/tests/unit/documentation.test.mjs` checks the documents against the
  committed evidence: the eleven fields of every behaviour entry, a residual row for every scope
  and inventory ID, and the cited cross-session counts, save timings, REA windows, arrow, paste,
  image and zoom geometry, and service-worker counts.
- `bundle-01-desktop.json` passes `rea evidence-export` (3 records, 0 unknowns). The other REA
  bundle no longer exists, and the s5–s7 CLI records are single Evidence records (see
  [REA findings](rea-findings.md#evidence-ids)).
- Every s6 and s7 timeline row matches a step of a committed scenario.
- All owned containers, networks, drivers, ports and token files were stopped, removed and
  checked after each session.
