import type { Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';

/**
 * One element's state before and after an applied change set: absent before an addition and
 * after a removal. The store hands these to its indexes, which update for these elements only.
 */
export interface ElementDelta {
  readonly id: ElementId;
  readonly before: Element | undefined;
  readonly after: Element | undefined;
}
