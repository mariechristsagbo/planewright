import { useCallback, useRef } from 'react';
import type { ReactNode, Ref, RefObject } from 'react';

import { useSaveRecovery } from '../a11y/save-recovery.ts';
import { CanvasHost } from '../editor/CanvasHost.tsx';
import { EditorProvider } from '../editor/EditorProvider.tsx';
import { useViewValue } from '../editor/surface.ts';
import type { EditorSurface } from '../editor/surface.ts';
import { HistoryControls } from '../ui/HistoryControls.tsx';
import { StorageNotices, StorageProblemChip } from '../ui/Saving.tsx';
import { saveStateOf } from '../ui/save-problem.ts';
import { useNoticesControls } from '../ui/use-notices.ts';
import { Toolbar } from '../ui/Toolbar.tsx';
import { ViewReadout } from '../ui/ViewReadout.tsx';
import { ZoomControls } from '../ui/ZoomControls.tsx';
import { ElementsDrawer } from './ElementsDrawer.tsx';
import { ElementsToggle } from './ElementsToggle.tsx';
import { EmptyCanvasNote } from './EmptyCanvasNote.tsx';
import { IdentityIsland } from './IdentityIsland.tsx';
import { DoneBar } from './DoneBar.tsx';
import { ShortcutsButton } from './ShortcutsButton.tsx';
import { AboutDialog } from './dialogs/AboutDialog.tsx';
import { ShortcutsDialog } from './dialogs/ShortcutsDialog.tsx';
import { matchesSheet, useSheet } from './sheet.ts';
import type { DetailsControls } from './selection/SelectionBar.tsx';
import { SelectionPanel } from './selection/SelectionPanel.tsx';
import { useShellState } from './shell-state.ts';
import type { DialogOpener, Openers, ShellControls, ShellDialog } from './shell-state.ts';
import { useTextSession } from './text-session.ts';
import { ToolHint } from './ToolHint.tsx';
import { Tooltip } from './tooltip/Tooltip.tsx';

// The editor's shell (ADR 0012, decision 13): the canvas fills the window, and the controls float
// over it in islands at its edges, siblings of the canvas host and never inside it, so that no
// press on them reaches the canvas (REQ-C11). The document order is the tab order of decision
// 14: the menu, Pre-release, the tool bar's one stop, the canvas, the selection panel's actions
// while something is selected, the storage notices' buttons while they show, or the problem
// chip's button once they are hidden, Elements and, while its drawer is open, the drawer's Close,
// its keys and the list, then Undo, Redo, the zoom controls and Keyboard shortcuts. The drawer's
// opening and closing move the focus, to its list box and back to the toggle. The active tool's
// hint line follows the tool bar, plain text with no tab stop, absent while a text is edited and
// hidden on phones (the v0.2 plan's S10). On a phone in portrait the tool bar is the dock at the
// window's bottom, its stop still third, with More last, whose items join the order while it is
// open; the bottom-right island is not shown, so the menu button takes Keyboard shortcuts' focus
// when a window turns, and its dialog's when that closes; the open drawer is a sheet, the selection
// bar takes the panel's place with its Details sheet right after it, one sheet is open at a time,
// and the dock and the bottom islands are inert while either is. While a phone in portrait edits a
// text, the dock and history and zoom are hidden, out of the tab order yet mounted, and no Elements
// sheet is open: the text area comes right after the canvas, then the Done bar's Done, then
// Elements (the v0.2 plan's S9). Where each island sits is the style sheets' (styles/shell.css).
// The controls' tooltips are delegated to the root.

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

/**
 * The tool bar's island: the palette or, on a phone in portrait, the dock with More (the v0.2 plan's
 * S8), whose open popover raises the island over the bottom islands through a class, so that no
 * style sheet needs :has(). It is hidden, yet mounted, while a phone in portrait edits a text (S9).
 */
function ToolsIsland({
  shell,
  sheet,
  covered,
  hidden,
}: {
  readonly shell: ShellControls;
  readonly sheet: boolean;
  readonly covered: boolean;
  readonly hidden: boolean;
}) {
  const more = sheet
    ? { open: shell.more, onToggle: shell.toggleMore, onClose: shell.closeMore }
    : undefined;
  return (
    <div
      className={`island tools-island${more?.open === true ? ' more-tools-open' : ''}`}
      data-island="tools"
      hidden={hidden}
    >
      <IslandControls covered={covered}>
        <Toolbar more={more} />
      </IslandControls>
    </div>
  );
}

/**
 * History and zoom at the bottom left, hidden while a phone in portrait edits a text (the v0.2
 * plan's S9), and the view and Keyboard shortcuts at the bottom right, whose focus onKeysHidden
 * takes when a window that turns to portrait hides it.
 */
function BottomIslands({
  covered,
  hidden,
  keys,
  onShortcuts,
  onKeysHidden,
}: {
  readonly covered: boolean;
  readonly hidden: boolean;
  readonly keys: RefObject<HTMLButtonElement | null>;
  readonly onShortcuts: () => void;
  readonly onKeysHidden: () => void;
}) {
  return (
    <div className="shell-bottom">
      <div className="island bottom-left-island" data-island="bottom-left" hidden={hidden}>
        <IslandControls covered={covered}>
          <HistoryControls />
          <ZoomControls />
        </IslandControls>
      </div>
      <div className="island bottom-right-island" data-island="bottom-right">
        <IslandControls covered={covered}>
          <ViewReadout />
          <ShortcutsButton ref={keys} onOpen={onShortcuts} onHidden={onKeysHidden} />
        </IslandControls>
      </div>
    </div>
  );
}

/**
 * The shell's root, the page's main landmark, with the save state for the tests (ADR 0012, decision
 * 12): it reads view.save alone, which keeps its identity across camera changes, so a pan step
 * renders it not at all, and a new status renders it without the islands it is given.
 */
function ShellRoot({
  root,
  children,
}: {
  readonly root: Ref<HTMLElement>;
  readonly children: ReactNode;
}) {
  const save = useViewValue((view) => view.save);
  return (
    <main ref={root} className="editor-shell" data-save-state={saveStateOf(save)}>
      {children}
    </main>
  );
}

/**
 * Gives the focus back to the control that opened the closed dialog, or, for Keyboard shortcuts
 * while a phone in portrait does not show it, to the menu button, whose menu holds it too (the v0.2
 * plan's S8), never to the body (REQ-Y02).
 */
function returnFocus(openers: Openers, opener: DialogOpener | null): void {
  if (opener === null) return;
  openers[opener === 'keys' && matchesSheet() ? 'menu' : opener].current?.focus();
}

/** What the selection's phone bar is given of the shell's state: its Details sheet's (S6). */
const detailsControls = (shell: ShellControls): DetailsControls => ({
  details: shell.details,
  drawer: shell.drawer,
  onToggleDetails: shell.toggleDetails,
  onCloseDetails: shell.closeDetails,
});

/**
 * The shell: its root, the islands in their tab order, the open dialog, which gives the focus back
 * to the control that opened it, and the one tooltip, which follows the root's events. It says once
 * when a failed save succeeds again.
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
  const toMenu = useCallback(() => {
    menu.current?.focus();
  }, []);
  const root = useRef<HTMLElement>(null);
  useSaveRecovery();
  const notices = useNoticesControls(shell);
  const sheet = useSheet();
  // A phone's sheet, the Elements or the Details sheet, covers the bottom islands and the dock.
  const covered = sheet && (drawer || details);
  // While a phone in portrait edits a text, the dock and history and zoom are hidden and the Done
  // bar shows (S9).
  const session = useTextSession(shell, toggle, sheet);
  return (
    <ShellRoot root={root}>
      <h1 className="visually-hidden">Planewright</h1>
      <IdentityIsland shell={shell} menuButton={menu} tag={tag} />
      <ToolsIsland shell={shell} sheet={sheet} covered={covered} hidden={session} />
      <ToolHint />
      <CanvasHost />
      {session ? <DoneBar /> : null}
      <EmptyCanvasNote />
      <SelectionPanel sheet={sheet} controls={detailsControls(shell)} />
      <StorageNotices controls={notices} />
      <div className="island top-right-island" data-island="top-right">
        <StorageProblemChip controls={notices} />
        <ElementsToggle ref={toggle} open={drawer} onToggle={toggleDrawer} />
      </div>
      <ElementsDrawer open={drawer} sheet={sheet} onClose={closeDrawer} />
      <BottomIslands
        covered={covered}
        hidden={session}
        keys={keys}
        onShortcuts={() => {
          openDialog('shortcuts', 'keys');
        }}
        onKeysHidden={toMenu}
      />
      <OpenDialog
        dialog={dialog}
        onClose={() => {
          closeDialog();
          returnFocus(openers, opener);
        }}
      />
      <Tooltip root={root} />
    </ShellRoot>
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
