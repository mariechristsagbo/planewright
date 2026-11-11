import { useEffect, useMemo } from 'react';

import { useSurface } from '../editor/surface.ts';
import { reopensNotices } from '../shell/shell-state.ts';
import type { ShellControls } from '../shell/shell-state.ts';

// The storage notices' part of the shell's state (the v0.2 plan's S7): whether Hide folded them,
// and the ways to fold and reopen them, which a new failure, a changed reason or a stale save also
// reopens.

/** What the problem chip and the notices are given of the shell's state. */
export interface NoticesControls {
  readonly hidden: boolean;
  readonly onHide: () => void;
  readonly onShow: () => void;
}

/**
 * Shows hidden notices again when a new status calls for it (reopensNotices). It follows every view
 * the editor publishes, not what React renders, so that no status between two renders is missed.
 */
function useNoticesReopening(show: () => void): void {
  const { editor } = useSurface();
  useEffect(() => {
    let said = editor.view.save;
    return editor.subscribe(() => {
      const next = editor.view.save;
      if (reopensNotices(said, next)) show();
      said = next;
    });
  }, [editor, show]);
}

/** The notices' controls from the shell's state, the same object while the flag is unchanged. */
export function useNoticesControls(
  shell: Pick<ShellControls, 'noticesHidden' | 'hideNotices' | 'showNotices'>,
): NoticesControls {
  const { noticesHidden: hidden, hideNotices: onHide, showNotices: onShow } = shell;
  useNoticesReopening(onShow);
  return useMemo(() => ({ hidden, onHide, onShow }), [hidden, onHide, onShow]);
}
