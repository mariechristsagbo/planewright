import { useReducer } from 'react';

// The shell's own state (ADR 0012, decision 13): which surfaces are open. It lives in the shell
// alone and never reaches the engine, the history, the document or storage, so every load starts
// with the drawer and the dialogs closed (D4).

export type ShellDialog = 'about' | null;

export interface ShellState {
  readonly drawer: boolean;
  readonly dialog: ShellDialog;
}

export type ShellAction =
  | { readonly type: 'toggle-drawer' }
  | { readonly type: 'open-dialog'; readonly dialog: Exclude<ShellDialog, null> }
  | { readonly type: 'close-dialog' };

export const INITIAL_SHELL_STATE: ShellState = { drawer: false, dialog: null };

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'toggle-drawer':
      return { ...state, drawer: !state.drawer };
    case 'open-dialog':
      return { ...state, dialog: action.dialog };
    case 'close-dialog':
      return { ...state, dialog: null };
  }
}

/** The shell's state, closed at first, and the ways to change it. */
export function useShellState() {
  const [state, dispatch] = useReducer(shellReducer, INITIAL_SHELL_STATE);
  return {
    ...state,
    toggleDrawer: () => {
      dispatch({ type: 'toggle-drawer' });
    },
    openAbout: () => {
      dispatch({ type: 'open-dialog', dialog: 'about' });
    },
    closeDialog: () => {
      dispatch({ type: 'close-dialog' });
    },
  };
}
