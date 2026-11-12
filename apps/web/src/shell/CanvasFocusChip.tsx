/**
 * The canvas's focus ring and its "Canvas focused" chip (ADR 0012, decision 3; the v0.2 plan's
 * S10): an element of their own after the canvas host, since the host's outline would lie under
 * its opaque canvases. styles/canvas-chrome.css shows them from CSS alone while the host matches
 * :focus-visible, and responsive.css hides the chip on phones. They are hidden from assistive
 * technology, since the region's name already says what has the focus, and take no press or
 * focus. The component is static: the shell builds its element once.
 */
export function CanvasFocusChip() {
  return (
    <div className="canvas-focus-ring" aria-hidden="true">
      <p className="canvas-focus-chip">Canvas focused</p>
    </div>
  );
}
