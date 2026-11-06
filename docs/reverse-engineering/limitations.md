# Limitations

## Out of scope by policy

- Anything that needs an account: Excalidraw+, sign-up, persistent cloud scenes.
- Nothing guest-accessible: on 2026-11-05 the maintainer placed every guest-accessible feature in
  scope, the generation features and "Export to Link" included. "Export to Link" uploads the
  scene and creates a link with a key, so its scenarios (20 on desktop, 44 on mobile) treat the
  link as a secret. 44 ran once, in s52, and no record keeps the link's value; 20 has not run,
  because of environment limit 8.
- Verification pages: a page that checks whether a human or an ordinary browser is present is
  never bypassed (no user-agent change, retry or waiting it out).
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
   There was no real device, no iOS Safari, no virtual keyboard and no hardware pen. The tablet and
   wide viewports of 52 and 57 (s59, s62) kept DPR 3, touch, the mobile flag and the phone user
   agent, so they show the layout this client gets at those sizes, not a tablet or a desktop
   client.
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
5. **One locale (en-US) and the light/dark themes.** Only the language list was inventoried, and
   one other language, French, was picked (s61, s64, s70); right-to-left layouts were not observed.
6. **Fixed coordinates.** Scenario coordinates depend on viewport and zoom. A layout change in the
   reference breaks replay (B-21 shows how a reflow redirected clicks).
7. **Single collaboration client.** Only one guest client was used per room, so multi-user
   behaviour is unverified.
8. **Verification page for the headless desktop client.** From s13 (2026-11-05, 16:53 UTC) the
   reference answered the desktop load with HTTP 403 and a hosting-provider verification page
   (requests under `/.well-known/vercel/security/`) instead of the app; s12, two minutes earlier
   with the mobile user agent, loaded the app. Export to Link, the desktop generation features,
   the isolated exports of R-64 and the desktop all-origin window of R-66 wait for a session that
   loads the page without it. What the page depends on is unverified [U]. The mobile sessions s15
   and s16 (17:56 and 17:59 UTC) loaded the app too; the desktop was not tried again. The mobile
   client met it too in s50 (23:26 UTC), after 13 mobile sessions in s37–s49 had loaded the app:
   the document came with HTTP 403 and the challenge requests, after which the page navigated to
   `/` itself and got the app with HTTP 200 [O, raw netlog]. The load gate stopped s50 before any
   REA call or input, so its Export to Link upload never ran, and no later session ran that day.
   On 2026-11-06 one bounded load check in a fresh profile (s51, 00:39 UTC) loaded the app with
   HTTP 200 and no verification-page request, and so did the six mobile sessions after it
   (s52–s57, 00:40–01:24 UTC); the desktop was not tried. A second load check (s58, 02:34 UTC)
   and s59–s64 (to 03:24 UTC) loaded the app normally too, but in s64 the fr-FR locale chunk got
   HTTP 403 (seen by REA; the driver's netlog has `net::ERR_ABORTED`), where s61 had got it through
   the service worker. The gates checked documents and verification paths only, so s64 ran to its
   end; the 403 is read as the same protection [H], live contact stopped, and s65 never ran. It
   was not the first asset 403: read again for 403 responses on 2026-11-06, the retained records
   show that s16's REA window kept HTTP 403 for the two script chunks of Mermaid to Excalidraw,
   which the netlog wrote as aborted (as in s12, where no window was open), and that at s49's load
   the manifest got HTTP 403 twice, three minutes before s50's verification page. Those gates passed
   both. About two hours after s64, s65–s67 (05:21–05:33 UTC) loaded the app normally under a gate
   that stops on a 403 of any request type, and met none, nor did s68–s70 (06:21–06:33 UTC), where
   54 got its locale chunk with HTTP 200, or s71–s73 (07:30–07:47 UTC); whether the protection depends on rate, time or the
   requests asked for is not known [H].
9. **REA origin lists and request times.** REA accepts only exact HTTP(S) origins, so a window
   cannot list the collaboration WebSocket origin, and it keeps no time per retained request, so
   a window bounds a scenario, not a step; per-step timing comes from the driver netlog.
10. **Screen orientation of the earlier mobile sessions.** Until s15 the mobile emulation named no
    screen orientation. On the self-authored fixture, the emulate calls that s7, s11 and s12 used
    (unchanged since `77ad658`) read a `landscape-primary` screen at angle 0 for the 390×844
    portrait screen [O, local fixture], so those sessions most likely reported that orientation to
    the reference [I]; s3 and s4 used earlier calls and are not known. From s15 on, 09 asks for
    portrait-primary at angle 0 and every mobile assertion checks it. s16 repeated s12's 10 and 22
    that way, and their 13 shared ARIA snapshots are identical byte for byte, so no effect of the
    change was seen there.
11. **Emulated touch.** The driver's touch input goes through CDP `Input.dispatchTouchEvent` with
    the default 1 px contact radius, so the hit-testing ladder of R-34 is for a point contact, not a
    finger's area. In the pinches of s18 and s20 the zoom followed the finger-distance ratio
    exactly, but the fixed point along the pinch axis lay 34.5–111.5 px from the midpoint and
    differed between the sessions; that this comes from the order in which the fingers' moves reach
    the page, one finger after the other in each move, is a hypothesis [H]. No real device was used.
12. **Named controls are clicked, not tapped.** The driver's `role` step clicks a button with
    Playwright's mouse-event click at its centre, so in s17–s36 the popover buttons, the Undo and
    Redo buttons and the tool choices received mouse events while every canvas input was touch.
    That a finger's tap on these DOM buttons acts the same is [I]. The style popover's radios have
    no accessible name, so scenario 32 touched them at the button centres measured on s22's
    capture; that layout held in s26 and s31, where every touch changed the intended value. In
    s37–s49 the same holds for the popover buttons, Diamond, Ellipse, Edit arrow and the dialogs'
    Insert buttons; scenario 39 touched the unnamed Arrow type radios at the centres measured on
    s34's capture, and each touch stored a different arrow type in s40 and s44.
13. **The keyboard stands in for the phone's.** The word typed into new texts (s37, s41, s45–s47),
    the hex code with Ctrl+A and Enter (s41, s45) and the generation prompt with Enter (s49) were
    sent as CDP key events to the focused field. No virtual keyboard was shown or used, so its
    layout, autocorrection and the view's reaction to it were not observed. The Tab, Shift+Tab,
    Enter, Space and Escape presses of 49 and 56 (s59, s62) are CDP key events too: they show how
    the page handles an external keyboard's keys, and no screen reader or assistive technology
    took part, so what one would announce was not observed.
14. **Offline emulation.** The `offline` step sets Chromium's network conditions for the page and
    the service workers Playwright attached (s60, s63), and from s68 for the page on the driver's
    own session too. Set by Playwright alone, they held for requests across a reload, which still
    failed as offline, but navigator.onLine read true after a reload, so the reloaded app was never
    shown an offline state. Set on the driver's session too, navigator.onLine stayed false across
    the reload (s68, s69), but in a local test a DevTools session that detached from the page
    turned it true again, so no REA call may end while a page should read offline. A real lost
    connection, a flaky one and a longer offline period were not tried.
15. **Emulated colour scheme and wheel.** In 64 the System theme was read under a
    `prefers-color-scheme` emulated through CDP, which also asks for reduced motion, and the wheel
    turns are the driver's mouse wheel on a page with touch emulation; a phone's own dark-mode
    switch and a mouse or trackpad on a real device were not tried.

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
  selected were read from raw timelines or not recorded, and cannot be re-checked from Git. From
  s22 on the summaries are built with `--points` and keep each line's and arrow's point count; the
  points themselves and the angle beyond one decimal (the scene probe rounds it) are not kept.
  From s38 on the scene probe also reads an arrow's elbowed flag, and the summaries keep it.
  From s71 on the summaries are built with `--modes` and keep the stored mode flags (grid, zen,
  view, snap, arrow binding, midpoint snapping, selection mode and input device) and the tool lock.
- **Facts read only from raw records outside Git.** These are cited with that caveat and cannot
  be re-checked from the committed evidence:
  - the zen, grid, snap and view-mode keys of the saved app state in s1 and s6 (B-37); from s71
    the summaries keep them;
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
  - the step before a wait or probe in which a netlog entry was written, such as the two taps
    before `m06-more-tools` in s11 (network analysis): `evidence/netlog-steps.json` names the step
    in effect and the entry's offset from it, not the steps before it, and the inputs before the
    24-key beacons;
  - the s1 and s6 ARIA snapshot comparison behind the medium rating of the secondary surfaces
    (feature inventory §2); the committed index keeps line counts only;
  - the s6 and s10 (scenario 15) and s7 and s11 (scenarios 09, 10 and 14) ARIA snapshot
    comparisons behind the R-76 ratings of B-03, B-21, B-34, B-35 and feature inventory §2 and
    §6. The committed index keeps line counts, and digests for the byte-identical captures;
  - the s12 and s16 ARIA snapshot comparison behind the high ratings of B-38 and B-39, the s15
    export dialog read the same before and after the Export to SVG click (R-64), and the Undo
    button's state and the view before and after s16's reload (B-30): the committed index keeps ARIA
    line counts and capture digests only;
  - the selected element's id on both sides of the s17, s19 and s21 reloads, the Undo button's state
    and the selection's handles in their captures (B-30), and the Background popover's ARIA (R-11):
    the committed probes keep a selection count, and the index ARIA line counts and capture digests;
  - the names and groups of the mobile popovers and tool choices in s22–s36 (feature inventory §6,
    B-21, B-40), the open Actions popover after Bring forward (B-24), the line's handles after a
    double tap (B-40) and the arrows in s23's and s28's captures (B-04): the committed index keeps
    ARIA line counts and capture digests;
  - in s37–s50, the names and groups of the popovers, tool choices and dialogs (feature inventory
    §6; B-01, B-05, B-21, B-39, B-40), the Save to... dialog (R-56), the Text to diagram chat, its
    result and its count of requests left (B-39), that Insert closed the Mermaid and Text to diagram
    dialogs (B-38, B-39), the byte-identical ARIA of the replay pairs, the font family of the texts
    and the default stroke colour (B-06, B-20), and the 2.8 s between the generation request and
    its failure event (network analysis): the committed index keeps ARIA line counts, capture
    digests and request metadata without times.
  - in s58–s64, the ARIA names behind the layout, menu, Find, library and Help facts (the hint
    texts, the shortcut letters, the trial banner, 1 / 2 results, the library tiles; B-43, B-45 to
    B-48), the absence of an offline indicator in the captures (B-44), the app root's class names
    and the live region texts, which the summaries leave out, the HTTP 403 of the s64 locale chunk,
    which only REA's raw record keeps, the byte-identical ARIA of the replay pairs, and the request
    start times against the scenario steps (B-44, B-47): the committed files keep the probe rows,
    ARIA line counts, capture digests and request metadata.
  - found on 2026-11-06, the HTTP 403 of the two script chunks in s16, which only REA's raw record
    keeps: the committed index has them as failed requests (network analysis).
  - in s65–s67, the byte-identical ARIA of the replay pairs, and that the 6 snapshots that differ do
    so only in a query value of the off-site Browse libraries link, which changes per session and
    is kept in no committed file.
  - in s68–s70, the byte-identical ARIA of the replay pairs and against s63 and s61, the 3 snapshots
    that differ only in that query value, the Undo button disabled after 60's first Undo, the one
    library item in each sidebar snapshot, and the local test reads of `navigator.onLine`.
  - in s71–s73, the byte-identical ARIA of the replay pairs, the menu left open after a Preferences
    choice, the controls that zen and view mode leave, and the Preferences items that show a check
    mark but expose no checked state.
- **REA MCP denied.** The REA MCP tools needed a permission grant that the non-interactive session
  of s5–s7 could not give. Those sessions used the REA CLI of the same build, which cannot export
  a validated Evidence bundle.
- The driver's state probes read localStorage, which lags live state by a few hundred
  milliseconds (B-30). Most probes run 700–800 ms after their action, but not all. In scenario 02
  two of the three `02-tool-probe` reads run straight after a key press and a drag (B-01), and
  02b, 04b, 14 and 15 have probes after shorter waits (300–600 ms) or none; scenario 13 reads at
  fixed short delays on purpose.
- **A streamed response reads as aborted.** The netlog wrote s49's one generation request as
  failed (`net::ERR_ABORTED`) 2.8 s after it started, while the dialog went on to show the result,
  so it keeps no status for that request. That the driver's request events report a completed
  streamed response as aborted is a hypothesis [H].
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
  same-origin REA windows (scenario 13 in s6 and s9, 12 in s8 and 15 in s10) and the netlogs of
  the sessions that drew, all but s4 and s5, covered drawing. No netlog entry was written during
  any drawing step, but the netlog writes a request only once it has finished or failed, keeps
  no console output and counts WebSocket frames only when a socket closes, and no drawing ran in
  a collaboration room (R-66).
- That Ctrl+wheel zoom is anchored at the pointer, that a bound arrow end snaps to the outline,
  or that the local save delay is measured from pointer-up. See B-36, B-04 and B-30.
- That every behaviour entry covers all issue #1 dimensions. Entries mark each dimension that was
  not observed.
- That the zen, grid or snap state survives a reload, or the theme a desktop reload. No session
  reloaded with a mode on, and no desktop session while dark (R-19); on mobile the reloads of 24
  and 09b kept the stored scene, and s16's the dark theme (B-30, R-54).
- That observed numeric thresholds (save delay, binding gap, handle offsets) are stable across
  versions. Several `index-*.js` chunks with different hashes were loaded across sessions. The
  one `index-*.js` script that every s1–s7 netlog requests is requested in no s8–s11 netlog,
  and every s8–s11 netlog requests another one (`evidence/sessions.json`); the REA
  initial-page inspections list the same 9 scripts in s1 and in s8–s11 except the main
  `index-*.js` chunk, whose name changed between s1 (2026-11-04) and s8–s11 (2026-11-05)
  [O]. So s8–s11 ran a later build [I]. Whether the other hash differences within a day
  reflect lazy chunks or a deploy is unknown.

All open questions are tracked in the [residual matrix](residual-matrix.md).
