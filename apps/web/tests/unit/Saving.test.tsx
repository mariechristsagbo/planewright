import type { Editor, EditorView, SaveStatus as Status } from '@planewright/engine';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CANVAS_ID } from '../../src/a11y/focus.ts';
import { EditorProvider } from '../../src/editor/EditorProvider.tsx';
import type { StorageNotice } from '../../src/platform/storage.ts';
import { SaveStatus, StorageNotices } from '../../src/ui/Saving.tsx';
import { surfaceHarness } from '../support/surface.tsx';

// What the page says about saving (REQ-P05, REQ-P06, REQ-P07): the status beside the view
// readout, and the notices for failed, stale, unavailable and invalid storage. The notices are no
// alerts: the live region says them (REQ-Y04), so that a notice there at start-up is heard too.

/** The surface of a real editor whose view reports `save`, and the editor's stale answers. */
function mount(save: Status | null, storageNotice: StorageNotice | null = null) {
  const { surface } = surfaceHarness();
  const resolveStale = vi.fn<Editor['resolveStale']>(() => Promise.resolve());
  const view: EditorView = { ...surface.editor.view, save };
  const editor: Editor = { ...surface.editor, view, resolveStale };
  render(
    <EditorProvider surface={{ ...surface, editor, storageNotice }}>
      <SaveStatus />
      <StorageNotices />
    </EditorProvider>,
  );
  return { resolveStale };
}

const status = () => document.getElementById('save-status')?.textContent;

/** The notices below the canvas, which are no alerts. */
function notices(): HTMLElement {
  expect(screen.queryByRole('alert')).toBeNull();
  return screen.getByRole('region', { name: 'Storage notices' });
}

describe('the save status', () => {
  it.each([
    [{ type: 'saved' }, 'Saved in this browser'],
    [{ type: 'pending' }, 'Saving…'],
    [{ type: 'failed', reason: 'quota' }, 'Not saved'],
    [{ type: 'stale' }, 'Not saved'],
    [null, 'Not saved'],
  ] satisfies [Status | null, string][])('REQ-P01 says %o as “%s”', (save, text) => {
    mount(save);
    expect(status()).toBe(text);
  });

  it('shows no notice while saving works', () => {
    mount({ type: 'saved' });
    expect(screen.queryByRole('region', { name: 'Storage notices' })).toBeNull();
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
      mount({ type: 'failed', reason });
      expect(notices()).toHaveTextContent(
        `Saving failed: ${why}. Your changes are kept in this tab, and saving is tried again.`,
      );
    },
  );

  it('REQ-P06 a stale save is a notice that offers to load the newer version or keep this one', () => {
    const { resolveStale } = mount({ type: 'stale' });
    expect(notices()).toHaveTextContent(
      /Another tab saved a newer version of this drawing, so this tab stopped saving\./,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Load the newer version' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this version' }));
    expect(resolveStale.mock.calls).toEqual([['load'], ['keep']]);
  });

  it('C1 REQ-Y02 gives the focus to the canvas once the stale notice is answered, never to the page', () => {
    const canvas = document.createElement('div');
    canvas.id = CANVAS_ID;
    canvas.tabIndex = 0;
    document.body.append(canvas);
    const { resolveStale } = mount({ type: 'stale' });
    for (const name of ['Keep this version', 'Load the newer version']) {
      const answer = screen.getByRole('button', { name });
      answer.focus();
      fireEvent.click(answer);
      expect(document.activeElement).toBe(canvas);
    }
    expect(resolveStale).toHaveBeenCalledTimes(2);
    canvas.remove();
  });

  it('says that nothing is saved when storage is unavailable', () => {
    mount(null, 'unavailable');
    expect(notices()).toHaveTextContent(
      'Saving is unavailable in this browser: the drawing stays in this tab only and is lost when the tab closes.',
    );
  });

  it('REQ-P07 says that invalid stored data is left unchanged and a new drawing was opened', () => {
    mount({ type: 'saved' }, 'invalid');
    expect(notices()).toHaveTextContent(
      'The drawing saved in this browser could not be read, so a new drawing was opened. The saved data is left unchanged.',
    );
  });
});
