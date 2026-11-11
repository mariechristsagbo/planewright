import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { Icon } from '../icons.tsx';
import { DETAILS_ID, DetailsSheet } from './DetailsSheet.tsx';
import { SELECTION_HEADING_ID, SelectionHeading } from './Figures.tsx';
import { SelectionActions } from './SelectionActions.tsx';
import { useFocusRescue } from './use-selected.ts';
import type { Selected } from './use-selected.ts';

// The phone's selection bar and its Details sheet (ADR 0012, decisions 13 and 14; the v0.2 plan's
// S6): on a phone in portrait the panel's place goes to a bar under the tool bar's row, above the
// storage notices, with the same heading and actions, each a 44 px target, then Details, which
// opens the selection's figures in a sheet along the window's bottom.

/** The bar's and the sheet's place in the shell's state, and the ways to change it. */
export interface DetailsControls {
  readonly details: boolean;
  /** Whether the Elements sheet is open, which takes the focus when it replaces the Details sheet. */
  readonly drawer: boolean;
  readonly onToggleDetails: () => void;
  readonly onCloseDetails: () => void;
}

/**
 * Moves the focus as the Details sheet opens or closes: to its Close once it opens, and back to
 * Details once it closes, unless the Elements sheet opened in its place and takes the focus.
 */
function useDetailsFocus(
  open: boolean,
  drawer: boolean,
  details: RefObject<HTMLButtonElement | null>,
  close: RefObject<HTMLButtonElement | null>,
): void {
  const was = useRef(open);
  useEffect(() => {
    if (open === was.current) return;
    was.current = open;
    if (open) close.current?.focus();
    else if (!drawer) details.current?.focus();
  }, [open, drawer, details, close]);
}

/**
 * The bar and, right after it, the Details sheet. The sheet closes when the bar goes, as an
 * emptied selection, a text session or a wider window makes it go, so that a later selection
 * shows the bar with the sheet closed; the canvas takes the focus if it was inside either.
 */
export function SelectionBar({
  selected,
  controls,
}: {
  readonly selected: Selected;
  readonly controls: DetailsControls;
}) {
  const { details, drawer, onToggleDetails, onCloseDetails } = controls;
  const bar = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useFocusRescue(bar);
  useDetailsFocus(details, drawer, toggle, close);
  useEffect(() => onCloseDetails, [onCloseDetails]);
  return (
    <>
      <div
        ref={bar}
        role="group"
        aria-labelledby={SELECTION_HEADING_ID}
        className="selection-bar"
        data-island="selection"
      >
        <SelectionHeading id={SELECTION_HEADING_ID} geometry={selected.geometry} />
        <SelectionActions editsText={selected.editsText} compact />
        <button
          ref={toggle}
          type="button"
          className="details-toggle"
          aria-expanded={details}
          aria-controls={DETAILS_ID}
          data-chrome-tip="Details"
          onClick={onToggleDetails}
        >
          <Icon name="details" />
          <span className="visually-hidden">Details</span>
        </button>
      </div>
      <DetailsSheet
        open={details}
        geometry={selected.geometry}
        close={close}
        onClose={onCloseDetails}
      />
    </>
  );
}
