import { ElementList } from '../a11y/ElementList.tsx';

/** The drawer's identifier, which the Elements toggle controls. */
export const DRAWER_ID = 'element-list-drawer';

/**
 * The Elements drawer around P0's element list, whose behaviour, names, roles and keys stay as
 * they are. It is closed at every load (ADR 0012, D4), since the shell's state is never stored.
 * While it is closed it mounts no list, so that a pan step costs the list nothing, and its own
 * element stays, empty and hidden, for the toggle to control.
 */
export function ElementsDrawer({ open }: { readonly open: boolean }) {
  return (
    <div id={DRAWER_ID} className="element-list-drawer" hidden={!open}>
      {open ? <ElementList /> : null}
    </div>
  );
}
