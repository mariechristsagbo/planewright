import { useReducer } from 'react';

// The shell's own state (ADR 0012, decision 13): which surfaces are open. It lives in the shell
// alone and never reaches the engine, the history, the document or storage, so every load starts
// with the drawer and the dialogs closed (D4).

export type ShellDialog = 'about' | 'shortcuts' | null;

/** The control that opened the dialog, which the focus goes back to when it closes (REQ-Y02). */
export type DialogOpener = 'tag' | 'keys';

export interface ShellState {
  readonly drawer: boolean;
  readonly dialog: ShellDialog;
  readonly opener: DialogOpener | null;
}

export type ShellAction =
  | { readonly type: 'toggle-drawer' }
  | {
      readonly type: 'open-dialog';
      readonly dialog: Exclude<ShellDialog, null>;
      readonly opener: DialogOpener;
    }
  | { readonly type: 'close-dialog' };

export const INITIAL_SHELL_STATE: ShellState = { drawer: false, dialog: null, opener: null };

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'toggle-drawer':
      return { ...state, drawer: !state.drawer };
    case 'open-dialog':
      return { ...state, dialog: action.dialog, opener: action.opener };
    case 'close-dialog':
      return { ...state, dialog: null, opener: null };
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
    openDialog: (dialog: Exclude<ShellDialog, null>, opener: DialogOpener) => {
      dispatch({ type: 'open-dialog', dialog, opener });
    },
    closeDialog: () => {
      dispatch({ type: 'close-dialog' });
    },
  };
}
