// Where the focus goes back to (docs/architecture/engine/quality.md#accessibility, REQ-Y02): the
// canvas, which opens the text area and which a notice's answer returns to, so that the focus never
// falls to the page's body and the shortcuts work again at once.

/** The canvas host's identifier. */
export const CANVAS_ID = 'drawing-canvas';

/** Gives the focus to the canvas, without scrolling the page. */
export function focusCanvas(document: Pick<Document, 'getElementById'>): void {
  document.getElementById(CANVAS_ID)?.focus({ preventScroll: true });
}
