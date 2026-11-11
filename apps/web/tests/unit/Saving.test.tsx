import type { SaveStatus as Status } from '@planewright/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { StorageNotice } from '../../src/platform/storage.ts';
import { EditorShell } from '../../src/shell/EditorShell.tsx';
import { STALE_TEXT, STORAGE_NOTICE_TEXTS, failedText } from '../../src/ui/notices.ts';
import { saveHarness } from '../support/saving.ts';

// What the page shows of saving (ADR 0012, decision 12, D7; the v0.2 plan's S7; REQ-P05, REQ-P06,
// REQ-P07): nothing while saving works; for a failed, stale or unavailable save a "Not saved" chip
// in the top-right island before Elements, and the notices with P0's words under it, which are no
// alerts, since the live region says them (REQ-Y04). Hide folds the notices into the chip, which
// becomes a button that reopens them. Hide and reopening are in Saving-hide.test.tsx.

/** The shell over a status set by the test, and the unreadable-data notice if any. */
function shell(save: Status | null, storageNotice: StorageNotice | null = null) {
  const harness = saveHarness(save, storageNotice);
  render(<EditorShell surface={harness.surface} />);
  return harness;
}

const chip = (): HTMLElement | null => document.getElementById('save-status');
const island = (name: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-island="${name}"]`) ?? document.body;

/** The storage notices, which are no alerts. */
function notices(): HTMLElement {
  expect(screen.queryByRole('alert')).toBeNull();
  return screen.getByRole('region', { name: 'Storage notices' });
}

const hideButton = (): HTMLElement => screen.getByRole('button', { name: 'Hide storage notices' });

function hide(): void {
  act(() => {
    fireEvent.click(hideButton());
  });
}

const FAILED: Status = { type: 'failed', reason: 'quota' };

describe('saving while it works', () => {
  it.each([[{ type: 'saved' }], [{ type: 'pending' }]] satisfies [Status][])(
    'D1 A2 shows no chip, no notice and no word about saving for %j',
    (save) => {
      shell(save);
      expect(chip()).toBeNull();
      expect(screen.queryByRole('region', { name: 'Storage notices' })).toBeNull();
      expect(document.body).not.toHaveTextContent(/Sav(ed|ing)|Not saved|Storage notice/u);
      expect(within(island('top-right')).getAllByRole('button')).toEqual([
        screen.getByRole('button', { name: 'Elements' }),
      ]);
      expect(island('top-right').querySelector('svg[data-glyph^="status"]')).toBeNull();
      expect(within(island('bottom-right')).getAllByRole('button')).toEqual([
        screen.getByRole('button', { name: 'Keyboard shortcuts' }),
      ]);
    },
  );
});

describe('the problem chip', () => {
  it.each([
    [FAILED, null, 'tone-error', 'status-problem'],
    [{ type: 'stale' }, null, 'tone-warning', 'status-tabs'],
    [null, 'unavailable', 'tone-warning', 'status-problem'],
  ] satisfies [Status | null, StorageNotice | null, string, string][])(
    'D3 A4 says Not saved for %j with the start-up notice %s, in the top-right island before Elements, in %s with %s',
    (save, notice, tone, glyph) => {
      shell(save, notice);
      const shown = chip();
      expect(shown?.tagName).toBe('P');
      expect(shown).toHaveTextContent(/^Not saved$/u);
      expect(shown).toHaveClass(tone);
      const glyphs = [...(shown?.querySelectorAll('svg') ?? [])];
      expect(glyphs.map((svg) => svg.dataset['glyph'])).toEqual([glyph]);
      expect(glyphs.every((svg) => svg.getAttribute('aria-hidden') === 'true')).toBe(true);
      const [first, hairline, toggle] = island('top-right').children;
      expect(first).toBe(shown);
      expect(hairline).toHaveAttribute('aria-hidden', 'true');
      expect(toggle).toBe(screen.getByRole('button', { name: 'Elements' }));
    },
  );

  it('D3 A4 is a paragraph while the notices show, and a collapsed button that controls them once they are hidden', () => {
    shell(FAILED);
    expect(chip()?.tagName).toBe('P');
    expect(chip()).not.toHaveAttribute('aria-expanded');
    hide();
    const button = screen.getByRole('button', { name: 'Not saved' });
    expect(button).toBe(chip());
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'notices');
    expect(document.getElementById('notices')).toHaveAttribute('hidden');
    expect(button).toHaveClass('tone-error');
    const glyphs = [...button.querySelectorAll('svg')].map((svg) => svg.dataset['glyph']);
    expect(glyphs).toEqual(['status-problem', 'chevron-down']);
  });

  it('D3 A4 reads Storage notice only for a hidden unreadable-data notice, and Not saved when a save problem comes with it', () => {
    shell({ type: 'saved' }, 'invalid');
    expect(chip()).toBeNull();
    hide();
    const button = screen.getByRole('button', { name: 'Storage notice' });
    expect(button).toBe(chip());
    expect(button).toHaveAttribute('aria-controls', 'notices');
    expect(button).toHaveClass('tone-warning');
    expect(button.querySelector('svg')?.dataset['glyph']).toBe('status-problem');
    document.body.innerHTML = '';
    shell(FAILED, 'invalid');
    hide();
    expect(screen.getByRole('button', { name: 'Not saved' })).toBe(chip());
    expect(screen.queryByText('Storage notice')).toBeNull();
  });
});

describe('the storage notices', () => {
  it.each([
    ['quota', 'the browser’s storage for this page is full'],
    ['unavailable', 'the browser’s storage cannot be reached'],
    ['failed', 'the browser’s storage did not take the change'],
  ] as const)(
    'REQ-P05 a %s failure is a notice that says the changes are kept and retried',
    (reason, why) => {
      shell({ type: 'failed', reason });
      expect(notices()).toHaveTextContent(
        `Saving failed: ${why}. Your changes are kept in this tab, and saving is tried again.`,
      );
    },
  );

  it.each([
    [FAILED, null, [[failedText('quota'), 'tone-error']]],
    [{ type: 'stale' }, null, [[STALE_TEXT, 'tone-warning']]],
    [null, 'unavailable', [[STORAGE_NOTICE_TEXTS.unavailable, 'tone-warning']]],
    [{ type: 'saved' }, 'invalid', [[STORAGE_NOTICE_TEXTS.invalid, 'tone-warning']]],
    [
      { type: 'failed', reason: 'failed' },
      'invalid',
      [
        [STORAGE_NOTICE_TEXTS.invalid, 'tone-warning'],
        [failedText('failed'), 'tone-error'],
      ],
    ],
  ] satisfies [Status | null, StorageNotice | null, string[][]][])(
    'D4 A5 for %j and %s keeps P0’s words byte for byte, in their tones, with no alert',
    (save, notice, expected) => {
      shell(save, notice);
      const region = notices();
      expect(region).toHaveAttribute('id', 'notices');
      expect(region.querySelector('[role="alert"]')).toBeNull();
      const shown = [...region.querySelectorAll('.notice')].map((element) => [
        element.querySelector('p')?.textContent ?? element.textContent,
        element.classList.contains('tone-error') ? 'tone-error' : 'tone-warning',
      ]);
      expect(shown).toEqual(expected);
    },
  );

  it('D4 has one Hide control, the region’s last after the stale answers, showing Hide and named for the notices', () => {
    shell({ type: 'stale' });
    expect(within(notices()).getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'Load the newer version' }),
      screen.getByRole('button', { name: 'Keep this version' }),
      hideButton(),
    ]);
    expect(hideButton()).toHaveTextContent(/^Hide$/u);
  });

  it('REQ-P06 a stale save is a notice that offers to load the newer version or keep this one', () => {
    const harness = shell({ type: 'stale' });
    const resolveStale = vi.spyOn(harness.editor, 'resolveStale');
    resolveStale.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Load the newer version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this version' }));
    expect(resolveStale.mock.calls).toEqual([['load'], ['keep']]);
  });

  it('C1 REQ-Y02 gives the focus to the canvas once the stale notice is answered, never to the page', () => {
    const harness = shell({ type: 'stale' });
    vi.spyOn(harness.editor, 'resolveStale').mockResolvedValue(undefined);
    const canvas = screen.getByRole('region', { name: 'Drawing canvas' });
    for (const name of ['Keep this version', 'Load the newer version']) {
      const answer = screen.getByRole('button', { name });
      answer.focus();
      fireEvent.click(answer);
      expect(document.activeElement).toBe(canvas);
    }
  });
});
