import type { SaveStatus as Status } from '@planewright/engine';
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';

import { focusCanvas } from '../a11y/focus.ts';
import { useSurface, useViewValue } from '../editor/surface.ts';
import { Icon } from '../shell/icons.tsx';
import { STALE_TEXT, STORAGE_NOTICE_TEXTS, failedText } from './notices.ts';
import { hasNotices, problemChipOf } from './save-problem.ts';
import type { ProblemChip } from './save-problem.ts';
import type { NoticesControls } from './use-notices.ts';

// What the page shows of saving (ADR 0012, decision 12, D7; docs/architecture/engine/
// persistence.md): nothing while saving works; while storage needs attention a "Not saved" chip in
// the top-right island and the notices with P0's words under it (REQ-P05, REQ-P06, REQ-P07). The
// notices are no alerts: the live region says them (REQ-Y04). Hide folds them into the chip, which
// becomes a button that reopens them. Both read view.save through a selector, so a pan step renders
// neither (decision 14).

/** The notices' identifier, which the chip's button controls. */
const NOTICES_ID = 'notices';
const HIDE_ID = 'hide-notices';
const CHIP_ID = 'save-status';

/** Focuses an element by its identifier, without scrolling the page. */
const focusById = (id: string): void => {
  document.getElementById(id)?.focus({ preventScroll: true });
};

/**
 * Moves the focus off a control that leaves the page with it, as when the problem clears or a new
 * failure reopens the notices under the chip's button: to the shown notices' Hide, or else to the
 * canvas, never to the body (REQ-Y02). The cleanup runs while the control is still in the page.
 */
function useFocusKept(control: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = control.current;
    return () => {
      if (element?.contains(document.activeElement) !== true) return;
      focusCanvas(document);
      const hide = document.getElementById(HIDE_ID);
      if (hide !== element && hide?.closest('[hidden]') === null) hide.focus();
    };
  }, [control]);
}

/** The chip's glyph and words; the words are visually hidden in phone landscape. */
function ChipContent({ chip }: { readonly chip: ProblemChip }) {
  return (
    <>
      <Icon name={chip.glyph} size={16} />
      <span className="problem-chip-words">{chip.words}</span>
    </>
  );
}

/** The chip once the notices are hidden: a collapsed button that reopens them, with Hide focused. */
function ChipButton({ chip, onShow }: { readonly chip: ProblemChip; readonly onShow: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useFocusKept(button);
  return (
    <button
      ref={button}
      id={CHIP_ID}
      type="button"
      className={`problem-chip tone-${chip.tone}`}
      aria-expanded="false"
      aria-controls={NOTICES_ID}
      onClick={() => {
        flushSync(onShow);
        focusById(HIDE_ID);
      }}
    >
      <ChipContent chip={chip} />
      <span className="problem-chip-chevron">
        <Icon name="chevron-down" size={16} />
      </span>
    </button>
  );
}

/**
 * The problem chip, in the top-right island before Elements with a hairline, only while storage
 * needs attention: a paragraph while its notices show, and a button once they are hidden.
 */
export function StorageProblemChip({ controls }: { readonly controls: NoticesControls }) {
  const { storageNotice } = useSurface();
  const save = useViewValue((view) => view.save);
  const chip = problemChipOf(save, storageNotice, controls.hidden);
  if (chip === null) return null;
  const folded = controls.hidden && hasNotices(save, storageNotice);
  return (
    <>
      {folded ? (
        <ChipButton chip={chip} onShow={controls.onShow} />
      ) : (
        <p id={CHIP_ID} className={`problem-chip tone-${chip.tone}`}>
          <ChipContent chip={chip} />
        </p>
      )}
      <span className="island-divider" aria-hidden="true" />
    </>
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
    <div role="group" aria-labelledby="stale-notice" className="notice tone-warning">
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
  if (save?.type === 'failed') {
    return <p className="notice tone-error">{failedText(save.reason)}</p>;
  }
  return save?.type === 'stale' ? <StaleNotice /> : null;
}

/** Hide, the notices' last control, which folds them into the chip with the focus on its button. */
function HideButton({ onHide }: { readonly onHide: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useFocusKept(button);
  return (
    <button
      ref={button}
      id={HIDE_ID}
      type="button"
      className="notices-hide"
      aria-label="Hide storage notices"
      onClick={() => {
        flushSync(onHide);
        focusById(CHIP_ID);
      }}
    >
      Hide
    </button>
  );
}

/**
 * The notices about storage, over the canvas under the top-right island, while any applies; none
 * while saving works. Hidden, they stay in the page, so that the chip's button controls them.
 */
export function StorageNotices({ controls }: { readonly controls: NoticesControls }) {
  const { storageNotice } = useSurface();
  const save = useViewValue((view) => view.save);
  if (!hasNotices(save, storageNotice)) return null;
  return (
    <section
      id={NOTICES_ID}
      aria-label="Storage notices"
      className="notices"
      hidden={controls.hidden}
    >
      {storageNotice === null ? null : (
        <p className="notice tone-warning">{STORAGE_NOTICE_TEXTS[storageNotice]}</p>
      )}
      <SaveNotice save={save} />
      <div className="notices-foot">
        <HideButton onHide={controls.onHide} />
      </div>
    </section>
  );
}
