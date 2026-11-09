import type { SaveFailure, SaveStatus as Status } from '@planewright/engine';

import { useEditorView, useSurface } from '../editor/surface.ts';

// What the page says about saving (docs/architecture/engine/persistence.md): whether the drawing
// is saved in this browser, and the notices for failed, stale, unavailable and invalid storage
// (REQ-P05, REQ-P06, REQ-P07). Failures and choices are alerts; the status is plain text.

const FAILURES: Readonly<Record<SaveFailure, string>> = {
  quota: 'the browser’s storage for this page is full',
  unavailable: 'the browser’s storage cannot be reached',
  failed: 'the browser’s storage did not take the change',
};

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

/** The two answers to another tab's newer save. */
function StaleNotice() {
  const { editor } = useSurface();
  return (
    <div role="alert" className="notice">
      <p>
        Another tab saved a newer version of this drawing, so this tab stopped saving. Load the
        newer version, which drops this tab’s unsaved changes and its undo history, or keep this
        version, which replaces the other one.
      </p>
      <div className="notice-actions">
        <button type="button" onClick={() => void editor.resolveStale('load')}>
          Load the newer version
        </button>
        <button type="button" onClick={() => void editor.resolveStale('keep')}>
          Keep this version
        </button>
      </div>
    </div>
  );
}

/** The notices about storage, below the canvas so that they never move it. */
export function StorageNotices() {
  const { storageNotice } = useSurface();
  const { save } = useEditorView();
  return (
    <div className="notices">
      {storageNotice === 'unavailable' ? (
        <p role="alert" className="notice">
          Saving is unavailable in this browser: the drawing stays in this tab only and is lost when
          the tab closes.
        </p>
      ) : null}
      {storageNotice === 'invalid' ? (
        <p role="alert" className="notice">
          The drawing saved in this browser could not be read, so a new drawing was opened. The
          saved data is left unchanged.
        </p>
      ) : null}
      {save?.type === 'failed' ? (
        <p role="alert" className="notice">
          Saving failed: {FAILURES[save.reason]}. Your changes are kept in this tab, and saving is
          tried again.
        </p>
      ) : null}
      {save?.type === 'stale' ? <StaleNotice /> : null}
    </div>
  );
}
