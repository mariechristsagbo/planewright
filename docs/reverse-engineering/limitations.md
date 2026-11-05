# Limitations

## Out of scope by policy

- Anything that needs an account: Excalidraw+, sign-up, persistent cloud scenes.
- The generation features (Text to diagram, Mermaid to Excalidraw, Wireframe to code). They may
  call external services and were not opened. Issue #1 does not exclude them explicitly, so this
  exclusion is **pending a maintainer decision**.
- "Export to Link". It uploads the scene and creates a shareable link with a key, so it was
  inventoried but not clicked.
- The reference source repository, its packages, source maps, and copied assets or text.
- Server internals: everything about the collaboration relay, Firebase rules and analytics
  processing is hypothesis (see [network analysis](network-analysis.md#4-backend-hypotheses-not-verified)).
- Payload contents (WebSocket frames, Sentry envelopes, analytics beacons). They were
  deliberately not captured.

## Environment limits

1. **Headless Chromium only.** Native File System Access pickers show nothing in headless mode,
   so Open, Save to…, Ctrl+S, PNG/SVG export and Insert image could not be completed. No other
   browser engine was tested.
2. **Container `--no-sandbox`.** Chromium's sandbox is disabled inside the container, which is the
   isolation boundary instead. Rendering could differ slightly from a sandboxed desktop browser.
3. **Emulated mobile.** Device metrics, touch and user agent were emulated on desktop Chromium.
   There was no real device, no iOS Safari, no virtual keyboard and no hardware pen.
4. **DPR history (s1–s4).**
   - In s3 and s4, `window.devicePixelRatio` read 1 instead of 3 after the first screenshot. The
     earlier documents blamed re-applying the emulation; that was wrong.
   - On a self-authored fixture, Playwright's `page.screenshot()` over CDP reset DPR to 1 and the
     emulated screen to the headless default 800×600, and re-emulation did not undo it. A
     navigation restored the override.
   - In s7, with CDP captures only, re-emulating the loaded reference page read back DPR 3
     (scenario 11).
   - So every s3 capture and probe after `m01` (the last step of 09) ran at DPR 1. On desktop,
     only `screen.width/height` was affected (DPR 1 is the default). Those values were not
     recorded before s5.
   - All mobile claims now cite s7, where DPR 3 held at every assertion. s7 asserted the metrics at 5 points: after 09's load, and at the start and end of 10 and of 14. 10b's single capture falls between the end of 10 and the start of 14, and 11's emulate step asserts its own read-back. s11 asserted at the same 5 points, and DPR 3 held at each.
5. **One locale (en-US) and the light/dark themes.** Only the language list was inventoried;
   right-to-left layouts were not observed.
6. **Fixed coordinates.** Scenario coordinates depend on viewport and zoom. A layout change in the
   reference breaks replay (B-21 shows how a reflow redirected clicks).
7. **Single collaboration client.** Only one guest client was used per room, so multi-user
   behaviour is unverified.

## Tooling limits

- REA is passive for coordinate input (see [REA findings](rea-findings.md#5-rea-limitations-met)).
- **What the REA windows can show.** `observe_web_session` retains navigation and lifecycle
  metadata only, so the windows during scenarios 02 and 10 say nothing about requests, WebSocket
  traffic or console output. The `inspect_web_page` windows cover only the allowed origin and
  start at attach: the s6 window during scenario 13 lasted 25 s, and the four R-76 windows
  (scenarios 12, 13, 15 and 14 in s8–s11) lasted 40–45 s and were armed before their scenario's
  first step. The s7 window armed 81 ms
  after scenario 10's first tap. The bounds and counts are in `evidence/rea-windows.json`.
- **Committed probe fields.** The committed probe summaries keep geometry, bindings, groups,
  locks, eight style values, selection count, tool, zoom, scroll and theme. Point counts, font
  fields, text length, the stored key count of `excalidraw-state` and which elements are
  selected were read from raw timelines or not recorded, and cannot be re-checked from Git.
- **Facts read only from raw records outside Git.** These are cited with that caveat and cannot
  be re-checked from the committed evidence:
  - the zen, grid, snap and view-mode keys of the saved app state (B-37);
  - the load lifecycle offsets of `ev_58bb47ed` (`rea-windows.json` keeps the event names only);
  - the start time of scenario 13's Delete keypress (16:11:07.053, from the s6 timeline);
  - the s6 storage names of `ev_13a4756f`, including `workbox-expiration` and the `fonts` cache
    (B-31); the cache counts, 2 in s6 and 3 at the later s1 inspection, are in
    `evidence/rea-windows.json`;
  - the first two of the three `02-tool-probe` reads in scenario 02 (B-01): the committed entry
    keeps the first read's time and the last read's values, and `timeline-summary.mjs` now warns
    when a label is read more than once by the same probe;
  - the clipboard shape after Ctrl+C in scenario 06: top-level keys `type`, `elements` and
    `files`, type `excalidraw/clipboard`, element types rectangle, text and arrow, the same in s1
    and s6 (B-26, B-13). The committed index counts the `clipboard` step only;
  - the storage usage at the s1 initial inspection, about 2.5 MB of a 644 MB quota (network
    analysis); the committed summary keeps the store names only;
  - the REA PNG digests behind the three byte-identical pairs in
    [REA findings](rea-findings.md#2-cross-driver-screenshot-comparison): only the driver digests
    are in `evidence/sessions.json`, and the index keeps the REA Evidence IDs;
  - the 84–91 KB sizes of the large REA results (REA findings, limitation 4);
  - the driver netlog requests set against scenarios 12, 13, 15 and 14 in s8–s11 (network
    analysis): `evidence/sessions.json` keeps request counts per session, not their times;
  - the s1 and s6 ARIA snapshot comparison behind the medium rating of the secondary surfaces
    (feature inventory §2); the committed index keeps line counts only;
  - the s6 and s10 (scenario 15) and s7 and s11 (scenarios 09, 10 and 14) ARIA snapshot
    comparisons behind the R-76 ratings of B-03, B-21, B-34, B-35 and feature inventory §2 and
    §6. The committed index keeps line counts, and digests for the byte-identical captures.
- **REA MCP denied.** The REA MCP tools needed a permission grant that the non-interactive session
  of s5–s7 could not give. Those sessions used the REA CLI of the same build, which cannot export
  a validated Evidence bundle.
- The driver's state probes read localStorage, which lags live state by a few hundred
  milliseconds (B-30). Most probes run 700–800 ms after their action, but not all. In scenario 02
  two of the three `02-tool-probe` reads run straight after a key press and a drag (B-01), and
  02b, 04b, 14 and 15 have probes after shorter waits (300–600 ms) or none; scenario 13 reads at
  fixed short delays on purpose.
- **Page-started navigation is detected, not blocked.** The driver does not intercept requests,
  because interception changes caching and service-worker behaviour. A navigation the page starts
  itself (link, redirect, script, popup) has already been requested when the navigation watcher
  halts the session. A failed navigation that leaves Chromium on its error page halts it too.
- **Masks are measured just before the capture.** Content that moves between the box
  measurement and `Page.captureScreenshot` can leave the painted boxes. `check-masks.mjs` verifies
  the recorded boxes only, not where the content went. In a room view the driver now also
  requires every dialog input, textarea, image and canvas on screen, and every element whose text
  names a room or link key, to lie inside one mask box, both before and after the capture, so an
  element that appears while the capture runs is refused too. Content that appears and is gone
  again within the capture, an SVG code, a value split across elements or a shadow root would not
  be detected. This rule was added after s7 and is tested only with stubs: no live room view has
  been captured with it.
- **Live tooling checks.** With the fourth-review tooling fixes, `isolation-check.sh` (11 of 11)
  and `selftest.sh` (19 of 19) passed against real local containers on 2026-11-04, at 20:02 and
  20:03 UTC and again on `75f8eae` at 20:22 and 20:23 UTC. With the fifth-review fixes they
  passed again on `dc6eef1`, at 22:18 and 22:19 UTC, without retained output. With the
  sixth-review fixes they passed on `e38955a` on 2026-11-05 at 00:15–00:16 UTC; that output is in
  [local-checks/](local-checks/). Before the R-76 sessions they passed on `0b4fb19` at
  04:45–04:46 UTC, with that output beside it. Each run loaded only `about:blank` and the
  self-authored fixture. The self-test cannot reach a room view, so the room-view capture and
  halt rules are tested with stubs only. The R-76 sessions s8–s11 ran the driver at `0b4fb19`,
  but none of them opened a room view, so those rules were not triggered live.
- **Re-attaching the driver drops emulation.** Restarting the driver replaces its CDP session,
  which removes that session's emulation override (seen in s6). Scenario `00c` restores it. The
  `runLast` lock and any halt reason now survive a restart (`$OUT/driver-state.json`). Neither
  the lock nor the halt watcher existed when s6 and s7 ran; both were added afterwards.
- **Native dialogs.** Native-dialog handling through Playwright over CDP was unreliable in the s1
  collaboration stop flow; the page stopped answering `Runtime.evaluate`. The cause is unknown and
  it is recorded as unverified, not as reference behaviour.
- `analyze_web_bundle` did not finish the main chunk within the default deadline.
- **Failed steps in s1–s4.** They were not written to the timeline, so `failed: 0` for s1–s4 in
  `evidence/sessions.json` means "not recorded", not "none". The earlier documents report failed
  s1 steps (download and file-chooser waits in 06, early stop-session clicks, one ambiguous ARIA
  selector); neither the committed index nor the retained s1 timeline holds them, so they cannot
  be re-checked. From s5 on, every failure is recorded with a sanitised message.
- One s1 scenario client was killed with exit 137 mid-run. Results come from the driver's
  timeline, which is written per step (see [checkpoint](checkpoint.md#interrupted-and-aborted-runs)).

## Claims this baseline does **not** make

- That the feature inventory is exhaustive. It covers what was discovered through the menus,
  palette, help, panels and context menus of an empty or simple scene.
- That bundle identifiers execute.
- That drawing causes, or does not cause, network, WebSocket or console activity. Only
  same-origin REA windows covered drawing: scenario 13 in s6 and s9, 12 in s8 and 15 in s10.
- That Ctrl+wheel zoom is anchored at the pointer, that a bound arrow end snaps to the outline,
  or that the local save delay is measured from pointer-up. See B-36, B-04 and B-30.
- That every behaviour entry covers all issue #1 dimensions. Entries mark each dimension that was
  not observed.
- That the theme, zen, grid or snap state survives a reload, or that a mobile reload keeps the
  scene. No session reloaded while dark or with a mode on, and scenario `09b` never ran (R-19,
  R-54).
- That observed numeric thresholds (save delay, binding gap, handle offsets) are stable across
  versions. Several `index-*.js` chunks with different hashes were loaded across sessions. The
  REA initial-page inspections list the same 9 scripts in s1 and in s8–s11 except the main
  `index-*.js` chunk, whose name changed between s1 (2026-11-04) and s8–s11 (2026-11-05)
  [O]; so s8–s11 ran a later build [I]. Whether the other hash differences within a day
  reflect lazy chunks or a deploy is unknown.

All open questions are tracked in the [residual matrix](residual-matrix.md).
