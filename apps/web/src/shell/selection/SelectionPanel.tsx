import { useRef } from 'react';

import { Figures, SelectionHeading, StyleFootnote } from './Figures.tsx';
import { SelectionActions } from './SelectionActions.tsx';
import { useFocusRescue, useSelected } from './use-selected.ts';
import type { Selected } from './use-selected.ts';

// The selection panel (ADR 0012, decisions 1, 2, 13 and 14; the v0.2 plan's S6): near the upper
// left while something drawn is selected and no text is edited, and out of the page otherwise, so
// that with no selection it has no tab stop and no cost. It shows the selection's kind or count,
// its read-only figures, Duplicate, Delete and Edit text, and that style controls are not in this
// build. It is a group named by its heading, neither a landmark nor a live region, since the
// polite region already says every selection and command. Where it sits is selection.css's.

const HEADING_ID = 'selection-heading';

/** The mounted panel, which gives the focus to the canvas if it goes with the focus inside. */
function Panel({ selected }: { readonly selected: Selected }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusRescue(panel);
  return (
    <div
      ref={panel}
      role="group"
      aria-labelledby={HEADING_ID}
      className="selection-panel"
      data-island="selection"
    >
      <SelectionHeading id={HEADING_ID} geometry={selected.geometry} />
      <Figures geometry={selected.geometry} />
      <SelectionActions editsText={selected.editsText} />
      <StyleFootnote />
    </div>
  );
}

/**
 * The panel, while something drawn is selected and no text is edited, wherever the phone's sheet
 * query does not match; under it, on a phone in portrait, the panel does not show. It reads only
 * values that keep their identity across camera changes, so that a pan or zoom step renders it not
 * at all.
 */
export function SelectionPanel({ sheet }: { readonly sheet: boolean }) {
  const selected = useSelected();
  return selected === null || sheet ? null : <Panel selected={selected} />;
}
