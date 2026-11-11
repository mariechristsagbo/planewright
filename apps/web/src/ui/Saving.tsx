import type { SaveStatus as Status } from '@planewright/engine';

import { focusCanvas } from '../a11y/focus.ts';
import { useEditorView, useSurface } from '../editor/surface.ts';
import { STALE_TEXT, STORAGE_NOTICE_TEXTS, failedText } from './notices.ts';

// What the page says about saving (docs/architecture/engine/persistence.md): whether the drawing
// is saved in this browser, and the notices for failed, stale, unavailable and invalid storage
// (REQ-P05, REQ-P06, REQ-P07). The notices are no alerts: the live region says them (REQ-Y04), and
// it is in the page before they are said, so that a notice shown at start-up is heard too.

function statusText(save: Status | null): string {
  switch (save?.type) {
    case 'saved':
      return 'Saved in this browser';
    case 'pending':
      return 'Saving…';
    case undefined:
    case 'failed':
    case 'stale':
      return 'Not saved';
  }
}

/** Whether the drawing is saved, beside the view readout. */
export function SaveStatus() {
  const { save } = useEditorView();
  return (
    <p id="save-status" className="save-status">
      {statusText(save)}
    </p>
  );
}

/**
 * The two answers to another tab's newer save. An answer gives the focus to the canvas before the
 * notice goes, so that it never falls to the page (the ENG-13 review's m5, REQ-Y02).
 */
function StaleNotice() {
  const { editor } = useSurface();
  const answer = (choice: 'load' | 'keep'): void => {
    focusCanvas(document);
    void editor.resolveStale(choice);
  };
  return (
    <div role="group" aria-labelledby="stale-notice" className="notice">
      <p id="stale-notice">{STALE_TEXT}</p>
      <div className="notice-actions">
        <button
          type="button"
          onClick={() => {
            answer('load');
          }}
        >
          Load the newer version
        </button>
        <button
          type="button"
          onClick={() => {
            answer('keep');
          }}
        >
          Keep this version
        </button>
      </div>
    </div>
  );
}

/** The notice about the last save, if it failed or another tab's newer save refused it. */
function SaveNotice({ save }: { readonly save: Status | null }) {
  if (save?.type === 'failed') return <p className="notice">{failedText(save.reason)}</p>;
  return save?.type === 'stale' ? <StaleNotice /> : null;
}

/** The notices about storage, over the canvas under the top-right island; none while it works. */
export function StorageNotices() {
  const { storageNotice } = useSurface();
  const { save } = useEditorView();
  if (storageNotice === null && save?.type !== 'failed' && save?.type !== 'stale') return null;
  return (
    <section aria-label="Storage notices" className="notices">
      {storageNotice === null ? null : (
        <p className="notice">{STORAGE_NOTICE_TEXTS[storageNotice]}</p>
      )}
      <SaveNotice save={save} />
    </section>
  );
}
