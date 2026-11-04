# REA findings: what REA established and what needed other tools

REA 6.8.0 (build `5b953e13…`), project-local MCP server. Raw Evidence and the exported bundles
are stored outside the repository: `bundle-01-desktop.json` (3 records) and
`bundle-02-collab-mobile.json` (7 records), each with 0 recorded unknowns. Evidence IDs are listed
in `evidence/sessions.json`.

## 1. Established directly by REA [O]

| Operation                                           | Evidence (prefix)                                                   | What it established                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_browser_targets`                              | `ev_70180ae1`                                                       | One page target on the loopback endpoint; 6 non-page targets excluded.                                                                                                                                                                             |
| `inspect_web_page`                                  | `ev_e87d6771`                                                       | Accessibility tree (199 nodes) including every toolbar name and shortcut description; DOM size (385 nodes); storage key inventory with values redacted (localStorage, IndexedDB names, cache names, quota); 9 scripts with module flags and sizes. |
| `observe_web_session`                               | (lost with the MCP restart; facts recorded in the network analysis) | Navigation lifecycle on reload: DOMContentLoaded, load, FCP, network idle.                                                                                                                                                                         |
| `capture_web_screenshot`                            | `ev_8da6254e`, `ev_32e75e1c`, `ev_28928b56`                         | Viewport PNGs: 1280×720 light, 1280×720 dark, 390×844 mobile.                                                                                                                                                                                      |
| `inspect_web_page` (scripts) + `export_web_scripts` | `ev_d7cf0a58`, `ev_8624abb1`                                        | Captured the 9 shipped scripts with digests and exported them outside Git. Source-map URLs were recorded as declarations and **not fetched**.                                                                                                      |
| `inspect_web_page` (WebSocket shapes)               | `ev_43b25e14`                                                       | The collaboration WebSocket URL and frame direction, opcode and byte sizes, with no payloads.                                                                                                                                                      |
| `analyze_web_bundle` (summary)                      | `ev_e89af49b`                                                       | 10 scripts observed; 7 endpoint candidates and inferences from the smaller scripts. **Partial:** the 1.9 MB main chunk hit the 30 s per-script deadline, so its findings are unknown.                                                              |
| `export_evidence_bundle`                            | —                                                                   | Two bundles written as above.                                                                                                                                                                                                                      |

## 2. Cross-driver screenshot identity [O, high]

REA's passive screenshot and the Playwright screenshot of the same state were **byte-identical**
in all three comparisons:

| State                                                                                            | Size     | SHA-256 (prefix) |
| ------------------------------------------------------------------------------------------------ | -------- | ---------------- |
| Desktop light, initial                                                                           | 1280×720 | `896394c9e875`   |
| Desktop dark, idle with scene                                                                    | 1280×720 | `f038f64dab0d`   |
| Mobile (390×844 touch emulation, after re-emulation; `devicePixelRatio` read 1, see limitations) | 390×844  | `e50d8838bab7`   |

The viewports were matched first: REA reports the emulated CSS viewport (390×844), not device
pixels. The smoke test found 972 differing pixels on a clicked button. That did not recur here,
because no control was hovered or focused at capture time. Because the bytes are identical, the
external Playwright PNGs also preserve the REA artefacts' bytes.

## 3. Needed the external driver (REA lacks the primitive) [O]

- **Pointer:** all canvas drags, modifier clicks, right-click, wheel and Ctrl/Shift+wheel.
- **Keyboard:** chords and key down/up, for example Space+drag.
- **Touch:** single- and multi-touch (pinch, two-finger pan) through `Input.dispatchTouchEvent`.
- **Viewport emulation:** device metrics, touch and user agent. REA has no viewport control for
  passive pages.
- **File drop:** constructed in-page with a self-generated PNG.
- **Native dialogs:** acceptance handling.
- **Reads of session-created state:** scene geometry from localStorage, appState fields,
  clipboard shape, URL fragment shape. REA's storage inventory redacts values by design.

## 4. Needed engineering inference

- Mapping storage fields to behaviours (bindings, groups, z-order).
- Interpreting WebSocket frame sizes and Firebase traffic (see the
  [network hypotheses](network-analysis.md#4-backend-hypotheses-not-verified)).
- Explaining the missing download and chooser events with bundle identifier counts.

## 5. REA limitations met in this run

1. Network capture starts at attach (`attach_limited`). Page-load traffic needed an observation
   window armed before a driver reload, and `observe_web_session` keeps only lifecycle events.
   Request-level load metadata came from the driver netlog.
2. Third-party origins are policy-filtered unless listed explicitly (for example, 9 resources were
   excluded in the first inspection).
3. Large results (inspections of 84–91 KB; 2 MB with script sources) exceed the client's inline
   limit and were saved to files. Inline screenshots consume context.
4. The MCP server restarted twice during the run. In-memory Evidence from the first connection
   was lost, apart from the results already saved to files. Bundles were exported after that.
5. `analyze_web_bundle` timed out on the main chunk at the default 30 s. A rerun with a higher
   `analysis_timeout_ms` is a residual item.
6. The environment block reports the browser's own user agent, not the emulated one, and
   platform/architecture as unknown.
7. `capture_browser_scenario` (REA-driven locator flows) was **not** used in this run: the
   external driver covered every flow on the same browser. Using it for the menu and dialog flows
   is a residual item.
