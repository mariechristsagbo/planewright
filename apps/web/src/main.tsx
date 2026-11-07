import { createEditor } from '@planewright/engine';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { canvasRenderer } from './editor/renderer.ts';
import { platformOf } from './platform/platform.ts';
import { browserPorts } from './platform/ports.ts';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Planewright expected a #root element in index.html.');
}

// The editor lives as long as the page, so components that mount again find the same one.
const surface = {
  editor: createEditor(browserPorts(window)),
  platform: platformOf(navigator),
  createRenderer: canvasRenderer(document),
};

createRoot(container).render(
  <StrictMode>
    <App surface={surface} />
  </StrictMode>,
);
