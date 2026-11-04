# Limitations

## Out of scope by policy

- Anything that needs an account: Excalidraw+, sign-up, persistent cloud scenes.
- The generation features (Text to diagram, Wireframe to code, and Mermaid conversion). They may
  call external services and were not opened.
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
   No real device, no iOS Safari, no virtual keyboard and no hardware pen.
4. **One locale (en-US) and the light/dark themes.** Only the language list was inventoried;
   right-to-left layouts were not observed.
5. **Fixed coordinates.** Scenario coordinates depend on viewport and zoom. A layout change in the
   reference breaks replay (B-21 shows how a reflow redirected clicks).
6. **Single run of some interactions.** Rotation, lock, eraser, clipboard and collaboration were
   observed once, in s1 only. Scenarios 02, 03 and 05 were replayed in a fresh profile (s2) with
   identical results.

## Tooling limits

- REA is passive for coordinate input (see [REA findings](rea-findings.md#5-rea-limitations-met-in-this-run)).
- The driver's state probes read localStorage, which lags live state by a few hundred
  milliseconds. Every probe waited 700–800 ms after the action.
- Native-dialog handling through Playwright over CDP was unreliable in the collaboration stop
  flow. The page stopped answering `Runtime.evaluate` while no dialog was showing. The cause is
  unknown and it is recorded as unverified, not as reference behaviour.
- `analyze_web_bundle` did not finish the main chunk within the default deadline.

## Claims this baseline does **not** make

- That the feature inventory is exhaustive. It covers what was discovered through the menus,
  palette, help and context menu of an empty or simple scene.
- That bundle identifiers execute.
- That observed numeric thresholds (debounce, binding gap, handle offsets) are stable across
  versions. Several `index-*.js` chunks with different hashes were loaded across sessions.
  Whether that reflects lazy chunks or a deploy during the run is unknown.

All open questions are tracked in the [residual matrix](residual-matrix.md).
