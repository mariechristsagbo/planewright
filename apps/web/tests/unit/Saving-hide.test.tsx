import type { SaveStatus as Status } from '@planewright/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StorageNotice } from '../../src/platform/storage.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { saveHarness } from '../support/saving.ts';

// Hiding and reopening the storage notices (ADR 0012, decisions 12 and 14; the v0.2 plan's S7): Hide
// folds them into the chip's button with the focus on it, the button reopens them with the focus on
// Hide, a new failure, a changed reason or a stale save shows them again, and a retry for the same
// reason does not. The focus never falls to the body when the chip or the notices go, and the
// hidden flag is never stored.

function shell(save: Status | null, storageNotice: StorageNotice | null = null) {
  const harness = saveHarness(save, storageNotice);
  render(<EditorShell surface={harness.surface} />);
  return harness;
}

const chip = (): HTMLElement | null => document.getElementById('save-status');
const shownNotices = (): HTMLElement | null =>
  screen.queryByRole('region', { name: 'Storage notices' });
const hideButton = (): HTMLElement => screen.getByRole('button', { name: 'Hide storage notices' });
const canvas = (): HTMLElement => screen.getByRole('region', { name: 'Drawing canvas' });

function press(button: HTMLElement): void {
  act(() => {
    button.focus();
    fireEvent.click(button);
  });
}

/** The shell's tab stops, in document order, leaving out what is hidden. */
const tabStops = (): HTMLElement[] =>
  [...document.querySelectorAll<HTMLElement>('button, a[href], textarea, summary, [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && element.closest('[hidden]') === null)
    .filter(
      (element) => element.closest('[data-island="tools"], [data-island="identity"]') === null,
    );

const QUOTA: Status = { type: 'failed', reason: 'quota' };
const REFUSED: Status = { type: 'failed', reason: 'failed' };

afterEach(() => {
  localStorage.clear();
});

describe('Hide and the chip’s button', () => {
  it('D6 A6 Hide folds the notices into the chip’s button with the focus on it, which reopens them with the focus on Hide', () => {
    shell(QUOTA);
    press(hideButton());
    expect(shownNotices()).toBeNull();
    expect(chip()?.tagName).toBe('BUTTON');
    expect(document.activeElement).toBe(chip());
    press(screen.getByRole('button', { name: 'Not saved' }));
    expect(shownNotices()).not.toBeNull();
    expect(chip()?.tagName).toBe('P');
    expect(document.activeElement).toBe(hideButton());
  });

  it('D6 A8 puts the chip’s button, once the notices are hidden, between the canvas and Elements', () => {
    shell({ type: 'stale' });
    const elements = screen.getByRole('button', { name: 'Elements' });
    const load = screen.getByRole('button', { name: 'Load the newer version' });
    const keep = screen.getByRole('button', { name: 'Keep this version' });
    const stops = tabStops();
    expect(stops.slice(0, 5)).toEqual([canvas(), load, keep, hideButton(), elements]);
    press(hideButton());
    expect(tabStops().slice(0, 3)).toEqual([canvas(), chip(), elements]);
  });

  it('D1 A2 has no persistence tab stop while saving works', () => {
    shell({ type: 'saved' });
    expect(tabStops().slice(0, 2)).toEqual([
      canvas(),
      screen.getByRole('button', { name: 'Elements' }),
    ]);
  });

  it('A6 writes the hidden flag nowhere, and the notices show again at the next load', () => {
    const written = vi.spyOn(Storage.prototype, 'setItem');
    const harness = shell({ type: 'stale' });
    press(hideButton());
    press(screen.getByRole('button', { name: 'Not saved' }));
    press(hideButton());
    expect(written).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect('indexedDB' in window ? window.indexedDB : undefined).toBeUndefined();
    document.body.innerHTML = '';
    render(<EditorShell surface={harness.surface} />);
    expect(shownNotices()).not.toBeNull();
    written.mockRestore();
  });
});

describe('reopening the notices', () => {
  it('D5 A6 shows hidden notices again on a new failure, a changed reason or a stale save', () => {
    const harness = shell(QUOTA);
    const hidden = () => shownNotices() === null;
    press(hideButton());
    harness.setSave(REFUSED);
    expect(hidden()).toBe(false);
    press(hideButton());
    harness.setSave({ type: 'stale' });
    expect(hidden()).toBe(false);
    press(hideButton());
    harness.setSave({ type: 'saved' });
    harness.setSave({ type: 'pending' });
    harness.setSave(QUOTA);
    expect(hidden()).toBe(false);
  });

  it('D5 A6 keeps them hidden through a retry for the same reason', () => {
    const harness = shell(QUOTA);
    press(hideButton());
    harness.setSave({ type: 'failed', reason: 'quota' });
    expect(shownNotices()).toBeNull();
    expect(chip()?.tagName).toBe('BUTTON');
  });

  it('D6 A8 gives the focus to Hide when a new failure reopens the notices under the focused chip button', () => {
    const harness = shell(QUOTA);
    press(hideButton());
    expect(document.activeElement).toBe(chip());
    harness.setSave(REFUSED);
    expect(document.activeElement).toBe(hideButton());
  });

  it.each([
    ['the chip’s button', true],
    ['Hide', false],
  ])(
    'D6 A8 gives the focus to the canvas, never the body, when %s goes as the problem clears',
    (_, folded) => {
      const harness = shell(QUOTA);
      if (folded) press(hideButton());
      else
        act(() => {
          hideButton().focus();
        });
      harness.setSave({ type: 'saved' });
      expect(chip()).toBeNull();
      expect(document.activeElement).toBe(canvas());
    },
  );
});
