import { describe, expect, it } from 'vitest';

import { INITIAL_SHELL_STATE, shellReducer } from '../../src/shell/shell-state.ts';
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
