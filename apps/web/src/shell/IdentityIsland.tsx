import { useSurface } from '../editor/surface.ts';
import { Icon } from './icons.tsx';
import { MainMenu } from './menu/MainMenu.tsx';
import { MenuButton } from './menu/MenuButton.tsx';
import type { MenuAction } from './menu/menu-items.ts';
import { PrereleaseTag } from './PrereleaseTag.tsx';
import type { Openers, ShellControls } from './shell-state.ts';

interface IdentityIslandProps {
  readonly shell: ShellControls;
  /** The menu button and the Pre-release tag, which dialogs give the focus back to. */
  readonly menuButton: Openers['menu'];
  readonly tag: Openers['tag'];
}

/**
 * The identity island at the top left (ADR 0012, decision 2): the menu button and its menu, open
 * under it, then the mark, Planewright's original glyph (decision 3), and the wordmark, which
 * compact widths hide, both hidden from assistive technology since the page's hidden heading
 * already names Planewright, then the Pre-release tag. The menu's items run the registry's
 * commands or the shell's own ways to the drawer and the dialogs; a dialog opened from the menu
 * gives the focus back to the menu button. While the menu is open the island carries a class that
 * raises it above the other islands.
 */
export function IdentityIsland({ shell, menuButton, tag }: IdentityIslandProps) {
  const { editor } = useSurface();
  const close = (returnFocus: boolean): void => {
    shell.closeMenu();
    if (returnFocus) menuButton.current?.focus();
  };
  const run = (action: MenuAction): void => {
    switch (action.kind) {
      case 'command':
        editor.run(action.id);
        break;
      case 'drawer':
        shell.toggleDrawer();
        break;
      case 'dialog':
        shell.openDialog(action.dialog, 'menu');
        return;
      case 'link':
        return;
    }
    close(true);
  };
  return (
    <div
      className={`island identity-island${shell.menu ? ' chrome-menu-open' : ''}`}
      data-island="identity"
    >
      <MenuButton
        ref={menuButton}
        open={shell.menu}
        onOpen={shell.openMenu}
        onClose={() => {
          close(true);
        }}
      />
      {shell.menu ? <MainMenu drawer={shell.drawer} onRun={run} onClose={close} /> : null}
      <span className="identity-mark" aria-hidden="true">
        <Icon name="mark" />
      </span>
      <span className="wordmark" aria-hidden="true">
        Planewright
      </span>
      <PrereleaseTag
        ref={tag}
        onOpen={() => {
          shell.openDialog('about', 'tag');
        }}
      />
    </div>
  );
}
