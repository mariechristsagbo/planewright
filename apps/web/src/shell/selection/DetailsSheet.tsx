import { useRef } from 'react';
import type { Ref } from 'react';

import { Icon } from '../icons.tsx';
import { Figures, SelectionHeading, StyleFootnote } from './Figures.tsx';
import type { SelectionGeometry } from './geometry.ts';
import { useFocusRescue } from './use-selected.ts';

/** The Details sheet's identifier, which the bar's Details button controls. */
export const DETAILS_ID = 'details-sheet';

/**
 * The phone's Details sheet (ADR 0012, decision 13; the v0.2 plan's S6): a region named "Details"
 * along the window's bottom, below the selection bar and the notices, at most 62 % of its height,
 * that repeats the selection's heading and shows its figures and the footnote, with a Close
 * Details glyph button. Its open state is the shell's, closed at every load and stored nowhere.
 * While it is closed its own element stays, empty and hidden, for the Details button to control.
 * Escape inside it closes it and goes no further, so that the selection stays; the shell makes the
 * tool bar and the bottom islands inert while it is open.
 */
export function DetailsSheet({
  open,
  geometry,
  close,
  onClose,
}: {
  readonly open: boolean;
  readonly geometry: SelectionGeometry;
  /** The Close Details button, which takes the focus when the sheet opens. */
  readonly close: Ref<HTMLButtonElement>;
  readonly onClose: () => void;
}) {
  const sheet = useRef<HTMLElement>(null);
  useFocusRescue(sheet);
  return (
    <section
      ref={sheet}
      id={DETAILS_ID}
      aria-label="Details"
      className="details-sheet"
      hidden={!open}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        // The sheet closes, and the Escape goes no further, so that the selection stays.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      {open ? (
        <>
          <div className="details-top">
            <SelectionHeading id="details-heading" geometry={geometry} />
            <button
              ref={close}
              type="button"
              className="details-close"
              aria-label="Close Details"
              data-chrome-tip="Close Details"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </div>
          <Figures geometry={geometry} />
          <StyleFootnote />
        </>
      ) : null}
    </section>
  );
}
