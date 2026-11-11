import { useReducer } from 'react';
import type { RefObject } from 'react';

// The shell's own state (ADR 0012, decision 13): which surfaces are open. It lives in the shell
// alone and never reaches the engine, the history, the document or storage, so every load starts
// with the menu, the drawer and the dialogs closed (D4).

export type ShellDialog = 'about' | 'shortcuts' | null;

/** The control that opened the dialog, which the focus goes back to when it closes (REQ-Y02). */
export type DialogOpener = 'menu' | 'tag' | 'keys';

/** The controls that open dialogs, by name, for the focus to go back to. */
export type Openers = Readonly<Record<DialogOpener, RefObject<HTMLButtonElement | null>>>;

export interface ShellState {
  readonly menu: boolean;
  readonly drawer: boolean;
  readonly dialog: ShellDialog;
  readonly opener: DialogOpener | null;
}

export type ShellAction =
  | { readonly type: 'open-menu' }
  | { readonly type: 'close-menu' }
  | { readonly type: 'toggle-drawer' }
  | {
      readonly type: 'open-dialog';
      readonly dialog: Exclude<ShellDialog, null>;
      readonly opener: DialogOpener;
    }
  | { readonly type: 'close-dialog' };

export const INITIAL_SHELL_STATE: ShellState = {
  menu: false,
  drawer: false,
  dialog: null,
  opener: null,
};

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'open-menu':
      return { ...state, menu: true };
    case 'close-menu':
      return { ...state, menu: false };
    case 'toggle-drawer':
      return { ...state, drawer: !state.drawer };
    case 'open-dialog':
      // A dialog opened from the menu takes the focus, so the menu closes with it.
      return { ...state, menu: false, dialog: action.dialog, opener: action.opener };
    case 'close-dialog':
      return { ...state, dialog: null, opener: null };
  }
}

/** The shell's state, closed at first, and the ways to change it. */
export function useShellState() {
  const [state, dispatch] = useReducer(shellReducer, INITIAL_SHELL_STATE);
  return {
    ...state,
    openMenu: () => {
      dispatch({ type: 'open-menu' });
    },
    closeMenu: () => {
      dispatch({ type: 'close-menu' });
    },
    toggleDrawer: () => {
      dispatch({ type: 'toggle-drawer' });
    },
    openDialog: (dialog: Exclude<ShellDialog, null>, opener: DialogOpener) => {
      dispatch({ type: 'open-dialog', dialog, opener });
    },
    closeDialog: () => {
      dispatch({ type: 'close-dialog' });
    },
  };
}

/** What the islands are given of the shell's state. */
export type ShellControls = ReturnType<typeof useShellState>;
