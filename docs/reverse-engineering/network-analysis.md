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

| Origin                                               | Requests                                                                                                                                                                                                                | Notes                                                                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://excalidraw.com`                             | document `/`, one stylesheet, module scripts (`index-*.js` ≈1.9 MB, `bundler-helpers`, `roundRect`, `workbox-window`), manifest, icons                                                                                  | The first load in a fresh profile came from the network (9 requests with `fromServiceWorker: false` in s2–s7); reloads were served by a Workbox service worker (79 `true` in s6, all 26 recorded in s1) |
| `https://excalidraw.nyc3.cdn.digitaloceanspaces.com` | 7 distinct WOFF2 files under `/oss/fonts/` in every session (Nunito, Excalifont, Comic Shanns, and 4 Assistant files), plus an 8th, Cascadia Code, in s1, s3, s6 and s7 (not s2, s4 or s5). Its trigger is not isolated | Also served through the service worker                                                                                                                                                                  |
| `https://scripts.simpleanalyticscdn.com`             | `GET /latest.js`                                                                                                                                                                                                        | Third-party analytics script                                                                                                                                                                            |
| `https://queue.simpleanalyticscdn.com`               | `GET /simple.gif` → 202, 23 query keys (names include viewport/screen size, language, timezone, OS, user agent, page id, session id)                                                                                    | Analytics beacon on every page load                                                                                                                                                                     |
| `https://sentry.io`                                  | `POST /api/<project>/envelope/` with 3 query keys                                                                                                                                                                       | Error/session telemetry on every page load (9 in s6, which had 9 document loads)                                                                                                                        |

REA lifecycle (`observe_web_session`, `ev_58bb47ed`, s6 scenario 02, service worker warm):
relative to navigation init, DOMContentLoaded at about 0.31 s, load at 0.38 s, first contentful
paint at 0.59 s, network idle at 0.67 s, first image paint at 3.4 s. Measured once [O, medium].
The s1 figures (about 1.4–2.1 s) came from Evidence lost in an MCP restart and are withdrawn.

While the driver drew on the canvas (scenarios 02, 10 and 13), REA recorded no request,
WebSocket, console, navigation or failure event attributable to drawing [O, high: s6 desktop
and s7 mobile].

### Lazily loaded chunks [O]

- `subset-worker.chunk-*.js` and `subset-shared.chunk-*.js`. A **dedicated worker** was created
  from the subset-worker chunk (netlog `worker` event). Which action triggered it was not
  isolated [U].
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

| Store          | Keys / names                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| localStorage   | `excalidraw`, `excalidraw-state`, `excalidraw-theme`, `i18nextLng`, `version-dataState`, `version-files` |
| sessionStorage | none                                                                                                     |
| IndexedDB      | `excalidraw-library-db`, `excalidraw-ttd-chats-db`, `files-db`; also `workbox-expiration` in s6          |
| Cache Storage  | one Workbox precache (`workbox-precache-v2-…`)                                                           |
| Usage          | about 2.5 MB of a 644 MB quota (REA, initial load)                                                       |

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
