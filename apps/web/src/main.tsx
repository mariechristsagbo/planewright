import { createEditor } from '@planewright/engine';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { announceStorageNotice, webAnnouncer } from './a11y/announcements.ts';
import { createLiveRegion } from './a11y/live-region.ts';
import { canvasRenderer } from './editor/renderer.ts';
import { loadFonts } from './platform/fonts.ts';
import { frameTimingOf } from './platform/frame-timing.ts';
import { watchPage } from './platform/page-events.ts';
import { platformOf } from './platform/platform.ts';
import { localStorageOf, readPreferences } from './platform/preferences.ts';
import { browserPorts } from './platform/ports.ts';
import { indexedDbOf, openStorage } from './platform/storage.ts';
import { pageTextMeasurer } from './platform/text-measurer.ts';
import { EditorShell } from './shell/EditorShell.tsx';
// The style sheets in cascade order: the tokens, the fonts, the base, the controls' shared rules,
// then the shell's layout, its islands and what they hold, the glyph buttons, the phone's dock and
// More, the text-editing chrome, the chrome over the canvas, the Elements toggle and drawer, the
// selection panel, the menu and the tooltip (ADR 0012, decision 5).
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/page.css';
import './styles/canvas.css';
import './styles/element-list.css';
import './styles/saving.css';
import './styles/shell.css';
import './styles/islands.css';
import './styles/palette.css';
import './styles/dock.css';
import './styles/text-session.css';
import './styles/canvas-chrome.css';
import './styles/drawer.css';
import './styles/selection.css';
import './styles/menu.css';
import './styles/tooltip.css';
import './styles/dialog.css';
import responsive from './styles/responsive.css?inline';

// The layout's media queries, last in the cascade and in a style sheet apart from the fonts', so
// that a breakpoint never makes the canvas's faces load again (styles/responsive.css).
const media = document.createElement('style');
media.textContent = responsive;
document.head.append(media);

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Planewright expected a #root element in index.html.');
}

// The preferences entry is read before anything is drawn, so that the first frame has its theme.
document.documentElement.dataset['theme'] = readPreferences(localStorageOf(window)).theme;

// The live region is in the page before anything is said in it (REQ-Y04).
const ports = browserPorts(window, pageTextMeasurer(document));
const live = createLiveRegion(document, ports.scheduler);

// The first text is measured in its bundled font (ADR 0011); a font that fails leaves its fallback.
await loadFonts(document.fonts);

// The latest drawing saved in this browser, if storage opens and holds a valid one (ADR 0009).
const storage = await openStorage(indexedDbOf(window), () => Date.now());
const repository = storage.repository === undefined ? {} : { repository: storage.repository };
const editor = createEditor(
  { ...ports, ...repository, announcer: webAnnouncer(live) },
  storage.stored,
);
watchPage({ window, document, fonts: document.fonts }, editor);

// The editor lives as long as the page, so components that mount again find the same one.
const surface = {
  editor,
  platform: platformOf(navigator),
  createRenderer: canvasRenderer(document, frameTimingOf(window)),
  storageNotice: storage.notice,
  live,
};

createRoot(container).render(
  <StrictMode>
    <EditorShell surface={surface} />
  </StrictMode>,
);
announceStorageNotice(live, storage.notice);
