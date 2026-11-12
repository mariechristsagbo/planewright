import type { SaveStatus } from '@planewright/engine';
import { useMemo, useReducer } from 'react';
import type { ActionDispatch, RefObject } from 'react';

// The shell's own state (ADR 0012, decision 13): which surfaces are open, and whether the storage
// notices are hidden. It lives in the shell alone and never reaches the engine, the history, the
// document or storage, so every load starts with the menu, the drawer, the Details sheet, More and
// the dialogs closed (D4) and the notices shown (D7). On a phone the Elements sheet and the Details
// sheet are never open together: opening one closes the other. Opening either sheet, the menu or a
// dialog closes the phone dock's More (the v0.2 plan's S8).

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
  /** Whether Hide folded the storage notices into the problem chip (the v0.2 plan's S7). */
  readonly noticesHidden: boolean;
  /** Whether the phone dock's More holds its popover open (the v0.2 plan's S8). */
  readonly more: boolean;
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
  | { readonly type: 'close-dialog' }
  | { readonly type: 'hide-notices' }
  | { readonly type: 'show-notices' }
  | { readonly type: 'open-more' }
  | { readonly type: 'close-more' }
  | { readonly type: 'toggle-more' };

export const INITIAL_SHELL_STATE: ShellState = {
  menu: false,
  drawer: false,
  details: false,
  dialog: null,
  opener: null,
  noticesHidden: false,
  more: false,
};

/** The actions on the drawer and the Details sheet. */
type SheetAction = Extract<
  ShellAction['type'],
  'toggle-drawer' | 'close-drawer' | 'open-details' | 'toggle-details' | 'close-details'
>;

/** The drawer and the Details sheet: opening either closes the other, and More. */
function sheetsReducer(state: ShellState, type: SheetAction): ShellState {
  switch (type) {
    case 'toggle-drawer':
      return state.drawer
        ? { ...state, drawer: false }
        : { ...state, drawer: true, details: false, more: false };
    case 'close-drawer':
      return { ...state, drawer: false };
    case 'open-details':
      return { ...state, details: true, drawer: false, more: false };
    case 'toggle-details':
      return state.details
        ? { ...state, details: false }
        : { ...state, details: true, drawer: false, more: false };
    case 'close-details':
      return { ...state, details: false };
  }
}

/** The actions on the menu and the dialogs. */
type SurfaceAction = Extract<
  ShellAction,
  { readonly type: 'open-menu' | 'close-menu' | 'open-dialog' | 'close-dialog' }
>;

/** The menu and the dialogs; opening either closes More. */
function surfacesReducer(state: ShellState, action: SurfaceAction): ShellState {
  switch (action.type) {
    case 'open-menu':
      return { ...state, menu: true, more: false };
    case 'close-menu':
      return { ...state, menu: false };
    case 'open-dialog':
      // A dialog opened from the menu takes the focus, so the menu closes with it.
      return { ...state, menu: false, more: false, dialog: action.dialog, opener: action.opener };
    case 'close-dialog':
      return { ...state, dialog: null, opener: null };
  }
}

const SHEET_ACTIONS: ReadonlySet<ShellAction['type']> = new Set<SheetAction>([
  'toggle-drawer',
  'close-drawer',
  'open-details',
  'toggle-details',
  'close-details',
]);

const isSheetAction = (type: ShellAction['type']): type is SheetAction => SHEET_ACTIONS.has(type);

/** The actions on More. */
type MoreAction = Extract<ShellAction['type'], 'open-more' | 'close-more' | 'toggle-more'>;

const MORE_ACTIONS: ReadonlySet<ShellAction['type']> = new Set<MoreAction>([
  'open-more',
  'close-more',
  'toggle-more',
]);

const isMoreAction = (type: ShellAction['type']): type is MoreAction => MORE_ACTIONS.has(type);

/** More, opened, closed or toggled; the state itself when it does not change. */
function moreReducer(state: ShellState, type: MoreAction): ShellState {
  const more = type === 'toggle-more' ? !state.more : type === 'open-more';
  return state.more === more ? state : { ...state, more };
}

/**
 * The notices' flag; the state itself when it does not change, so that hiding hidden notices or
 * showing shown ones renders nothing.
 */
function noticesReducer(state: ShellState, hidden: boolean): ShellState {
  return state.noticesHidden === hidden ? state : { ...state, noticesHidden: hidden };
}

export function shellReducer(state: ShellState, action: ShellAction): ShellState {
  if (action.type === 'hide-notices' || action.type === 'show-notices') {
    return noticesReducer(state, action.type === 'hide-notices');
  }
  if (isMoreAction(action.type)) return moreReducer(state, action.type);
  return isSheetAction(action.type)
    ? sheetsReducer(state, action.type)
    : surfacesReducer(state, action as SurfaceAction);
}

/**
 * Whether a new save status shows hidden storage notices again (the v0.2 plan's S7): a failure
 * after a status that was no failure or failed for another reason, or a stale save after one that
 * was not stale. That is when the engine announces the status (packages/engine/src/editor/
 * announcing.ts), so the notices come back exactly when the assertive region speaks; a retry that
 * fails for the same reason keeps them hidden.
 */
export function reopensNotices(said: SaveStatus | null, next: SaveStatus | null): boolean {
  if (next?.type === 'failed') return said?.type !== 'failed' || said.reason !== next.reason;
  return next?.type === 'stale' && said?.type !== 'stale';
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
    hideNotices: () => {
      dispatch({ type: 'hide-notices' });
    },
    showNotices: () => {
      dispatch({ type: 'show-notices' });
    },
    openMore: () => {
      dispatch({ type: 'open-more' });
    },
    closeMore: () => {
      dispatch({ type: 'close-more' });
    },
    toggleMore: () => {
      dispatch({ type: 'toggle-more' });
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
