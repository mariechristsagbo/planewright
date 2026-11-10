import type { Editor } from '@planewright/engine';
import { FONT_STACKS } from '@planewright/render-canvas';

// What the page tells the editor about saving and fonts: a page that is hidden or unloaded saves
// at once (REQ-P01), and a font that finishes loading has the texts measured again (ADR 0011),
// unless it loaded only faces that canvas text never uses, such as the chrome's (ADR 0012).

const unquoted = (family: string): string => family.trim().replaceAll(/^["']|["']$/gu, '');

/** The families of canvas text: the first of each of the renderer's stacks (ADR 0011). */
const CANVAS_FAMILIES: ReadonlySet<string> = new Set(
  Object.values(FONT_STACKS).map((stack) => unquoted(stack.split(',')[0] ?? '')),
);

/** Whether a finished load can change canvas text: it names a canvas family's face, or no list. */
function loadsCanvasText(event: Event): boolean {
  const { fontfaces } = event as Partial<FontFaceSetLoadEvent>;
  return (
    fontfaces === undefined || fontfaces.some(({ family }) => CANVAS_FAMILIES.has(unquoted(family)))
  );
}

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
  const loaded = (event: Event): void => {
    if (loadsCanvasText(event)) editor.measureTexts();
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
