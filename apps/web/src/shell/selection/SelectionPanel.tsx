import { useRef } from 'react';

import { Figures, SELECTION_HEADING_ID, SelectionHeading, StyleFootnote } from './Figures.tsx';
import { SelectionActions } from './SelectionActions.tsx';
import { SelectionBar } from './SelectionBar.tsx';
import type { DetailsControls } from './SelectionBar.tsx';
import { useFocusRescue, useSelected } from './use-selected.ts';
import type { Selected } from './use-selected.ts';

// The selection panel (ADR 0012, decisions 1, 2, 13 and 14; the v0.2 plan's S6): near the upper
// left while something drawn is selected and no text is edited, and out of the page otherwise, so
// that with no selection it has no tab stop and no cost. It shows the selection's kind or count,
// its read-only figures, Duplicate, Delete and Edit text, and that style controls are not in this
// build. It is a group named by its heading, neither a landmark nor a live region, since the
// polite region already says every selection and command. On a phone in portrait the selection
// bar and its Details sheet take its place (SelectionBar.tsx). Where they sit is selection.css's
// and responsive.css's.

/** The mounted panel, which gives the focus to the canvas if it goes with the focus inside. */
function Panel({ selected }: { readonly selected: Selected }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusRescue(panel);
  return (
    <div
      ref={panel}
      role="group"
      aria-labelledby={SELECTION_HEADING_ID}
      className="selection-panel"
      data-island="selection"
    >
      <SelectionHeading id={SELECTION_HEADING_ID} geometry={selected.geometry} />
      <Figures geometry={selected.geometry} />
      <SelectionActions editsText={selected.editsText} />
      <StyleFootnote />
    </div>
  );
}

/**
 * The panel, or under the phone sheet's query the bar and its Details sheet, while something drawn
 * is selected and no text is edited. It reads only values that keep their identity across camera
 * changes, so that a pan or zoom step renders none of them.
 */
export function SelectionPanel({
  sheet,
  controls,
}: {
  /** Whether the window is a phone in portrait, where the bar shows (shell/sheet.ts). */
  readonly sheet: boolean;
  readonly controls: DetailsControls;
}) {
  const selected = useSelected();
  if (selected === null) return null;
  return sheet ? (
    <SelectionBar selected={selected} controls={controls} />
  ) : (
    <Panel selected={selected} />
  );
}
