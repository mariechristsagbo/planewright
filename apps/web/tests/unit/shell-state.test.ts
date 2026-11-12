import type { SaveStatus } from '@planewright/engine';
import { describe, expect, it } from 'vitest';

import { INITIAL_SHELL_STATE, reopensNotices, shellReducer } from '../../src/shell/shell-state.ts';
import type { ShellAction, ShellState } from '../../src/shell/shell-state.ts';

// The shell's own state (ADR 0012, decision 13; the v0.2 plan's S6, issue #69's D4): the Details
// sheet is closed at first, opens, closes and toggles, and on a phone it and the Elements sheet are
// never open together, whichever opens second.

/** The state after the actions, from the initial state. */
const after = (...types: ShellAction['type'][]): ShellState =>
  types.reduce((state, type) => shellReducer(state, { type } as ShellAction), INITIAL_SHELL_STATE);

const sheets = ({ drawer, details }: ShellState) => ({ drawer, details });

describe('the shell’s state', () => {
  it('D4 starts with the Details sheet closed, as every surface', () => {
    expect(INITIAL_SHELL_STATE).toEqual({
      menu: false,
      drawer: false,
      details: false,
      dialog: null,
      opener: null,
      noticesHidden: false,
      more: false,
    });
  });

  it('D4 opens, closes and toggles the Details sheet', () => {
    expect(sheets(after('open-details'))).toEqual({ drawer: false, details: true });
    expect(sheets(after('open-details', 'close-details'))).toEqual({
      drawer: false,
      details: false,
    });
    expect(sheets(after('toggle-details'))).toEqual({ drawer: false, details: true });
    expect(sheets(after('toggle-details', 'toggle-details'))).toEqual({
      drawer: false,
      details: false,
    });
    expect(after('open-details', 'open-menu')).toMatchObject({ menu: true, details: true });
  });

  it('D4 A7 keeps one sheet open at a time, in both directions', () => {
    expect(sheets(after('toggle-drawer', 'toggle-details'))).toEqual({
      drawer: false,
      details: true,
    });
    expect(sheets(after('toggle-drawer', 'open-details'))).toEqual({
      drawer: false,
      details: true,
    });
    expect(sheets(after('open-details', 'toggle-drawer'))).toEqual({
      drawer: true,
      details: false,
    });
    // Closing one opens nothing.
    expect(sheets(after('open-details', 'close-drawer'))).toEqual({ drawer: false, details: true });
    expect(sheets(after('toggle-drawer', 'close-details'))).toEqual({
      drawer: true,
      details: false,
    });
    expect(sheets(after('toggle-drawer', 'toggle-drawer'))).toEqual({
      drawer: false,
      details: false,
    });
  });
});

describe('the hidden storage notices', () => {
  it('D5 A6 show at every load, and Hide and the chip’s button fold and reopen them', () => {
    expect(INITIAL_SHELL_STATE.noticesHidden).toBe(false);
    expect(after('hide-notices').noticesHidden).toBe(true);
    expect(after('hide-notices', 'hide-notices').noticesHidden).toBe(true);
    expect(after('hide-notices', 'show-notices').noticesHidden).toBe(false);
    expect(after('show-notices').noticesHidden).toBe(false);
  });

  it('D5 keeps the state itself when the flag does not change, so that the shell renders nothing', () => {
    expect(shellReducer(INITIAL_SHELL_STATE, { type: 'show-notices' })).toBe(INITIAL_SHELL_STATE);
    const hidden = after('hide-notices');
    expect(shellReducer(hidden, { type: 'hide-notices' })).toBe(hidden);
  });

  it('D5 leaves the other surfaces as they are', () => {
    const open = after('toggle-drawer', 'open-menu');
    expect(shellReducer(open, { type: 'hide-notices' })).toEqual({ ...open, noticesHidden: true });
    expect(after('hide-notices', 'toggle-drawer', 'close-menu').noticesHidden).toBe(true);
  });
});

const SAVED: SaveStatus = { type: 'saved' };
const PENDING: SaveStatus = { type: 'pending' };
const STALE: SaveStatus = { type: 'stale' };
const QUOTA: SaveStatus = { type: 'failed', reason: 'quota' };
const REFUSED: SaveStatus = { type: 'failed', reason: 'failed' };

describe('reopensNotices', () => {
  it.each([
    [SAVED, QUOTA, true],
    [PENDING, QUOTA, true],
    [STALE, QUOTA, true],
    [null, QUOTA, true],
    [QUOTA, REFUSED, true],
    [QUOTA, { type: 'failed', reason: 'quota' }, false],
    [QUOTA, QUOTA, false],
    [SAVED, STALE, true],
    [PENDING, STALE, true],
    [QUOTA, STALE, true],
    [STALE, { type: 'stale' }, false],
    [QUOTA, PENDING, false],
    [QUOTA, SAVED, false],
    [STALE, SAVED, false],
    [STALE, PENDING, false],
    [SAVED, PENDING, false],
    [PENDING, SAVED, false],
    [QUOTA, null, false],
  ] satisfies [SaveStatus | null, SaveStatus | null, boolean][])(
    'D5 A6 from %j to %j reopens the notices: %s',
    (said, next, reopens) => {
      expect(reopensNotices(said, next)).toBe(reopens);
    },
  );
});

describe('More', () => {
  it('D3 A14 is closed at first, and opens, closes and toggles', () => {
    expect(INITIAL_SHELL_STATE.more).toBe(false);
    expect(after('open-more').more).toBe(true);
    expect(after('open-more', 'close-more').more).toBe(false);
    expect(after('toggle-more').more).toBe(true);
    expect(after('toggle-more', 'toggle-more').more).toBe(false);
    // The state itself when it does not change, so that the shell renders nothing.
    expect(shellReducer(INITIAL_SHELL_STATE, { type: 'close-more' })).toBe(INITIAL_SHELL_STATE);
    const open = after('open-more');
    expect(shellReducer(open, { type: 'open-more' })).toBe(open);
  });

  it('D3 D10 closes when the drawer, the Details sheet, the menu or a dialog opens', () => {
    expect(after('open-more', 'toggle-drawer')).toMatchObject({ more: false, drawer: true });
    expect(after('open-more', 'open-details')).toMatchObject({ more: false, details: true });
    expect(after('open-more', 'toggle-details')).toMatchObject({ more: false, details: true });
    expect(after('open-more', 'open-menu')).toMatchObject({ more: false, menu: true });
    const dialog: ShellAction = { type: 'open-dialog', dialog: 'shortcuts', opener: 'keys' };
    expect(shellReducer(after('open-more'), dialog)).toMatchObject({
      more: false,
      dialog: 'shortcuts',
    });
  });

  it('D3 stays open while a surface closes or the notices fold, and opening it leaves the others', () => {
    const closes: ShellAction['type'][] = [
      'close-drawer',
      'close-details',
      'close-menu',
      'close-dialog',
      'hide-notices',
      'show-notices',
    ];
    expect(after('open-more', ...closes).more).toBe(true);
    expect(after('open-menu', 'hide-notices', 'open-more')).toMatchObject({
      menu: true,
      noticesHidden: true,
      more: true,
    });
  });
});
