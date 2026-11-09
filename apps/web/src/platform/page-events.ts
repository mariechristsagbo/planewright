import type { Editor } from '@planewright/engine';

// What the page tells the editor about saving and fonts: a page that is hidden or unloaded saves
// at once (REQ-P01), and a font that finishes loading has the texts measured again (ADR 0011).

/** The parts of the page whose events matter. */
export interface PageEvents {
  readonly window: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  readonly document: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & {
    readonly visibilityState: DocumentVisibilityState;
  };
  readonly fonts: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
}

/** Listens until the returned function is called. */
export function watchPage(page: PageEvents, editor: Pick<Editor, 'saveNow' | 'measureTexts'>) {
  const hidden = (): void => {
    if (page.document.visibilityState === 'hidden') editor.saveNow();
  };
  const leaving = (): void => {
    editor.saveNow();
  };
  const loaded = (): void => {
    editor.measureTexts();
  };
  page.document.addEventListener('visibilitychange', hidden);
  page.window.addEventListener('pagehide', leaving);
  page.fonts.addEventListener('loadingdone', loaded);
  return (): void => {
    page.document.removeEventListener('visibilitychange', hidden);
    page.window.removeEventListener('pagehide', leaving);
    page.fonts.removeEventListener('loadingdone', loaded);
  };
}
