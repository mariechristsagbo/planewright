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

| Origin                                               | Requests                                                                                                                                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://excalidraw.com`                             | document `/`, one stylesheet, module scripts (`index-*.js` ≈1.9 MB, `bundler-helpers`, `roundRect`, `workbox-window`), manifest, icons                                                                                               | On this origin, the first load in a fresh profile came from the network (9 requests with `fromServiceWorker: false` in each of s2–s10; s11 had 10, the 9 plus one page fetch of `/assets/mermaid-chunks-*.json`, which started during scenario 10, not with the load [I, raw netlog and timeline times]); later loads were served by a Workbox service worker (79 `true` in s6; all 26 of s1's requests to this origin). s11, with one load, also had 64 `true`: 63 `fetch` requests for `/assets/` chunks and 1 script, all during scenario 10 (see below); their trigger is not isolated [U], and a precache install is [H] |
| `https://excalidraw.nyc3.cdn.digitaloceanspaces.com` | 7 distinct WOFF2 files under `/oss/fonts/` in every session (Nunito, Excalifont, Comic Shanns, and 4 Assistant files), plus an 8th, Cascadia Code, in s1, s3, s6, s7 and s11 (not s2, s4, s5 or s8–s10). Its trigger is not isolated | Also served through the service worker                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `https://scripts.simpleanalyticscdn.com`             | `GET /latest.js`                                                                                                                                                                                                                     | Third-party analytics script                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `https://queue.simpleanalyticscdn.com`               | `GET /simple.gif` → 202, in two key sets: 23 query keys (names include viewport/screen size, language, timezone, OS, user agent, page id, session id and `src`), and 24 keys with `event` and `metadata` instead of `src`            | The 23-key beacon came once per document load in s6 (9 for 9 loads). The 24-key variant came 4 more times in s6 (13 beacons in all) and also in s1, s3, s7 and s11; it reads as an event beacon [I], and its trigger is not isolated (R-66)                                                                                                                                                                                                                                                                                                                                                                                   |
| `https://sentry.io`                                  | `POST /api/<project>/envelope/` with 3 query keys                                                                                                                                                                                    | Error/session telemetry on every page load (9 in s6, which had 9 document loads)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

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
  netlog has per-request timestamps that can be set against the drawing steps without a new
  live session. For s8–s11 this was done: no request on any origin started during scenarios
  12, 13 or 15, and one, to `https://queue.simpleanalyticscdn.com`, during 14 [I, raw netlog
  and timeline times]. For s1–s7 it has not been done (R-66).
- **s11's requests after its load** [I, raw netlog and timeline times]. Of its 87
  requests, 19 started during 09's load, 67 during scenario 10 and 1 during 14; none started in
  the rest of 09 or during the two storage reads (16). The times are raw-only; placing them in
  a scenario uses the step order, which the s11 timeline follows exactly.
  - In scenario 10, none started during its touch drawing, tap-select, pinch and pan steps; the
    first came about 250 ms after the two taps before `m06-more-tools`.
  - In scenario 10, every request that the service worker served, the 64 on the page origin and
    the Cascadia Code font, started between 04:54:12.0 and 04:54:19.7 UTC: the font first, the
    script about 100 ms after the tap before `m07-library`, and the 63 fetches from 04:54:18.9,
    after the `mermaid-chunks` fetch.
  - The 24-key beacon came twice: about 280 ms after the tap before `m07-library` in 10, and
    about 250 ms after the Command palette step in 14, the only request of 14.

  This narrows R-64 and R-66 without isolating a trigger: a step of 10, or a delay since the
  load, may start the service worker's requests, and each beacon may follow the step before it
  or something else [U].

### Lazily loaded chunks [O]

- `subset-worker.chunk-*.js` and `subset-shared.chunk-*.js`. A **dedicated worker** was created
  from the subset-worker chunk (netlog `worker` event, s1 and s6 only; no mobile netlog has one).
  Which action triggered it was not isolated [U].
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

| ID   | Hypothesis                                                                                                                                   | Basis                                                                                      | Confidence |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- |
| N-H1 | The collab server relays opaque, client-encrypted scene updates over socket.io rooms and cannot read them                                    | Binary frames; `AES-GCM` and `crypto.subtle` [S]; the dialog's E2E claim [O]               | medium     |
| N-H2 | The 12-byte binary frame paired with each payload frame is an AES-GCM initialisation vector (12 bytes is the conventional GCM IV size)       | Repeated 137/12 pairing [O, low: lost Evidence, seen once]                                 | low        |
| N-H3 | The 22-character fragment part is a base64url-encoded 128-bit symmetric key, and the 20-character part is the room id                        | Lengths [O]; the key stays client-side [I]                                                 | medium     |
| N-H4 | Firestore stores an encrypted room scene snapshot for late joiners, and Firebase Storage stores encrypted binary files (images) for the room | Project name; batchGet/commit at session start; storage POST when an image was present [O] | medium     |
| N-H5 | `version-dataState` and `version-files` plus `BroadcastChannel` coordinate several tabs on the same origin                                   | Key names [O]; identifier [S]                                                              | low        |
| N-H6 | The subset worker subsets fonts (possibly with WebAssembly) for export or embedding                                                          | Chunk name [O]; `FontFace` and `WebAssembly` [S]                                           | low        |

## 5. Unverified

These are tracked in the [residual matrix](residual-matrix.md): reconnection and offline
behaviour, "Export to Link" traffic, library browsing traffic, the generation (AI) features,
the precise trigger of each lazy chunk, and Sentry/analytics payload contents (deliberately not
captured).
