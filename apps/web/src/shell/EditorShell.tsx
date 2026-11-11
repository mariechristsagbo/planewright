import { useRef } from 'react';
import type { RefObject } from 'react';

import { CanvasHost } from '../editor/CanvasHost.tsx';
import { EditorProvider } from '../editor/EditorProvider.tsx';
import type { EditorSurface } from '../editor/surface.ts';
import { HistoryControls } from '../ui/HistoryControls.tsx';
import { SaveStatus, StorageNotices } from '../ui/Saving.tsx';
import { Toolbar } from '../ui/Toolbar.tsx';
import { ViewReadout } from '../ui/ViewReadout.tsx';
import { ZoomControls } from '../ui/ZoomControls.tsx';
import { ElementsDrawer } from './ElementsDrawer.tsx';
import { ElementsToggle } from './ElementsToggle.tsx';
import { EmptyCanvasNote } from './EmptyCanvasNote.tsx';
import { IdentityIsland } from './IdentityIsland.tsx';
import { ShortcutsButton } from './ShortcutsButton.tsx';
import { AboutDialog } from './dialogs/AboutDialog.tsx';
import { ShortcutsDialog } from './dialogs/ShortcutsDialog.tsx';
import { useShellState } from './shell-state.ts';
import type { DialogOpener, ShellDialog } from './shell-state.ts';
import { Tooltip } from './tooltip/Tooltip.tsx';

// The editor's shell (ADR 0012, decision 13): the canvas fills the window, and the controls float
// over it in islands at its edges, siblings of the canvas host and never inside it, so that no
// press on them reaches the canvas (REQ-C11). The document order is the tab order of decision
// 14: Pre-release, the tool bar's one stop, the canvas, the storage notices' buttons, Elements and
// the list while its drawer is open, then Undo, Redo, the zoom controls and Keyboard shortcuts.
// Where each island sits is the style sheets' (styles/shell.css). The controls' tooltips are
// delegated to the root.

/** The open dialog, if any; closing it calls onClose. */
function OpenDialog({
  dialog,
  onClose,
}: {
  readonly dialog: ShellDialog;
  readonly onClose: () => void;
}) {
  switch (dialog) {
    case 'about':
      return <AboutDialog onClose={onClose} />;
    case 'shortcuts':
      return <ShortcutsDialog onClose={onClose} />;
    case null:
      return null;
  }
}

/**
 * The shell's root, the page's main landmark, where S7 puts data-save-state, the islands in their
 * tab order, the open dialog, which gives the focus back to the control that opened it, and the
 * one tooltip, which follows the root's events.
 */
function Shell() {
  const { drawer, dialog, opener, toggleDrawer, openDialog, closeDialog } = useShellState();
  const tag = useRef<HTMLButtonElement>(null);
  const keys = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const openers: Readonly<Record<DialogOpener, RefObject<HTMLButtonElement | null>>> = {
    tag,
    keys,
  };
  return (
    <main ref={root} className="editor-shell">
      <h1 className="visually-hidden">Planewright</h1>
      <IdentityIsland
        tag={tag}
        onAbout={() => {
          openDialog('about', 'tag');
        }}
      />
      <div className="island tools-island" data-island="tools">
        <Toolbar />
      </div>
      <CanvasHost />
      <EmptyCanvasNote />
      <StorageNotices />
      <div className="island top-right-island" data-island="top-right">
        <ElementsToggle open={drawer} onToggle={toggleDrawer} />
      </div>
      <ElementsDrawer open={drawer} />
      <div className="shell-bottom">
        <div className="island bottom-left-island" data-island="bottom-left">
          <HistoryControls />
          <ZoomControls />
        </div>
        <div className="island bottom-right-island" data-island="bottom-right">
          <ViewReadout />
          <SaveStatus />
          <ShortcutsButton
            ref={keys}
            onOpen={() => {
              openDialog('shortcuts', 'keys');
            }}
          />
        </div>
      </div>
      <OpenDialog
        dialog={dialog}
        onClose={() => {
          closeDialog();
          if (opener !== null) openers[opener].current?.focus();
        }}
      />
      <Tooltip root={root} />
    </main>
  );
}

/** The editor: one surface for every island, and the shell around the canvas. */
export function EditorShell({ surface }: { readonly surface: EditorSurface }) {
  return (
    <EditorProvider surface={surface}>
      <Shell />
    </EditorProvider>
  );
}
