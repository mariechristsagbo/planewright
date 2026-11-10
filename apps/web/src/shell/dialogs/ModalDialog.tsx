import { useEffect, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

// The shell's modal dialogs (ADR 0012, decisions 10 and 14): a native dialog shown modally, so
// that the page behind it is inert, with the focus on Close when it opens, Tab and Shift+Tab
// wrapping inside it, and Escape, Close or a press on the scrim closing it. Whoever opens it gives
// the focus back to its opener on closing (REQ-Y02).

/** The dialog's own tab stops. */
const STOPS = 'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside the dialog: past its last stop is its first, and back again. */
function wrapTab(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== 'Tab') return;
  const stops = [...event.currentTarget.querySelectorAll<HTMLElement>(STOPS)];
  const [first, last] = [stops[0], stops.at(-1)];
  const edge = event.shiftKey ? first : last;
  if (edge === undefined || event.currentTarget.ownerDocument.activeElement !== edge) return;
  event.preventDefault();
  (event.shiftKey ? last : first)?.focus();
}

/** Whether a press landed on the scrim: on the dialog element itself, outside its box. */
function onScrim(event: MouseEvent<HTMLDialogElement>): boolean {
  if (event.target !== event.currentTarget) return false;
  const box = event.currentTarget.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

interface ModalDialogProps {
  /** The dialog's identifier; its title's is `<id>-title`. */
  readonly id: string;
  readonly title: string;
  /** Called once the dialog has closed, by Escape, Close or the scrim. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** A modal dialog, open while it is mounted. */
export function ModalDialog({ id, title, onClose, children }: ModalDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (dialog.current?.open === false) dialog.current.showModal();
    close.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      id={id}
      className="dialog"
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onKeyDown={wrapTab}
      onClick={(event) => {
        if (onScrim(event)) dialog.current?.close();
      }}
    >
      <div className="dialog-header">
        <h2 id={`${id}-title`} className="dialog-title">
          {title}
        </h2>
        <button
          ref={close}
          type="button"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
