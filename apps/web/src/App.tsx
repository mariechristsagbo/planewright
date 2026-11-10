import { useRef, useState } from 'react';

import { CanvasHost } from './editor/CanvasHost.tsx';
import { EditorProvider } from './editor/EditorProvider.tsx';
import type { EditorSurface } from './editor/surface.ts';
import { ElementsDrawer } from './shell/ElementsDrawer.tsx';
import { ElementsToggle } from './shell/ElementsToggle.tsx';
import { PrereleaseTag } from './shell/PrereleaseTag.tsx';
import { AboutDialog } from './shell/dialogs/AboutDialog.tsx';
import { HistoryControls } from './ui/HistoryControls.tsx';
import { SaveStatus, StorageNotices } from './ui/Saving.tsx';
import { Toolbar } from './ui/Toolbar.tsx';
import { ViewReadout } from './ui/ViewReadout.tsx';
import { ZoomControls } from './ui/ZoomControls.tsx';

/** The page: the editor surface, with what this build does and does not do in About this build. */
export function App({ surface }: { readonly surface: EditorSurface }) {
  const [about, setAbout] = useState(false);
  const [elements, setElements] = useState(false);
  const tag = useRef<HTMLButtonElement>(null);
  return (
    <div className="page">
      <header className="page-header">
        <h1>Planewright</h1>
        <PrereleaseTag
          ref={tag}
          onOpen={() => {
            setAbout(true);
          }}
        />
      </header>
      <main>
        <EditorProvider surface={surface}>
          <div className="workspace">
            <Toolbar />
            <CanvasHost />
            <ElementsToggle
              open={elements}
              onToggle={() => {
                setElements(!elements);
              }}
            />
            <ElementsDrawer open={elements} />
            <div className="workspace-footer">
              <HistoryControls />
              <ZoomControls />
              <ViewReadout />
              <SaveStatus />
            </div>
            <StorageNotices />
          </div>
        </EditorProvider>
      </main>
      {about ? (
        <AboutDialog
          onClose={() => {
            setAbout(false);
            tag.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}
