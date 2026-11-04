# Methodology: clean-room guest-mode behavioural research

Issue: #1. Reference: the public `https://excalidraw.com/` application, used as an
unauthenticated guest. Planewright is not affiliated with Excalidraw or REA; see
[ADR 0003](../adr/0003-clean-room-reference-policy.md).

## Clean-room rules applied

| Rule                                                   | How it was applied                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No reference source repository, package or source maps | Nothing was cloned or installed. REA was always called with `fetch_source_maps: false`; source-map URLs were recorded only as declarations.                                                                                                                  |
| Shipped bundles are observable artefacts only          | REA captured the scripts the browser received and exported them to a directory **outside** the repository. The only derived output is `evidence/static-api-surface.json`: occurrence counts of standard web-platform identifiers. It holds no code excerpts. |
| No copied code, components, assets or text             | Docs describe behaviour in our own words. Control names are quoted only where they are needed to identify the control. Screenshots, ARIA snapshot text and bundles are not committed.                                                                        |
| Guest only; no protection bypass                       | No login, sign-up, Excalidraw+ or AI feature was used. One live-collaboration session was started and ended.                                                                                                                                                 |
| Human-scale request volume                             | 3 short sessions (≈16, ≈1 and ≈1.5 minutes), about 10 page loads in total, and one collaboration room.                                                                                                                                                       |

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

Confidence is **high** when reproduced or doubly sourced (for example REA and the driver, or
two fresh profiles), **medium** when observed once, and **low** when indirect.

## Environment

| Item      | Value                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date      | 2026-11-04, 13:29–13:52 UTC                                                                                                                                                                                                                                                  |
| Browser   | Chrome 156.0.8078.80, headless, from the `mcr.microsoft.com/playwright:v1.64.1-noble` image                                                                                                                                                                                  |
| Isolation | One disposable container per session: non-root user, all capabilities dropped, `no-new-privileges`, profile in tmpfs, no host mounts. Chromium's own sandbox cannot run under the container's seccomp profile, so the container is the boundary.                             |
| Ports     | DevTools published only on `127.0.0.1:9222`; driver on `127.0.0.1:9333` (verified with `ss -ltn`)                                                                                                                                                                            |
| REA       | 6.8.0 at build `5b953e13c4451df3afcaab7724c06db5eedf58f7`, project-local MCP server                                                                                                                                                                                          |
| Driver    | Playwright-core 1.64.1 over CDP (`research/excalidraw/driver.mjs`)                                                                                                                                                                                                           |
| Viewports | Desktop 1280×720, DPR 1, set with `Emulation.setDeviceMetricsOverride` and verified as `innerWidth`/`innerHeight` 1280×720. Mobile 390×844, DPR 3, touch (5 points), Android Chrome user agent; verified 390×844, DPR 3, `maxTouchPoints` 5, canvas backing store 1170×2532. |
| Sessions  | `s1-desktop` (light, dark and collaboration; 472 steps), `s2-desktop-fresh` (fresh profile rerun; 179 steps), `s3-mobile` (fresh profile; 71 steps)                                                                                                                          |

## Division of labour

1. REA collected passive evidence: target listing, page inspection (DOM, accessibility,
   storage keys, scripts, WebSocket frame shapes), navigation lifecycle, viewport screenshots,
   script export, static bundle analysis, and Evidence bundle export.
2. The Playwright driver performed the canvas inputs REA cannot express: pointer drags,
   modifier clicks, wheel, keyboard chords, multi-touch, file drop and native-dialog handling.
   Between batches, the driver read back session-created state (storage shape, scene geometry,
   clipboard shape, URL fragment shape).
3. REA and the driver worked on the **same** isolated browser. Overlap was avoided, except where
   REA observation windows were deliberately armed around a driver action.

## Reproduction

1. Start a disposable browser: `research/excalidraw/browser.sh start pw-research 9222`.
2. Start the driver with an **absolute output directory outside the repository**. See
   [research/excalidraw/README.md](../../research/excalidraw/README.md).
3. Replay a scenario: `node research/excalidraw/run.mjs research/excalidraw/scenarios/<n>.json`.
   Each scenario states its viewport and starting assumptions.
4. Summarise it: `node research/excalidraw/timeline-summary.mjs <out>/timeline.jsonl`.
5. Rebuild the committed index:
   `node research/excalidraw/build-evidence.mjs <root> docs/reverse-engineering/evidence/sessions.json <sessions...>`.
6. Stop the driver (`curl -s http://127.0.0.1:9333/quit`) and the container
   (`browser.sh stop pw-research`).

Coordinates assume the stated viewport and default zoom. Drags that create shapes must start at
x ≥ 260 on desktop, because the properties panel covers x≈16–211 as soon as a drawing tool is
active (see [behaviour B-02](behavior-analysis.md#b-02-properties-panel-occupies-the-canvas-while-a-tool-is-active)).

## Sanitisation and storage

- **Committed** under `docs/reverse-engineering/evidence/`:
  - screenshot names, SHA-256 digests and pixel sizes;
  - ARIA snapshot names and line counts;
  - labelled probe summaries (geometry, selection, zoom and style values of shapes we drew);
  - network metadata (method, origin, path, query **key names**, type, status and counts);
  - REA Evidence IDs;
  - identifier counts.
- **Kept outside Git** in the workspace `artifacts/research/excalidraw/`: PNG screenshots, ARIA
  YAML, timelines, netlogs, raw REA results and bundles, and exported scripts. This follows
  `docs/investigation/README.md`, which forbids committing reference screenshots and captures.
- Collaboration room identifiers and keys were redacted from the external ARIA files. Only the
  shape of the URL fragment (key name and value lengths) was ever recorded. A scan of the
  committed evidence for room values, tokens, user names and local paths found none.

## Validation of the evidence

- Every screenshot's PNG header was checked against the requested viewport. Where two drivers
  captured the same state, their SHA-256 digests were compared (see [REA findings](rea-findings.md)).
- Committed JSON is produced by scripts and formatted by Prettier, so `npm run format:check`
  parses it.
- REA bundles were exported with `export_evidence_bundle` (`bundle-01-desktop.json`: 3 records;
  `bundle-02-collab-mobile.json`: 7 records; 0 unknowns each). They are stored externally.
- All owned containers, drivers and ports were stopped and checked after each session.
