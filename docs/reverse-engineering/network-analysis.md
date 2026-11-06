# Network, storage and worker analysis

Sources:

- the driver's metadata-only netlog (method, origin, path, query **key names**, type, status,
  counts), summarised in `evidence/sessions.json`;
- REA `inspect_web_page` (storage key inventory; requests, WebSocket and console metadata in an
  attach window) and `observe_web_session` (lifecycle). The s1 REA WebSocket frame shapes came
  from `ev_43b25e14`, which is lost (see [REA findings](rea-findings.md#evidence-ids));
- REA static API counts (`evidence/static-api-surface.json`).

Headers, cookies, bodies, query values and WebSocket payloads were never recorded. Query
parameters appear below by key name only.

## 1. Observed traffic [O]

### Page load

| Origin                                               | Requests                                                                                                                                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://excalidraw.com`                             | document `/`, one stylesheet, module scripts (`index-*.js` ≈1.9 MB, `bundler-helpers`, `roundRect`, `workbox-window`), manifest, icons                                                                                               | On this origin, the first load in a fresh profile came from the network (9 requests with `fromServiceWorker: false` in each of s2–s10; s11 had 10, the 9 plus one page fetch of `/assets/mermaid-chunks-*.json`, which the netlog wrote during scenario 10, not with the load [I, raw netlog and timeline times]); later loads were served by a Workbox service worker (79 `true` in s6; all 26 of s1's requests to this origin). s11, with one load, also had 64 `true`: 63 `fetch` requests for `/assets/` chunks and 1 script, all during scenario 10 (see below); their trigger is not isolated [U], and a precache install is [H] |
| `https://excalidraw.nyc3.cdn.digitaloceanspaces.com` | 7 distinct WOFF2 files under `/oss/fonts/` in every session (Nunito, Excalifont, Comic Shanns, and 4 Assistant files), plus an 8th, Cascadia Code, in s1, s3, s6, s7 and s11 (not s2, s4, s5 or s8–s10). Its trigger is not isolated | Also served through the service worker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `https://scripts.simpleanalyticscdn.com`             | `GET /latest.js`                                                                                                                                                                                                                     | Third-party analytics script                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `https://queue.simpleanalyticscdn.com`               | `GET /simple.gif` → 202, in two key sets: 23 query keys (names include viewport/screen size, language, timezone, OS, user agent, page id, session id and `src`), and 24 keys with `event` and `metadata` instead of `src`            | The 23-key beacon came once per document load in s6 (9 for 9 loads). The 24-key variant came 4 more times in s6 (13 beacons in all) and also in s1, s3, s7 and s11; it reads as an event beacon [I]; each followed one of five inputs (below), but its trigger is not isolated (R-66)                                                                                                                                                                                                                                                                                                                                                  |
| `https://sentry.io`                                  | `POST /api/<project>/envelope/` with 3 query keys                                                                                                                                                                                    | Error/session telemetry on every page load (9 in s6, which had 9 document loads)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

REA lifecycle (`observe_web_session`, `ev_58bb47ed`, s6 scenario 02, service worker warm):
relative to the `init` lifecycle event, DOMContentLoaded at 0.314 s, load at 0.381 s, first
contentful paint at 0.594 s, network idle at 0.666 s, first image paint at 3.397 s. Measured
once [O, medium]. The offsets come from the raw REA record; the committed `rea-windows.json`
keeps only the event names and counts. The s1 figures (about 1.4–2.1 s) came from Evidence lost
in an MCP restart and are withdrawn.

**Traffic while the driver drew** (window facts from `evidence/rea-windows.json`; details in
[REA findings](rea-findings.md#1-established-directly-by-rea-o)):

- Scenario 13 (s6, `inspect_web_page`): REA retained 0 requests, 0 WebSocket connections and
  0 console events for the one allowed origin, `https://excalidraw.com`, from 16:11:07.044 to
  16:11:32.276 UTC, a span that includes all 3 drags. Other origins were excluded by policy and
  are not represented.
- Scenarios 12, 13 and 15 (s8–s10, desktop, 15 in dark) and 14 (s11, mobile, dialogs and no
  drawing), each with an `inspect_web_page` window armed before its first step: 0 requests,
  0 WebSocket connections and 0 console events for the same allowed origin in all four, over
  every step of each scenario [O; for the allowed origin only: high for scenario 13, seen in s6
  and s9, and medium for 12, 15 and 14, one window each].
- Scenarios 02 (s6) and 10 (s7) were observed with `observe_web_session`, which retains
  navigation and lifecycle metadata only. They show no navigation other than 02's own load;
  they cannot show requests, WebSocket traffic or console output.
- Whether drawing causes traffic on any origin is therefore **not established** [U]. The driver
  netlog has a time for every entry, which `evidence/netlog-steps.json` sets against the steps
  without a new live session; the netlog writes a request once it has finished or failed, so
  that time bounds when the request started but is not that start. In s8–s11 no entry on any
  origin was written during scenarios 12, 13 or 15, and one, to
  `https://queue.simpleanalyticscdn.com`, during 14 [I, raw netlog and timeline times].
- **Every drawing step, every origin** [I, raw netlog and timeline times]. A drawing step is a
  `drag`, `path` or `touchDrag`, from its start to the next step's start. In s1–s7 there were 71
  (s1 22, s2 14, s3 3, s6 29 and s7 3; s4 and s5 drew nothing), and with s8–s11 82, on desktop in
  light and dark theme (s6's last two are scenario 15's) and on mobile (scenario 10's touch
  drawing, pinch and pan in s3, s7 and s11). No netlog entry was written during any of them.
  - After a drawing step, the next entry came at least 59.0 s later in s1, 2.6 s in s3, 5.1 s in
    s6, 3.3 s in s7 and 2.8 s in s11. In s2 and s8–s10 the netlog wrote nothing after the first
    drawing step. So the netlog wrote any request on any origin that a drawing step started no
    sooner than that, or never wrote it. It writes a request after the request has finished or
    failed, and a finished one only after the driver has awaited its response, so a write time is
    not when the request finished or failed either. Each of those next entries was written during
    a later step that does not draw; whether a drawing step started one of them cannot be told
    from the netlog [U].
  - The netlog keeps no console output, and it counts WebSocket frames only when a socket
    closes, which neither collaboration socket did. No drawing step ran after a collaboration
    socket opened: s1 and s6 last drew at 13:39:36 and 16:14:05 UTC, and their sockets opened at
    13:43:47 and 16:14:22 UTC.
  - So no session wrote a netlog entry while it drew. Whether drawing starts a request that ends
    later, or causes console output on mobile or WebSocket traffic in a room, is not
    established [U].
- **The 24-key beacons** [I, raw netlog and timeline times]. Each of the 13 (4 in s1 and s6, 1 in
  s3, 2 in s7 and s11) was written 42–599 ms after one of five inputs and before the next input:
  the Command palette (Ctrl+/ in scenario 01 on desktop, the Command palette control in 14 on
  mobile), Export to PNG, Export to SVG, Ctrl+S, and the tap before `m07-library` on mobile. s1
  and s6 each wrote one after each of the four desktop inputs, and none followed a drawing step.
  That these inputs send an analytics event is a hypothesis [H].
- **s11's requests after its load** [I, raw netlog and timeline times]. Of its 87
  requests, the netlog wrote 19 during 09's load, 67 during scenario 10 and 1 during 14, and none
  in the rest of 09 or during the two storage reads (16). `evidence/netlog-steps.json` keeps each
  entry's offset from the step in effect; placing that step in a scenario uses the step order,
  which the s11 timeline follows exactly.
  - In scenario 10, none was written during its touch drawing, tap-select, pinch and pan steps;
    the first was written about 250 ms after the two taps before `m06-more-tools`.
  - In scenario 10, every request that the service worker served, the 64 on the page origin and
    the Cascadia Code font, was written between 04:54:12.0 and 04:54:19.7 UTC: the font first,
    the script about 100 ms after the tap before `m07-library`, and the 63 fetches from
    04:54:18.9, after the `mermaid-chunks` fetch.
  - The 24-key beacon was written twice: about 280 ms after the tap before `m07-library` in 10,
    and about 250 ms after the Command palette step in 14, the only request of 14.

  This narrows R-64 and R-66 without isolating a trigger: a step of 10, or a delay since the
  load, may start the service worker's requests, and each beacon may follow the step before it
  or something else [U].

### Lazily loaded chunks [O]

- `subset-worker.chunk-*.js` and `subset-shared.chunk-*.js`. A **dedicated worker** was created
  from the subset-worker chunk (netlog `worker` event, s1 and s6 only; no mobile netlog has one).
  In both sessions its event was written during the step that clicks Export to SVG in the Export
  image dialog, 681 ms (s1) and 953 ms (s6) after that step started, after the netlog wrote both
  chunks and before it wrote both again [I, raw netlog and timeline times]. Both sessions clicked
  Export to PNG 15.0 s before, in the same dialog, and wrote no worker event then. These times
  cannot tell the SVG click from a delayed effect of the PNG export or of opening the dialog, so
  that the SVG export starts the worker is a hypothesis [H]. Of the mobile scenarios only 19
  clicks Export to SVG, with no Export to PNG before it; in s15 it wrote no worker event.
- On collaboration start: `firebaseSDK-*.js`, `qrcode.chunk-*.js`, `random-username.esm-*.js`.
- Other `index-*.js` chunks with different hashes were also loaded. What they contain is [U].

### Collaboration (s1 and s6) [O]

| Endpoint                                                                     | Observation                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wss://oss-collab.excalidraw.com/socket.io/` (query keys `EIO`, `transport`) | One WebSocket per session, opened on Start session (s1 and s6). s1's REA frame shapes reported text frames of 2–116 bytes, then **binary** frames sent in pairs of 137 and 12 bytes; that Evidence is lost and the shapes were not re-observed, so they are [O, low]. |
| `https://firestore.googleapis.com/v1/projects/excalidraw-room-persistence/…` | `documents:batchGet` ×2 and `documents:commit` ×2 (POST, 200), identical in s1 and s6.                                                                                                                                                                                |
| `https://firebasestorage.googleapis.com/v0/b/excalidraw-room-persistence…/o` | One `POST`, with 1 query key, while the scene contained a dropped image (s1 and s6).                                                                                                                                                                                  |

The room identifier and key exist only in the URL **fragment** (`#room=<20>,<22>`). Fragments
are not sent in HTTP requests, and no room value appeared in any recorded request path [O/I,
high]. Tools that read the page URL do see it: REA target listings keep fragments, which is how
s1's REA records retained the key (see [checkpoint](checkpoint.md#privacy-remediation)).

### Observation batch (s12–s14) [O]

- **Request start times.** From s12 on, the netlog records when each request started. s12 has
  104 requests, every one with its start; none fell while one of scenario 10's 3 touch drags was
  the latest step to start (`evidence/netlog-steps-s12-s14.json`) [I, raw netlog and timeline times].
- **Service worker in scenario 10.** As in s11, the service worker served 63 `fetch` requests for
  `/assets/*.js` in scenario 10. In s12 they began 0.5 to 0.7 s after the tap that closed the main
  menu after the Dark mode switch [I, raw netlog and timeline times]; what starts them is [H].
- **REA beside the netlog.** The s12 window over scenario 10 allowed the 7 HTTP(S) origins of the
  s1–s11 netlogs and retained 67 requests, 0 WebSocket connections and 0 console events; the
  netlog has 67 requests with a start inside the window's network coverage, on 3 origins.
- **Mermaid to Excalidraw on mobile.** Clicking it wrote 2 aborted script requests, then 14
  scripts in the next wait [I, raw netlog and timeline times]. Opening Text to diagram wrote one
  analytics beacon and nothing else; nothing was generated.
- **Verification page.** In s13 and s14 the desktop document `/` returned 403, and the page then
  requested a script, a worker and a fetch under `/.well-known/vercel/security/`, with one POST
  to it that failed (`evidence/sessions-s12-s14.json`). No app script, font or analytics request
  followed.

### Mobile follow-up (s15–s16) [O]

- **Export to SVG on mobile.** In s15 the only request after the load was an analytics beacon whose
  query keys include `event`, started 229 ms after scenario 19's Export to SVG click step; no
  `worker` event, script or font followed (`evidence/sessions-s15-s16.json`)
  [I, raw netlog and timeline times].
- **Mermaid to Excalidraw again.** In s16 opening it wrote the same 2 aborted script requests and 14
  scripts served by the service worker as in s12.
- **Mobile reload.** The reload of scenario 24 got its document (HTTP 200) from the service worker.
- **REA beside the netlog.** The three s15 and s16 windows kept 1, 67 and 18 requests, as many as
  the netlog started inside each (`evidence/rea-windows-s15-s16.json`).

### Mobile priority-1 batch (s17–s21) [O]

- **Loads and reloads.** Each of the five loads got its document with HTTP 200 from the network,
  with no request under `/.well-known/vercel/`, and each of the three reloads (s17, s19, s21) got it
  from the service worker (`evidence/sessions-s17-s21.json`).
- **No traffic during touch input.** The netlog placed every entry in a load or a reload and the
  wait after it, none in scenarios 25, 26 or 27, and the 11 REA windows allowing 7 origins kept 0
  requests, 0 WebSocket connections and 0 console events (`evidence/netlog-steps-s17-s21.json`,
  `evidence/rea-windows-s17-s21.json`).

### Mobile touch-control batch (s22–s36) [O]

- **Loads.** Each of the 15 loads got its document with HTTP 200 from the network, with no request
  under `/.well-known/vercel/` and no `.map` request (`evidence/sessions-s22-s36.json`).
- **No traffic during touch input or named-control clicks.** Each netlog holds 20 entries, all
  placed in 09's load and the wait after it, none in scenarios 28–35 or 16, and the 15 REA windows
  allowing 7 origins kept 0 requests, 0 WebSocket connections and 0 console events
  (`evidence/netlog-steps-s22-s36.json`, `evidence/rea-windows-s22-s36.json`).

### Mobile control batch (s37–s50) [O]

- **Loads.** Each of the 13 loads of s37–s49 got its document with HTTP 200 from the network, with
  no request under `/.well-known/vercel/`. In s50 the document came with HTTP 403, followed by the
  challenge script and WebAssembly file and a `request-challenge` POST (HTTP 204) under
  `/.well-known/vercel/security/`, after which the page navigated to `/` itself and got the app
  with HTTP 200; the load gate stopped the session there. The 14 netlogs hold no `.map` request
  (`evidence/sessions-s37-s50.json`).
- **No traffic during touch input.** No request started while a touch drag was the latest step
  (`evidence/netlog-steps-s37-s50.json`), and the windows over scenarios 36–39 kept 0 requests.
- **Font picker.** Opening it fetched the Lilita One font file from the font CDN origin, served by
  the service worker, in each of s41, s45, s46 and s47 [I, raw netlog and timeline times]; REA kept
  that one request in each window (`evidence/rea-windows-s37-s50.json`).
- **Mermaid to Excalidraw.** Over scenario 42 the netlog started 82 requests on the 7 origins in
  each of s48 and s49, and REA kept as many.
- **Text to diagram.** The one prompt of s49 started one POST to
  `https://oss-ai.excalidraw.com/v1/ai/text-to-diagram/chat-streaming`, an origin that no earlier
  netlog recorded, with the Enter step; the netlog wrote it as failed (`net::ERR_ABORTED`) 2.8 s
  later, although the dialog then showed the result ([limitations](limitations.md#tooling-limits)).
  Three analytics beacons with an `event` query key started inside the same window, when the tab
  opened, with the Enter step and after the failure event [I, raw netlog and timeline times]. The
  REA window allowed the 7 earlier origins, so it kept the 3 beacons and not the generation request.

### Mobile radio and edit batch (s51–s57) [O]

- **Loads.** Each of the 7 loads, on 2026-11-06 at 00:39–01:21 UTC, got its document with HTTP 200
  from the network, with no request under `/.well-known/vercel/`; the 7 netlogs hold no `.map`
  request (`evidence/sessions-s51-s57.json`).
- **Export to Link.** The one tap on Export to Link in s52 started one analytics beacon with an
  `event` query key, one POST to `https://json.excalidraw.com/api/v2/post/` (HTTP 200), an origin
  that no earlier netlog recorded, and the Firebase SDK chunk, served by the service worker, in
  that order, 0.3, 0.3 and 0.7 s after the tap [I, raw netlog and timeline times]; no other
  request followed in the scenario (`evidence/netlog-steps-s51-s57.json`). The netlog keeps no
  body, so what was sent is not recorded; that the scene was encrypted before the upload, as the
  dialog says, is [H]. No REA call ran during or after it.
- **No traffic during the radio, edit and link scenarios.** In s51 and s53–s57 every netlog entry
  belongs to the load: none was written during scenarios 45–48, their touch drags and touch paths
  included, and the 9 REA windows over them kept 0 requests (`evidence/rea-windows-s51-s57.json`).
  The self-authored link of scenario 47 made no request to its origin.

## 2. Storage [O]

| Store          | Keys / names                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| localStorage   | `excalidraw`, `excalidraw-state`, `excalidraw-theme`, `i18nextLng`, `version-dataState`, `version-files`                                                                                                                                                             |
| sessionStorage | none                                                                                                                                                                                                                                                                 |
| IndexedDB      | `excalidraw-library-db`, `excalidraw-ttd-chats-db`, `files-db`; also `workbox-expiration` in s6 (raw REA record only)                                                                                                                                                |
| Cache Storage  | 1 cache (the Workbox precache) at s1's initial load; 3 at s1's later inspection, 2 in s6 and 3 at the end of s11's window during scenario 14 (cache counts in `evidence/rea-windows.json`); the s6 names, the precache and `fonts`, are from the raw REA record only |
| Usage          | about 2.5 MB of a 644 MB quota [O, raw REA record only] (REA, s1 initial load; not in the committed summary)                                                                                                                                                         |

The first-load inventory in the localStorage, sessionStorage, IndexedDB and Cache Storage rows
is the same in s1 and in each of s8–s11, mobile included (`evidence/rea-inspect-initial*.json`).

## 3. Static bundle signals [S]

These are identifier counts in the shipped main bundle; they say nothing about execution.
They include `showOpenFilePicker` (2), `showSaveFilePicker` (1), `launchQueue` (3), `indexedDB`
(4), `BroadcastChannel` (1), `serviceWorker` (1), `new Worker` (1), `SharedWorker` (1),
`WebSocket` (2), `crypto.subtle` (8), `AES-GCM` (5), `navigator.clipboard` (14), `ClipboardItem`
(3), `visibilitychange` (2), `beforeunload` (3), `navigator.onLine` (3), `FontFace` (6),
`WebAssembly` (5), `navigator.share` (1), `beforeinstallprompt` (1). The `roundRect` chunk
references `OffscreenCanvas` and `Path2D`.

## 4. Backend hypotheses (not verified)

| ID   | Hypothesis                                                                                                                                   | Basis                                                                                                                                             | Confidence |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| N-H1 | The collab server relays opaque, client-encrypted scene updates over socket.io rooms and cannot read them                                    | Binary frames; `AES-GCM` and `crypto.subtle` [S]; the dialog's E2E claim [O]                                                                      | medium     |
| N-H2 | The 12-byte binary frame paired with each payload frame is an AES-GCM initialisation vector (12 bytes is the conventional GCM IV size)       | Repeated 137/12 pairing [O, low: lost Evidence, seen once]                                                                                        | low        |
| N-H3 | The 22-character fragment part is a base64url-encoded 128-bit symmetric key, and the 20-character part is the room id                        | Lengths [O]; the key stays client-side [I]                                                                                                        | medium     |
| N-H4 | Firestore stores an encrypted room scene snapshot for late joiners, and Firebase Storage stores encrypted binary files (images) for the room | Project name; batchGet/commit at session start; storage POST when an image was present [O]                                                        | medium     |
| N-H5 | `version-dataState` and `version-files` plus `BroadcastChannel` coordinate several tabs on the same origin                                   | Key names [O]; identifier [S]                                                                                                                     | low        |
| N-H6 | The subset worker subsets fonts (possibly with WebAssembly) for export or embedding                                                          | Chunk name [O]; `FontFace` and `WebAssembly` [S]; its event written during the Export to SVG step in s1 and s6 [I, raw netlog and timeline times] | low        |

## 5. Unverified

These are tracked in the [residual matrix](residual-matrix.md): reconnection and offline
behaviour, "Export to Link" traffic beyond one mobile upload and what it sent, library browsing
traffic, Text to diagram traffic beyond one mobile request, Wireframe to code traffic and Mermaid
to Excalidraw on desktop, the precise trigger of each lazy chunk, and Sentry/analytics payload
contents (deliberately not captured).
