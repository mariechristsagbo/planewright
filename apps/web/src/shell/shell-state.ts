import { useMemo, useReducer } from 'react';
import type { ActionDispatch, RefObject } from 'react';

// The shell's own state (ADR 0012, decision 13): which surfaces are open. It lives in the shell
// alone and never reaches the engine, the history, the document or storage, so every load starts
// with the menu, the drawer, the Details sheet and the dialogs closed (D4). On a phone the
// Elements sheet and the Details sheet are never open together: opening one closes the other.

export type ShellDialog = 'about' | 'shortcuts' | null;

/** The control that opened the dialog, which the focus goes back to when it closes (REQ-Y02). */
export type DialogOpener = 'menu' | 'tag' | 'keys';

/** The controls that open dialogs, by name, for the focus to go back to. */
export type Openers = Readonly<Record<DialogOpener, RefObject<HTMLButtonElement | null>>>;

export interface ShellState {
  readonly menu: boolean;
  readonly drawer: boolean;
  /** Whether the phone's Details sheet is open (the v0.2 plan's S6). */
  readonly details: boolean;
  readonly dialog: ShellDialog;
  readonly opener: DialogOpener | null;
}

export type ShellAction =
  | { readonly type: 'open-menu' }
  | { readonly type: 'close-menu' }
  | { readonly type: 'toggle-drawer' }
  | { readonly type: 'close-drawer' }
  | { readonly type: 'open-details' }
  | { readonly type: 'toggle-details' }
  | { readonly type: 'close-details' }
  | {
      readonly type: 'open-dialog';
      readonly dialog: Exclude<ShellDialog, null>;
      readonly opener: DialogOpener;
    }
  | { readonly type: 'close-dialog' };

export const INITIAL_SHELL_STATE: ShellState = {
  menu: false,
  drawer: false,
  details: false,
  dialog: null,
  opener: null,
};

/** The actions on the drawer and the Details sheet. */
type SheetAction = Extract<
  ShellAction['type'],
  'toggle-drawer' | 'close-drawer' | 'open-details' | 'toggle-details' | 'close-details'
>;

/** The drawer and the Details sheet: opening either closes the other. */
function sheetsReducer(state: ShellState, type: SheetAction): ShellState {
  switch (type) {
    case 'toggle-drawer':
      return state.drawer
        ? { ...state, drawer: false }
        : { ...state, drawer: true, details: false };
    case 'close-drawer':
      return { ...state, drawer: false };
    case 'open-details':
      return { ...state, details: true, drawer: false };
    case 'toggle-details':
      return state.details
        ? { ...state, details: false }
        : { ...state, details: true, drawer: false };
    case 'close-details':
      return { ...state, details: false };
  }
}

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'open-menu':
      return { ...state, menu: true };
    case 'close-menu':
      return { ...state, menu: false };
    case 'toggle-drawer':
    case 'close-drawer':
    case 'open-details':
    case 'toggle-details':
    case 'close-details':
      return sheetsReducer(state, action.type);
    case 'open-dialog':
      // A dialog opened from the menu takes the focus, so the menu closes with it.
      return { ...state, menu: false, dialog: action.dialog, opener: action.opener };
    case 'close-dialog':
      return { ...state, dialog: null, opener: null };
  }
}

/** The ways to change the shell's state, which keep their identity for the shell's life. */
function actionsOf(dispatch: ActionDispatch<[ShellAction]>) {
  return {
    openMenu: () => {
      dispatch({ type: 'open-menu' });
    },
    closeMenu: () => {
      dispatch({ type: 'close-menu' });
    },
    toggleDrawer: () => {
      dispatch({ type: 'toggle-drawer' });
    },
    closeDrawer: () => {
      dispatch({ type: 'close-drawer' });
    },
    openDetails: () => {
      dispatch({ type: 'open-details' });
    },
    toggleDetails: () => {
      dispatch({ type: 'toggle-details' });
    },
    closeDetails: () => {
      dispatch({ type: 'close-details' });
    },
    openDialog: (dialog: Exclude<ShellDialog, null>, opener: DialogOpener) => {
      dispatch({ type: 'open-dialog', dialog, opener });
    },
    closeDialog: () => {
      dispatch({ type: 'close-dialog' });
    },
  };
}

/** The shell's state, closed at first, and the ways to change it. */
export function useShellState() {
  const [state, dispatch] = useReducer(shellReducer, INITIAL_SHELL_STATE);
  const actions = useMemo(() => actionsOf(dispatch), []);
  return { ...state, ...actions };
}

/** What the islands are given of the shell's state. */
export type ShellControls = ReturnType<typeof useShellState>;
