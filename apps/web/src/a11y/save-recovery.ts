import type { SaveStatus } from '@planewright/engine';
import { useEffect } from 'react';

import { useSurface } from '../editor/surface.ts';

// The one sentence the web app says about saving (ADR 0012, decision 12; the v0.2 plan's S7): after
// a failed save, the next save that succeeds says so in the polite live region, once. Routine saves
// say nothing, and the engine's announcements, which say a failure and a stale save, are unchanged.

/** The sentence, the ADR's words. */
export const RECOVERY_TEXT = 'The drawing is saved again.';

/** Whether a failure is remembered after a status, and whether that status says the sentence. */
export interface RecoveryStep {
  readonly failed: boolean;
  readonly say: boolean;
}

/**
 * One status's step: a failure is remembered through further failures, whatever their reason, and
 * through pending saves; the next saved status says the sentence and forgets it. A stale save or no
 * storage forgets it too, so that Keep, Load or a failure that turned stale say nothing.
 */
export function recoveryStep(failed: boolean, save: SaveStatus | null): RecoveryStep {
  switch (save?.type) {
    case 'failed':
      return { failed: true, say: false };
    case 'pending':
      return { failed, say: false };
    case 'saved':
      return { failed: false, say: failed };
    case 'stale':
    case undefined:
      return { failed: false, say: false };
  }
}

/**
 * Says the sentence when a failed save succeeds again. It follows every view the editor publishes,
 * not what React renders, so that no status between two renders is missed; it renders nothing.
 */
export function useSaveRecovery(): void {
  const { editor, live } = useSurface();
  useEffect(() => {
    let failed = editor.view.save?.type === 'failed';
    return editor.subscribe(() => {
      const step = recoveryStep(failed, editor.view.save);
      failed = step.failed;
      if (step.say) live.say(RECOVERY_TEXT, 'polite');
    });
  }, [editor, live]);
}
