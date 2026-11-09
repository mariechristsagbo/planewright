import { PROTOCOL_VERSION } from '@planewright/protocol';

import { CanvasHost } from './editor/CanvasHost.tsx';
import { EditorProvider } from './editor/EditorProvider.tsx';
import type { EditorSurface } from './editor/surface.ts';
import { BUILD_STATUS, FOUNDATION_CONTENTS, NOT_YET_IMPLEMENTED } from './foundation.ts';
import { HistoryControls } from './ui/HistoryControls.tsx';
import { SaveStatus, StorageNotices } from './ui/Saving.tsx';
import { Toolbar } from './ui/Toolbar.tsx';
import { ViewReadout } from './ui/ViewReadout.tsx';

const REPOSITORY_URL = 'https://github.com/mariechristsagbo/planewright';

function NotYetImplemented() {
  return (
    <section aria-labelledby="missing-heading">
      <h2 id="missing-heading">Not implemented yet</h2>
      <ul>
        {NOT_YET_IMPLEMENTED.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <p>
        Behavioural investigation comes before feature work. Features are delivered through tracked
        GitHub issues and reviewed pull requests.
      </p>
    </section>
  );
}

function FoundationContents() {
  return (
    <section aria-labelledby="contents-heading">
      <h2 id="contents-heading">What this build contains</h2>
      <dl>
        {FOUNDATION_CONTENTS.map((item) => (
          <div key={item.name}>
            <dt>{item.name}</dt>
            <dd>{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The page: the editor surface, and what this build does and does not do. */
export function App({ surface }: { readonly surface: EditorSurface }) {
  return (
    <div className="page">
      <header className="page-header">
        <h1>Planewright</h1>
        <p className="status" role="status">
          {BUILD_STATUS}
        </p>
      </header>
      <main>
        <EditorProvider surface={surface}>
          <div className="workspace">
            <Toolbar />
            <CanvasHost />
            <div className="workspace-footer">
              <HistoryControls />
              <ViewReadout />
              <SaveStatus />
            </div>
            <StorageNotices />
          </div>
        </EditorProvider>
        <div className="notes">
          <NotYetImplemented />
          <FoundationContents />
        </div>
      </main>
      <footer>
        <p>
          Protocol version {PROTOCOL_VERSION} (pre-release). MIT licensed.{' '}
          <a href={REPOSITORY_URL}>Source on GitHub</a>.
        </p>
        <p>Planewright is an independent project and is not affiliated with Excalidraw.</p>
      </footer>
    </div>
  );
}
