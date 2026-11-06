# ADR 0008: Input pipeline, tool state machines and one command registry

- Status: Accepted
- Date: 2026-11-06

## Context

The same editor must work with a mouse, a pen, a trackpad and touch (B-36, B-40, B-43 to B-45).
Camera gestures must work in every tool (REQ-V06, REQ-V07), a second finger must never draw or
select, and tool behaviour must be testable as sequences of events without a browser. The baseline
also shows shortcuts listed inconsistently between the help and the command palette
([feature inventory](../reverse-engineering/feature-inventory.md), R-22), which a single source of
commands avoids.

## Decision

1. **Pointer Events only.** The canvas host listens to pointer, wheel and keyboard events, sets
   `touch-action: none`, captures the pointer during a gesture and reads coalesced events for
   freehand strokes. Wheel deltas are normalised to pixels.
2. **Engine input events.** The web app's input adapter turns each DOM event into an engine input
   event in canvas-relative screen coordinates, with the pointer type, buttons, modifiers
   (including the platform's Mod key, REQ-V05), pressure and a timestamp.
3. **Gesture recognition in the engine.** A recogniser classifies taps, drags, long presses and
   two-pointer gestures, with thresholds in screen pixels that depend on the pointer type.
4. **Camera gestures bypass tools.** Wheel, Mod+wheel, pinch, two-finger pan, Space+drag and a
   middle-button drag go to the viewport controller whatever the tool. A second touch pointer
   cancels the current tool gesture and starts a two-pointer gesture (REQ-V07).
5. **Tools are reducers.** Each tool is a pure function from its state, an input event and a
   read-only context to its next state and a list of effects: preview a change, commit, cancel,
   set the selection, switch tool, set the cursor or begin text editing. The editor applies the
   effects.
6. **One command registry.** Every command has an identifier, a label key, its shortcuts, an
   enabled rule and a run function. The keymap, toolbar, menus, palette, help and accessible
   descriptions read the same registry (REQ-C14).
7. **Keyboard rules.** Shortcuts pause while a text field has focus. Letter shortcuts match the
   produced character, falling back to the physical key for layouts without Latin letters. Digit
   shortcuts match the physical key, so they work where digits need Shift, and the zoom shortcuts
   accept `=` or `+` and `-` or `_` on any layout.

## Alternatives considered

- **Separate mouse and touch handlers.** Rejected: duplicated logic and divergent behaviour.
- **Tools as classes holding DOM listeners.** Rejected: hard to test and to cancel cleanly.
- **A statechart library.** Rejected: a dependency for what typed reducers already express.

## Consequences

- Tool tests are scripts of input events with expected states and effects.
- Device-specific behaviour lives in the recogniser's thresholds, not in each tool.
- Requirements served: REQ-C11, REQ-C14, REQ-S14, REQ-V01 and REQ-V04 to REQ-V07.
