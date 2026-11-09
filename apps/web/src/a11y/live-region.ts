import type { Scheduler } from '@planewright/engine';

// The live region (docs/architecture/engine/quality.md#accessibility, REQ-Y04): one polite region,
// and an assertive one for failed and stale saves and the start-up storage notices. Both are in the
// page from start-up, before anything is said, since assistive technology may miss a region that
// appears with its message; and each is emptied before its next message is written, so that a
// repeated message is announced again.

export type Urgency = 'polite' | 'assertive';

export interface LiveRegion {
  /** Says a message: the region empties at once and holds the message after a short pause. */
  say(text: string, urgency: Urgency): void;
}

/** How long a region stays empty before its message is written. */
export const SAY_DELAY_MS = 100;

/** A visually hidden region, `live-polite` or `live-assertive`, at the end of the page's body. */
function regionOf(document: Document, urgency: Urgency): HTMLElement {
  const region = document.createElement('div');
  region.id = `live-${urgency}`;
  region.className = 'visually-hidden';
  region.setAttribute('aria-live', urgency);
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  return region;
}

export function createLiveRegion(document: Document, timers: Pick<Scheduler, 'after'>): LiveRegion {
  const regions = {
    polite: regionOf(document, 'polite'),
    assertive: regionOf(document, 'assertive'),
  };
  const waiting = new Map<Urgency, () => void>();
  return {
    say(text, urgency) {
      const region = regions[urgency];
      waiting.get(urgency)?.();
      region.textContent = '';
      const cancel = timers.after(SAY_DELAY_MS, () => {
        waiting.delete(urgency);
        region.textContent = text;
      });
      waiting.set(urgency, cancel);
    },
  };
}
