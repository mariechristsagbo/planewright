import { createEditor } from '@planewright/engine';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { canvasRenderer } from './editor/renderer.ts';
import { loadFonts } from './platform/fonts.ts';
import { watchPage } from './platform/page-events.ts';
import { platformOf } from './platform/platform.ts';
import { localStorageOf, readPreferences } from './platform/preferences.ts';
import { browserPorts } from './platform/ports.ts';
import { indexedDbOf, openStorage } from './platform/storage.ts';
import { pageTextMeasurer } from './platform/text-measurer.ts';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Planewright expected a #root element in index.html.');
}

// The preferences entry is read before anything is drawn, so that the first frame has its theme.
document.documentElement.dataset['theme'] = readPreferences(localStorageOf(window)).theme;

// The first text is measured in its bundled font (ADR 0011); a font that fails leaves its fallback.
await loadFonts(document.fonts);

// The latest drawing saved in this browser, if storage opens and holds a valid one (ADR 0009).
const storage = await openStorage(indexedDbOf(window), () => Date.now());
const ports = browserPorts(window, pageTextMeasurer(document));
const repository = storage.repository === undefined ? {} : { repository: storage.repository };
const editor = createEditor({ ...ports, ...repository }, storage.stored);
watchPage({ window, document, fonts: document.fonts }, editor);

// The editor lives as long as the page, so components that mount again find the same one.
const surface = {
  editor,
  platform: platformOf(navigator),
  createRenderer: canvasRenderer(document),
  storageNotice: storage.notice,
};

createRoot(container).render(
  <StrictMode>
    <App surface={surface} />
  </StrictMode>,
);
