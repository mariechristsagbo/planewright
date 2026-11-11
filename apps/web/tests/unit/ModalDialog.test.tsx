import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ModalDialog } from '../../src/shell/dialogs/ModalDialog.tsx';

// The shell's modal dialog (ADR 0012, decisions 10 and 14): open while mounted with the focus on
// Close, Tab and Shift+Tab wrapping inside it, and a press on the scrim closing it. The browser's
// own Escape is checked end to end, since jsdom has no modal dialogs (tests/setup.ts).

function mount() {
  const onClose = vi.fn();
  render(
    <ModalDialog id="test" title="A dialog" onClose={onClose}>
      <p>Words</p>
      <a href="https://example.org/">A link</a>
    </ModalDialog>,
  );
  const dialog = screen.getByRole('dialog', { name: 'A dialog' });
  const close = screen.getByRole('button', { name: 'Close' });
  const link = screen.getByRole('link', { name: 'A link' });
  return { onClose, dialog, close, link };
}

/** Puts the dialog's box at 100, 100, 400 by 300, as jsdom lays nothing out. */
function placeBox(dialog: HTMLElement): void {
  dialog.getBoundingClientRect = () => new DOMRect(100, 100, 400, 300);
}

describe('the modal dialog', () => {
  it('opens with the focus on Close, named by its title', () => {
    const { dialog, close } = mount();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-labelledby', 'test-title');
    expect(close).toHaveFocus();
  });

  it('REQ-Y02 wraps Tab from the last stop to the first, and Shift+Tab from the first to the last', () => {
    const { dialog, close, link } = mount();
    act(() => {
      link.focus();
    });
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(link).toHaveFocus();
  });

  it('leaves Tab between inner stops, and other keys, to the browser', () => {
    const { dialog, close } = mount();
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(true);
    expect(fireEvent.keyDown(dialog, { key: 'Enter' })).toBe(true);
    expect(close).toHaveFocus();
  });

  it('closes on a press on the scrim, outside its box, and on Close', () => {
    const { dialog, onClose } = mount();
    placeBox(dialog);
    act(() => {
      fireEvent.click(dialog, { clientX: 50, clientY: 200 });
    });
    expect(dialog).not.toHaveAttribute('open');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open on a press inside its box or on its content', () => {
    const { dialog, onClose } = mount();
    placeBox(dialog);
    act(() => {
      fireEvent.click(dialog, { clientX: 110, clientY: 390 });
      fireEvent.click(screen.getByText('Words'), { clientX: 10, clientY: 10 });
    });
    expect(dialog).toHaveAttribute('open');
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
