# Methodology: clean-room guest-mode behavioural research

Issue: #1. Reference: the public `https://excalidraw.com/` application, used as an
unauthenticated guest. Planewright is not affiliated with Excalidraw or REA; see
[ADR 0003](../adr/0003-clean-room-reference-policy.md).

## Clean-room rules applied

| Rule                                                   | How it was applied                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No reference source repository, package or source maps | Nothing was cloned or installed. `analyze_web_bundle`, the only REA operation that can fetch source maps, ran with `fetch_source_maps: false`. The driver netlogs of all eleven sessions contain 0 `.map` requests.                                                                                                                                                                                                                               |
| Shipped bundles are observable artefacts only          | REA captured the scripts the browser received and exported them to a directory **outside** the repository. The only derived output is `evidence/static-api-surface.json`: occurrence counts of standard web-platform identifiers, with no code excerpts.                                                                                                                                                                                          |
| No copied code, components, assets or text             | Docs describe behaviour in our own words. Control names are quoted only where they are needed to identify the control. Screenshots, ARIA snapshot text and bundles are not committed.                                                                                                                                                                                                                                                             |
| Guest only; no protection bypass                       | No login, sign-up or Excalidraw+ was used, and no verification page or other protection response was bypassed (see [Verification pages and protection responses](#verification-pages-and-protection-responses)). Two live-collaboration sessions were started, one in s1 and one in s6. On mobile, Mermaid's example was inserted in s12 and s16, one generation ran in s49 and Export to Link uploaded one scene in s52; neither ran on desktop. |
| Human-scale request volume                             | 11 short sessions. The reference page was loaded or navigated 21 times in total (s1: 3, s2–s5: 1 each, s6: 9 including the reloads that restore emulation, s7: 1, s8–s11: 1 each), counted from the `goto` and `reload` steps in `evidence/sessions.json`. Two collaboration rooms were created, both before s7. Everything else (isolation check, self-test, emulation probes) ran on `about:blank` or a self-authored fixture.                  |

## Verification pages and protection responses

A verification page, which checks whether a person or an ordinary browser is present, and any
HTTP 403 or 429 from the reference are read as the hosting provider's protection. The rule as the
sessions applied it:

- **Stop at once.** On detection the session stops: no reload or second load inside it, no change
  of user agent or of any other client setting, no waiting for the page to pass, and no input.
  The batch then stops all live contact. From s15 a load gate stopped a session at its load on a
  403 document or a request under `/.well-known/vercel/`; from s65 a stricter gate, with a watcher
  reading the netlog every 0.5 s, stops on a 403 or 429 of any request type, on an aborted request
  to the reference and on a REA window that is not ok or holds such a response.
- **Later, one bounded check.** Only after a pause of an hour or more may a new session run, in a
  fresh profile with the client configuration unchanged, its first step one load under the same
  or a stricter gate, which stops it there if the protection appears again. The desktop and mobile
  clients are the two configurations planned from s1 and s3; neither was changed, or added, to get
  past a page.

What happened each time:

- **s13 and s14 (desktop, 2026-11-05).** s13's load got HTTP 403 and the verification page at
  16:53 UTC. No gate checked the document yet: the metrics assertion stopped 12 and 23 at their
  first step, so no input reached the site, and s13 ran on to 16. s14, the next desktop session
  the batch had planned, loaded the page 37 s after s13's last step, met the same page, and only
  then did the batch stop. Under the rule above, which these sessions led to, s14 would not have
  run.
- **s50 and s51 (mobile).** s50's load got HTTP 403 and the challenge at 23:26 UTC, after which
  the page loaded the app by itself; the load gate stopped s50 at once, before any REA call or
  input. After 73 min, s51 (2026-11-06, 00:39 UTC) was one load check in a fresh profile with
  nothing else, and it loaded the app normally.
- **s64 and s65 (mobile, 2026-11-06).** In s64 a locale script got HTTP 403, which the gates of
  then, checking documents and verification paths only, passed, so s64 ran to its end; seen in
  its REA record, the 403 stopped live contact. After 1 h 58 min, s65 ran under the stricter gate,
  which would have stopped it at its load, and met no 403, nor did any session up to s84.
- **Found later.** Asset 403s in s16 and s49, and in s12 aborted requests for the same two chunks
  as in s16, with no REA window to show their status, passed the gates of their time and were
  found only when the retained records were read again on 2026-11-06
  ([limitations](limitations.md)); the sessions after them had run on.
- **The desktop after s14.** No desktop load ran again. On 2026-11-06, at delivery, a decision
  taken autonomously within the maintainer's scope settled that no further desktop load check runs
  in this phase, so the desktop gaps stay open as an objective limitation, not done
  ([readiness](readiness.md)).

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

Placing a netlog entry in a scenario sets the time the driver wrote it against the step start
times of the timeline, so it is labelled [I, raw netlog and timeline times]: each time is observed
and the placement is deduced from both. `evidence/netlog-steps.json` keeps each entry's offset from
the step in effect, built by `netlog-steps.mjs` from the raw records. Both times come from the
driver process's clock. The netlog writes a request once it has finished or failed, so a placement
bounds when the request started but never gives that time, and the timeline records when each
step started, not when it ended.

Confidence follows one rule:

- **high**: observed with identical results in at least two sessions, at least one of them from
  a fresh profile. Two tools reading the same session (for example REA and the driver) count as
  one session;
- **medium**: observed in one session only, or in sessions whose results differ;
- **low**: indirect.

Identical means identical as recorded. Results that match only once a setup difference is
allowed for (another scroll, other styles) differ, as B-06 and B-34 show; what matches may be
stated, but the rating stays medium.

## Environment

| Item      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date      | 2026-11-04: s1–s4 13:29–14:25 UTC, s5–s7 16:00–16:18 UTC; 2026-11-05: s8–s11 04:48–04:55 UTC (R-76)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Browser   | Chrome 156.0.8078.80, headless, from `mcr.microsoft.com/playwright:v1.64.1-noble`, pinned by digest `sha256:2f05f8a7…` from s5 on                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Isolation | One disposable container per session: non-root user, all capabilities dropped, `no-new-privileges`, profile in tmpfs, no host mounts. Chromium's own sandbox cannot run under the container's seccomp profile, so the container is the boundary.                                                                                                                                                                                                                                                                                                                           |
| Network   | s1–s4 used the default Docker bridge. There the DevTools forwarder was reachable from other containers (verified afterwards: a default-bridge probe got `REACHABLE`). From s5 on, each run has its own bridge network with inter-container traffic disabled, and the forwarder accepts only the network gateway, the host side of the published port. `isolation-check.sh` verifies this                                                                                                                                                                                   |
| Ports     | DevTools published only on the host's `127.0.0.1:9222`; driver on `127.0.0.1:9333`, guarded by a per-run token, Host, Origin, method, content-type and body-size checks                                                                                                                                                                                                                                                                                                                                                                                                    |
| REA       | 6.8.0 at build `5b953e13c4451df3afcaab7724c06db5eedf58f7`: the project-local MCP server for s1–s3, the CLI of the same build for s5–s11 (the MCP tools were denied permission in s5–s7; s8–s11 kept the CLI, whose output goes straight to the workspace artifact tree, while granting the MCP tools is a maintainer decision, R-73)                                                                                                                                                                                                                                       |
| Driver    | Playwright-core 1.64.1 over CDP (`research/excalidraw/driver.mjs`). From s6 on, screenshots use CDP `Page.captureScreenshot` on the driver's own session                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Viewports | Desktop 1280×720 at DPR 1, with a 1280×720 screen. Mobile 390×844 CSS px at DPR 3, with a 390×844 screen, 5 touch points, a coarse pointer and an Android Chrome user agent. Emulation is applied once, before the first navigation. Every main scenario asserts the CSS viewport, DPR, screen, touch points and canvas backing store (CSS size × DPR) before its first input and aborts on any mismatch (02 right after its own load, 00b, 00c and 09b after their reload); the short follow-on scenarios (02b, 02c, 03b, 04b, 07b, 08b, 10b) rely on the one before them |
| Sessions  | `s1-desktop` (472 steps), `s2-desktop-fresh` (179), `s3-mobile` (71), `s4-dpr-probe` (14), `s5-desktop-aborted` (10, stopped by the metrics assertion), `s6-desktop-fresh` (616, the whole desktop chain in one fresh profile), `s7-mobile-fresh` (142, the mobile chain at a verified DPR 3), and the R-76 second fresh-profile runs `s8-desktop-r76-12` (39), `s9-desktop-r76-13` (67), `s10-desktop-r76-15` (68) and `s11-mobile-r76-14` (137), each in its own new container and profile                                                                               |

The later sessions ran on 2026-11-05: the observation batch s12–s14 at 16:50–16:56 UTC and the
mobile follow-up s15 and s16 at 17:56–18:02 UTC, each loading the page once (s16 also reloaded it
once, from the service worker). They are indexed in their own evidence files
(`evidence/sessions-s12-s14.json`, `evidence/sessions-s15-s16.json`). From s15 on, the mobile
emulation also asks for a portrait-primary screen at angle 0 and every mobile metrics assertion
checks it; before, headless Chromium kept the landscape-primary orientation of its default screen
([limitations](limitations.md#environment-limits)). The mobile priority-1 batch s17–s21 ran at
19:55–20:11 UTC, each session loading the page once (s17, s19 and s21 also reloaded it once, from
the service worker); it is indexed in `evidence/sessions-s17-s21.json`. The mobile touch-control
batch s22–s36 ran at 21:25–21:58 UTC, each session loading the page once with no reload; it is
indexed in `evidence/sessions-s22-s36.json`, and its probe summaries keep point counts
(`timeline-summary.mjs --points`). The mobile control batch s37–s50 ran at 22:51–23:26 UTC, each
session loading the page once with no reload; in s50 the document came with HTTP 403 and the
verification page, after which the page navigated itself and got the app, and the load gate stopped
the session. It is indexed in `evidence/sessions-s37-s50.json`, and its probe summaries also keep an
arrow's elbowed flag. The mobile radio and edit batch s51–s57 ran on 2026-11-06 at 00:39–01:24 UTC,
each session loading the page once with no reload, s51 as a load check only. It is indexed in
`evidence/sessions-s51-s57.json`, and its probe summaries also keep a text's font fields
(`--text`), a link's origin and path and a freehand stroke's pressure fields.
The keyboard, offline and layout batch s58–s64 ran on 2026-11-06 at 02:34–03:24 UTC, s58 as a load
check only; s60 and s63 reloaded once offline and once online. It is indexed in
`evidence/sessions-s58-s64.json`, and its probe summaries also keep the focused element and live
region lengths (`focus`), the connection and service worker state (`connectivity`), the language and
named button boxes (`layout`) and the canvas background. Resizes (52, 57) are emulate steps on the
loaded page with the same metric assertions as a load, and the offline state is the `offline`
step's, read back from `navigator.onLine`. After s64, a 403 on any request, not only on a document,
is read as the provider's protection and stops live contact. s64's locale chunk was not the first:
read again for 403 responses on 2026-11-06, the retained records show that s16's REA window kept
HTTP 403 for two script chunks, which the netlog wrote as aborted, and that at s49's load the
manifest got HTTP 403 twice, three minutes before s50's verification page. The gates of those
sessions checked documents and verification paths only, so neither stopped a session.
The replay batch s65–s67 ran on 2026-11-06 at 05:21–05:33 UTC, one load per session and no reload,
and is indexed in `evidence/sessions-s65-s67.json`. From s65 the gate stops live contact on a 403
or 429 of any request type, on a verification path, on an aborted request to the reference origin
and on a REA window that is not ok or holds such a response; a watcher reads the netlog every
0.5 s and stops the browser at once, and the netlog and the REA window are read again after every
scenario. The library undo, offline and language batch s68–s70 ran on 2026-11-06 at 06:21–06:33 UTC
under the same gate and is indexed in `evidence/sessions-s68-s70.json`. From `56b88ff` the
`offline` step also sends its network conditions to the page on the driver's own session, so a
value that Playwright already holds is applied again, and in s68 and s69 the offline state then
held across a reload; one REA window spans 61 and 51, because a DevTools session that detached
from the page turned `navigator.onLine` true again in a local test. The preferences, modes and
eraser batch s71–s73 ran on 2026-11-06 at 07:30–07:47 UTC under the same gate and is indexed in
`evidence/sessions-s71-s73.json`. Its probe summaries are the first built with `--modes`, which
keeps the stored mode flags and the tool lock, and its `role` steps open the Preferences submenu
with `unlessExpanded`, so a reopened menu never collapses it. The context-menu, tools and snap
batch s74–s78 ran on 2026-11-06 at 09:16–09:57 UTC under the same gate and is indexed in
`evidence/sessions-s74-s78.json`. It added the `touchHold` step, one finger held still for a set
time, and the `cssScale` option of the screenshot step, which clips the capture to the viewport at
1/DPR so that it has the size of a REA capture. `rea-extract.mjs` reduces its one REA listener
inspection to listener types and flags and script paths, because the record also holds the
script's source text, which stays in the raw tree. The menu items, tools and clipboard batch
s79–s82 ran on 2026-11-06 at 11:03–11:26 UTC under the same gate and is indexed in
`evidence/sessions-s79-s82.json`. It added the `clipboardItems` probe, which, after the driver's
`grantClipboard` step, reduces every clipboard item to its types and byte counts, a PNG to its
header size and a text to the clipboard text shape; like the clipboard text probe, its results
stay in the raw timelines.

s83–s84 ran on 2026-11-06 at 12:18–12:35 UTC under the same gate, with a navigation gate added
after every scenario, and is indexed in `evidence/sessions-s83-s84.json`. It added the
`clipboardWrite` step, which writes one self-authored plain text of printable ASCII and refuses any
text that reads as a link, and the `clipboardUrl` probe, which keeps a copied link's origin, path,
query key names with value lengths and fragment shape; their results stay in the raw timelines.
These were the last live sessions of issue #1; [readiness.md](readiness.md) classifies what stays
open.

## Division of labour

1. REA collected passive evidence: target listing, page inspection (DOM, accessibility, storage
   keys, scripts), navigation lifecycle, viewport screenshots, script export, static bundle
   analysis, and observation windows armed **while the driver drew on the canvas** (s6 and s7)
   or ran a scenario (s8–s11). Two of those windows used `observe_web_session`, which retains
   navigation and lifecycle metadata only; five used `inspect_web_page`, which also retained
   same-origin request, WebSocket and console metadata. The four of s8–s11 were armed before
   their scenario's first step. Their bounds and contents are in `evidence/rea-windows.json`.
2. The Playwright driver performed the canvas inputs REA cannot express: pointer drags,
   modifier clicks, wheel, keyboard chords, multi-touch, file drop and native-dialog handling.
   Between batches it read back session-created state and layout metrics.
3. REA and the driver worked on the **same** isolated browser.

## Reproduction

```sh
OUT=/absolute/path/outside/the/repo/s12-desktop  # a new directory per session
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
  with `node research/excalidraw/rea-windows.mjs <root> docs/reverse-engineering/evidence/rea-windows.json <sessions...>`,
  and the netlog placement with
  `node research/excalidraw/netlog-steps.mjs <root> docs/reverse-engineering/evidence/netlog-steps.json <sessions...>`.
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
- **The R-76 sessions (s8–s11)** ran the driver at `0b4fb19` with every control below in place.
  None of them opened a room view, started a page navigation of its own, refused a capture or
  halted, so the controls below that act only in those cases were not triggered live.
- **Controls added after s7** (remediation of the third review; covered by stub-based unit and
  integration tests, and not triggered in a live session):
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
- **Controls added after the review of a78a210** (stub-based tests only, for the same reason):
  - The handler's result is redacted like the step record before the row reaches the raw
    timeline: the `selector` and `role` handlers echo their step fields in it.
- **Controls added after the review of 8029c1e** (stub-based tests only, for the same reason):
  - The driver's HTTP reply, and so what `run.mjs` prints, carries the redacted result of the
    timeline row. Before, it carried the result as the handler returned it: the step fields that
    `selector` and `role` echo, and bounded probe reads that were never redacted, such as
    storage key names, the keys of stored JSON values, picked app-state values (`activeTool`,
    `selectedElementIds`) and the focused element's `aria-label`.

## Validation of the evidence

- Every screenshot's PNG header was checked. From s6 on, layout metrics are asserted before the
  first input of every main scenario (see Environment).
- Committed JSON is produced by scripts and formatted by Prettier, so `npm run format:check`
  parses it. All nine probe summaries (s1, s2, s3, s6, s7 and s8–s11) regenerate unchanged with the current tools, and
  `evidence/rea-windows.json` regenerates byte for byte from the retained REA records and
  timelines.
- `research/excalidraw/tests/unit/documentation.test.mjs` checks the documents against the
  committed evidence: the eleven fields of every behaviour entry, a residual row for every scope
  and inventory ID, and the cited cross-session counts, save timings, REA windows, arrow, paste,
  image and zoom geometry, and service-worker counts.
- `bundle-01-desktop.json` passes `rea evidence-export` (3 records, 0 unknowns). The other REA
  bundle no longer exists, and the s5–s7 CLI records are single Evidence records (see
  [REA findings](rea-findings.md#evidence-ids)).
- Every s6 and s7 timeline row matches a step of a committed scenario. Each s8–s11 timeline is
  exactly the steps of the scenarios in its row of the
  [research README](../../research/excalidraw/README.md#scenario-order-and-dependencies), in
  that order, with no failed step.
- All owned containers, networks, drivers, ports and token files were stopped, removed and
  checked after each session.
