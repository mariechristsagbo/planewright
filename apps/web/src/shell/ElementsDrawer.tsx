import { ElementList } from '../a11y/ElementList.tsx';

/** The drawer's identifier, which the Elements toggle controls. */
export const DRAWER_ID = 'element-list-drawer';

/**
 * The Elements drawer around P0's element list, whose behaviour, names, roles and keys stay as
 * they are. It is closed at every load (ADR 0012, D4), since the shell's state is never stored.
 * While it is closed the list stays mounted but hidden, out of the tab order and of the
 * accessibility tree: S5 unmounts it and memoises its options together, so that the pan step's
 * cost is measured once for both (the ADR's row for perf/panning.spec.ts).
 */
export function ElementsDrawer({ open }: { readonly open: boolean }) {
  return (
    <div id={DRAWER_ID} className="element-list-drawer" hidden={!open}>
      <ElementList />
    </div>
  );
}
