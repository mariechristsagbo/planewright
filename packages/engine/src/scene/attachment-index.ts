import type { Element } from '../model/elements.ts';
import type { ElementId } from '../model/ids.ts';
import type { ElementDelta } from './delta.ts';

/**
 * The connectors attached to each element (docs/architecture/engine/scene-and-viewport.md#the-scene-graph).
 * An attachment is held by the connector's end alone, so this is the way back from a target.
 */
export interface AttachmentIndex {
  /** The connectors with an end attached to the target, each once, in no particular order. */
  connectorsOf(target: ElementId): ElementId[];
  update(deltas: readonly ElementDelta[]): void;
}

/** The elements that a connector's ends are attached to. */
function targetsOf(element: Element | undefined): ElementId[] {
  if (element?.kind !== 'arrow') {
    return [];
  }
  return [element.start?.target, element.end?.target].filter((target) => target !== undefined);
}

export function createAttachmentIndex(): AttachmentIndex {
  const byTarget = new Map<ElementId, Set<ElementId>>();
  return {
    connectorsOf: (target) => [...(byTarget.get(target) ?? [])],
    update(deltas) {
      for (const { id, before, after } of deltas) {
        for (const target of targetsOf(before)) {
          const connectors = byTarget.get(target);
          connectors?.delete(id);
          if (connectors?.size === 0) byTarget.delete(target);
        }
        for (const target of targetsOf(after)) {
          byTarget.set(target, (byTarget.get(target) ?? new Set()).add(id));
        }
      }
    },
  };
}
