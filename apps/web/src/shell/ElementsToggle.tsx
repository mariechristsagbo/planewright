import { useCallback, useSyncExternalStore } from 'react';
import type { Ref } from 'react';

import { useSurface } from '../editor/surface.ts';
import { DRAWER_ID } from './ElementsDrawer.tsx';
import { Icon } from './icons.tsx';

/**
 * How many elements are drawn. It renders again only when the count changes, not at each pan step,
 * which publishes a new view with the same elements (ADR 0012, decision 14).
 */
function useElementCount(): number {
  const { editor } = useSurface();
  const subscribe = useCallback((listener: () => void) => editor.subscribe(listener), [editor]);
  return useSyncExternalStore(subscribe, () => editor.view.elements.length);
}

/**
 * The Elements toggle (ADR 0012, decisions 2 and 13): it opens and closes the Elements drawer and
 * exposes whether it is open as its expanded state (REQ-Y01). It shows its glyph, its word and the
 * count of the drawn elements in Inter's tabular figures (decision 8). The glyph and the count are
 * hidden from assistive technology, so that the name stays exactly "Elements" and a change, which
 * the live region announces, is never said a second time by the count.
 */
export function ElementsToggle({
  ref,
  open,
  onToggle,
}: {
  readonly ref: Ref<HTMLButtonElement>;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const count = useElementCount();
  return (
    <button
      ref={ref}
      type="button"
      className="elements-toggle"
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onClick={onToggle}
    >
      <Icon name="elements" />
      <span>Elements</span>
      <span className="toggle-count" aria-hidden="true">
        {count}
      </span>
    </button>
  );
}
