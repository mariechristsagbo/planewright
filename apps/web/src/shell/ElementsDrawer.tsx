import { ElementList } from '../a11y/ElementList.tsx';
import { Icon } from './icons.tsx';

/** The drawer's identifier, which the Elements toggle controls. */
export const DRAWER_ID = 'element-list-drawer';

/**
 * The Elements drawer around P0's element list, whose behaviour, names, roles and keys stay as
 * they are, 300 px wide on desktops and 280 px at compact widths. It is closed at every load (ADR
 * 0012, D4), since the shell's state is never stored. While it is closed it mounts no list, so that
 * a pan step costs the list nothing, and its own element stays, empty and hidden, for the toggle to
 * control. While it is open, its Close, a glyph button named and tipped "Close Elements", sits
 * beside the list's heading, before the keys and the list in the tab order (decision 14). On a phone
 * in portrait it is a sheet along the window's bottom, at most 62 % of its height, which Escape
 * closes; the shell makes the islands it covers inert meanwhile.
 */
export function ElementsDrawer({
  open,
  sheet,
  onClose,
}: {
  readonly open: boolean;
  /** Whether it shows as the phone's sheet, which Escape closes (styles/responsive.css). */
  readonly sheet: boolean;
  readonly onClose: () => void;
}) {
  const close = (
    <button
      type="button"
      className="glyph-button drawer-close"
      aria-label="Close Elements"
      data-chrome-tip="Close Elements"
      onClick={onClose}
    >
      <Icon name="close" />
    </button>
  );
  return (
    <div
      id={DRAWER_ID}
      className="element-list-drawer"
      hidden={!open}
      onKeyDownCapture={(event) => {
        if (!sheet || event.key !== 'Escape') return;
        // The sheet closes, and the Escape goes no further, so that the list keeps the selection.
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      {open ? <ElementList action={close} /> : null}
    </div>
  );
}
