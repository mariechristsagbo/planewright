# REA findings: what REA established and what needed other tools

REA 6.8.0 at build `5b953e13…`. Sessions s1–s3 used the project-local MCP server. Sessions s5–s7
used the REA CLI of the same build (`../rea-build/scripts/rea.mjs`), because the MCP tools were
denied permission in that non-interactive session (see [checkpoint](checkpoint.md#blockers-and-residuals)).
Raw Evidence stays outside the repository. `evidence/sessions.json` lists the IDs found in
retained files; IDs that survive only in a session transcript are listed below.

## Evidence IDs

**Retained and re-verifiable.** All are under `s1-desktop/rea/`; the bundle passed
`rea evidence-export` on 2026-11-04 (3 records, 0 unknowns).

| Evidence (prefix) | Operation                | Where                                      |
| ----------------- | ------------------------ | ------------------------------------------ |
| `ev_e87d6771`     | `inspect_web_page`       | `d01-inspect-initial.json` (initial page)  |
| `ev_8da6254e`     | `capture_web_screenshot` | `d01-rea-screenshot-initial.json`          |
| `ev_32e75e1c`     | `capture_web_screenshot` | `bundle-01-desktop.json` (desktop dark)    |
| `ev_d7cf0a58`     | `inspect_web_page`       | `bundle-01-desktop.json` (with scripts)    |
| `ev_8624abb1`     | `export_web_scripts`     | `bundle-01-desktop.json`, scripts manifest |

**Lost.** The capture transcript shows that these were returned, but no retained Evidence file
holds them. Facts that rested only on them are narrowed in the other documents.

| Evidence (prefix)            | Operation                | Why it is gone                                                                                                                                                                                                 |
| ---------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ev_70180ae1`                | `list_browser_targets`   | Returned in s1 and held only in MCP memory, which was lost when the server restarted                                                                                                                           |
| `ev_28928b56`                | `capture_web_screenshot` | Mobile screenshot; it was in `bundle-02-collab-mobile.json`, which was removed because it also held the room id and key                                                                                        |
| `ev_43b25e14`                | `inspect_web_page`       | Collaboration inspection (WebSocket frame shapes); its file `d03-inspect-collab.json` was removed for the same reason. Only a sanitised cache copy outside the workspace remains                               |
| `ev_e77f6f38`, `ev_e89af49b` | `analyze_web_bundle`     | Both IDs came from one call. The first review identified `ev_e77f6f38` as the bundle-analysis record and `ev_e89af49b` as an `inspect_analysis_view` record; neither is retained, so this cannot be re-checked |

**New REA CLI records** (s5–s7; each file is one Evidence record in a `{ ok, data }` envelope).

| Session              | File                                | Evidence (prefix) | Operation                                                   |
| -------------------- | ----------------------------------- | ----------------- | ----------------------------------------------------------- |
| `s5-desktop-aborted` | `r00-targets.json`                  | `ev_7c91d27d`     | `list_browser_targets` (about:blank only, no target listed) |
| `s5-desktop-aborted` | `r01-targets.json`                  | `ev_22ee443f`     | `list_browser_targets`                                      |
| `s5-desktop-aborted` | `r02-observe-idle-after-abort.json` | `ev_20da5d79`     | `observe_web_session`; the driver batch did not run in it   |
| `s6-desktop-fresh`   | `r01-targets.json`                  | `ev_e046d91c`     | `list_browser_targets`                                      |
| `s6-desktop-fresh`   | `r02-observe-during-02.json`        | `ev_58bb47ed`     | `observe_web_session`, 40 s, covering scenario 02           |
| `s6-desktop-fresh`   | `r03-screenshot-unpaired.json`      | `ev_650ac393`     | `capture_web_screenshot`; its Playwright half did not run   |
| `s6-desktop-fresh`   | `r04-screenshot-02-shapes.json`     | `ev_543d870c`     | `capture_web_screenshot`, paired with `rea-pair-02-shapes`  |
| `s6-desktop-fresh`   | `r05-inspect-during-13.json`        | `ev_13a4756f`     | `inspect_web_page`, 25 s, covering scenario 13              |
| `s7-mobile-fresh`    | `r01-targets.json`                  | `ev_b80d011f`     | `list_browser_targets`                                      |
| `s7-mobile-fresh`    | `r02-observe-during-10.json`        | `ev_73a3c3b4`     | `observe_web_session`, 40 s, covering scenario 10           |
| `s7-mobile-fresh`    | `r03-screenshot-mobile.json`        | `ev_0a8e2815`     | `capture_web_screenshot`, beside `m10-dark-for-rea`         |

The three CLI screenshot records were checked against their own SHA-256 digests and byte counts
(`rea-extract.mjs`). They could not be exported as a bundle, because bundle export exists only
as the MCP `export_evidence_bundle` tool.

## 1. Established directly by REA [O]

- **Target listing.** One page target on the loopback endpoint. `about:blank` is not listed
  (unsupported URL) and 5 or 6 non-page targets are excluded.
- **Page inspection of the initial load** (`ev_e87d6771`). It covers only the initial empty page
  (35 named controls). Secondary surfaces and the mobile shell come from driver ARIA snapshots,
  not from REA. It established:
  - the accessibility tree (199 nodes) with toolbar names and shortcut descriptions;
  - the DOM size (385 nodes);
  - the storage key inventory with values redacted;
  - 9 scripts with module flags and sizes.
- **Storage inventory while drawing** (`ev_13a4756f`, s6). The localStorage keys matched s1. The
  IndexedDB names also include `workbox-expiration`, which the s1 inventory did not list.
- **Activity while the driver drew on the canvas:**
  - `ev_58bb47ed`: the desktop window covered scenario 02's page load and the drawing of
    8 element types.
  - `ev_73a3c3b4`: the mobile window covered the touch drawing, pinch and pan of scenario 10.
  - `ev_13a4756f`: the inspection window covered three shape drags and the save-timing probes of
    scenario 13.
  - Between them they recorded one navigation commit (02's own load) with its lifecycle events,
    one late `firstimagepaint`, and no navigation, failure, network request, WebSocket or
    console event caused by drawing.
- **Load lifecycle** (`ev_58bb47ed`, s6, warm service worker). Relative to navigation init:
  DOMContentLoaded about 0.31 s, load 0.38 s, first contentful paint 0.59 s, network idle 0.67 s,
  first image paint 3.4 s, and REA's "interactive time" 9.97 s. Measured once [O, medium]. The
  s1 lifecycle numbers came from lost Evidence and are no longer cited.
- **Viewport screenshots:**
  - `ev_8da6254e`: desktop light, initial;
  - `ev_32e75e1c`: desktop dark, idle;
  - `ev_543d870c`: desktop light, with the drawn scene;
  - `ev_0a8e2815`: mobile dark at DPR 3.
- **Shipped scripts.** `ev_d7cf0a58` and `ev_8624abb1` captured the 9 scripts with digests and
  exported them outside Git. Source-map URLs were recorded as declarations and were never
  fetched: 0 `.map` requests appear in any netlog.
- **Bundle analysis.** It was partial: the 1.9 MB main chunk hit the 30 s per-script deadline.
  Its Evidence is lost (see above), so only the static identifier counts in
  `evidence/static-api-surface.json`, which were produced from the exported scripts, remain.

## 2. Cross-driver screenshot comparison

| State                                | REA PNG  | Driver PNG | Result                                                            |
| ------------------------------------ | -------- | ---------- | ----------------------------------------------------------------- |
| Desktop light, initial (s1)          | 1280×720 | 1280×720   | byte-identical, `896394c9e875`                                    |
| Desktop dark, idle (s1)              | 1280×720 | 1280×720   | byte-identical, `f038f64dab0d`                                    |
| Desktop light, drawn scene (s6)      | 1280×720 | 1280×720   | byte-identical, `e11763dedc34`                                    |
| Mobile dark at a verified DPR 3 (s7) | 390×844  | 1170×2532  | not comparable: REA captures CSS pixels, the driver device pixels |

- **Limits of the identity.** Byte identity shows that both tools read the same CDP capture path;
  it is not independent corroboration of the rendering.
- **The earlier mobile pair** (s3, `e50d8838bab7`, 390×844) was byte-identical only because the
  page's DPR had silently dropped to 1 (see [limitations](limitations.md)). It is not evidence of
  DPR 3 rendering.

## 3. Needed the external driver (REA lacks the primitive) [O]

- **Pointer:** canvas drags, modifier clicks, right-click, wheel and Ctrl/Shift+wheel.
- **Keyboard:** chords and key down/up, for example Space+drag.
- **Touch:** single- and multi-touch through `Input.dispatchTouchEvent`.
- **Viewport emulation:** device metrics, touch and user agent, applied once per session and then
  asserted.
- **File drop:** a self-generated PNG; native-dialog handling.
- **Reads of session-created state:**
  - scene geometry, appState fields, clipboard shape and URL fragment shape;
  - layout metrics (CSS viewport, DPR, screen, touch points, canvas backing store).

  REA's storage inventory redacts values by design.

- **Inventory of secondary surfaces:** ARIA snapshots of menus, dialogs, panels and sidebars.

## 4. Needed engineering inference

- Mapping storage fields to behaviours (bindings, groups, z-order).
- Interpreting WebSocket frame counts and sizes, and the Firebase traffic (see the
  [network hypotheses](network-analysis.md#4-backend-hypotheses-not-verified)).
- Explaining the missing download and chooser events with bundle identifier counts.

## 5. REA limitations met

1. Network capture starts at attach (`attach_limited`). Page-load request metadata came from the
   driver netlog.
2. Third-party origins are policy-filtered unless listed explicitly.
3. Large results (84–91 KB; 2 MB with script sources) exceed the client's inline limit and were
   saved to files.
4. The MCP server restarted twice during s1. Evidence held only in memory from the first
   connection was lost.
5. `analyze_web_bundle` timed out on the main chunk at the default 30 s.
6. The environment block reports the browser's own user agent, not the emulated one, and the
   platform and architecture as unknown.
7. `list_browser_targets` keeps URL fragments, so REA must not run while a collaboration room is
   open; REA records from s1 retained the room key that way.
8. Without the MCP server, records cannot be assembled into a validated bundle.
9. `capture_browser_scenario` (REA-driven locator flows) was not used.
