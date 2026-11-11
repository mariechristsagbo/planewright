import { useRef } from 'react';
import type { ReactNode, Ref } from 'react';

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
import { useDrawerFocus } from './drawer-focus.ts';
import { useSheet } from './sheet.ts';
import { SelectionPanel } from './selection/SelectionPanel.tsx';
import { useShellState } from './shell-state.ts';
import type { Openers, ShellDialog } from './shell-state.ts';
import { Tooltip } from './tooltip/Tooltip.tsx';

// The editor's shell (ADR 0012, decision 13): the canvas fills the window, and the controls float
// over it in islands at its edges, siblings of the canvas host and never inside it, so that no
// press on them reaches the canvas (REQ-C11). The document order is the tab order of decision
// 14: the menu, Pre-release, the tool bar's one stop, the canvas, the selection panel's actions
// while something is selected, the storage notices' buttons, Elements and, while its drawer is
// open, the drawer's Close, its keys and the list, then Undo, Redo, the zoom controls and Keyboard
// shortcuts. The drawer's opening and closing move the focus, to its list box and back to the
// toggle. On a phone in portrait the open drawer is a sheet, the selection bar takes the panel's
// place with its Details sheet right after it, one sheet is open at a time, and the palette and the
// bottom islands are inert while either is.
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
 * An island's controls, inert while the phone's sheet covers them (the v0.2 plan's S5): out of the
 * tab order and the accessibility tree, and a press on them reaches their island, which takes it,
 * never the canvas. The box adds nothing to the island's layout.
 */
function IslandControls({
  covered,
  children,
}: {
  readonly covered: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className="island-controls" inert={covered}>
      {children}
    </div>
  );
}

/** History and zoom at the bottom left, and the view and Keyboard shortcuts at the bottom right. */
function BottomIslands({
  covered,
  keys,
  onShortcuts,
}: {
  readonly covered: boolean;
  readonly keys: Ref<HTMLButtonElement>;
  readonly onShortcuts: () => void;
}) {
  return (
    <div className="shell-bottom">
      <div className="island bottom-left-island" data-island="bottom-left">
        <IslandControls covered={covered}>
          <HistoryControls />
          <ZoomControls />
        </IslandControls>
      </div>
      <div className="island bottom-right-island" data-island="bottom-right">
        <IslandControls covered={covered}>
          <ViewReadout />
          <SaveStatus />
          <ShortcutsButton ref={keys} onOpen={onShortcuts} />
        </IslandControls>
      </div>
    </div>
  );
}

/**
 * The shell's root, the page's main landmark, where S7 puts data-save-state, the islands in their
 * tab order, the open dialog, which gives the focus back to the control that opened it, and the
 * one tooltip, which follows the root's events.
 */
function Shell() {
  const shell = useShellState();
  const { drawer, details, dialog, opener, toggleDrawer, closeDrawer, openDialog, closeDialog } =
    shell;
  const menu = useRef<HTMLButtonElement>(null);
  const tag = useRef<HTMLButtonElement>(null);
  const keys = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const openers: Openers = { menu, tag, keys };
  const root = useRef<HTMLElement>(null);
  useDrawerFocus(drawer, toggle, details);
  const sheet = useSheet();
  // A phone's sheet, the Elements or the Details sheet, covers the bottom islands and stands where
  // S8 puts the palette as a dock.
  const covered = sheet && (drawer || details);
  const selection = {
    details,
    drawer,
    onToggleDetails: shell.toggleDetails,
    onCloseDetails: shell.closeDetails,
  };
  return (
    <main ref={root} className="editor-shell">
      <h1 className="visually-hidden">Planewright</h1>
      <IdentityIsland shell={shell} menuButton={menu} tag={tag} />
      <div className="island tools-island" data-island="tools">
        <IslandControls covered={covered}>
          <Toolbar />
        </IslandControls>
      </div>
      <CanvasHost />
      <EmptyCanvasNote />
      <SelectionPanel sheet={sheet} controls={selection} />
      <StorageNotices />
      <div className="island top-right-island" data-island="top-right">
        <ElementsToggle ref={toggle} open={drawer} onToggle={toggleDrawer} />
      </div>
      <ElementsDrawer open={drawer} sheet={sheet} onClose={closeDrawer} />
      <BottomIslands
        covered={covered}
        keys={keys}
        onShortcuts={() => {
          openDialog('shortcuts', 'keys');
        }}
      />
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
