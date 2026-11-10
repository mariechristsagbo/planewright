import { DRAWER_ID } from './ElementsDrawer.tsx';

/**
 * The plain Elements toggle (ADR 0012, decision 13): it opens and closes the Elements drawer and
 * exposes whether it is open as its expanded state (REQ-Y01). S5 adds the count.
 */
export function ElementsToggle({
  open,
  onToggle,
}: {
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button type="button" aria-expanded={open} aria-controls={DRAWER_ID} onClick={onToggle}>
      Elements
    </button>
  );
}
