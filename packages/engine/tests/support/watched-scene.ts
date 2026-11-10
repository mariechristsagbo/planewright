import type { Element } from '../../src/model/elements.ts';
import type { ElementId } from '../../src/model/ids.ts';
import type { SceneReader, SceneStore } from '../../src/scene/store.ts';

// What a query reads of a scene's elements, for the tests of box selection's kept rows
// (docs/architecture/engine/rendering-and-hit-testing.md#what-issue-35-decided).

/**
 * A reader of the store whose elements count, by element, the fields read from them, and which
 * counts its box queries.
 */
export function watched(store: SceneStore) {
  const reads = new Map<ElementId, number>();
  const queries = { box: 0 };
  const proxies = new WeakMap<Element, Element>();
  const watch = (element: Element): Element => {
    const known = proxies.get(element);
    if (known !== undefined) return known;
    const proxy = new Proxy(element, {
      get(target, key, receiver) {
        reads.set(target.id, (reads.get(target.id) ?? 0) + 1);
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    proxies.set(element, proxy);
    return proxy;
  };
  let source: readonly Element[] = [];
  let ordered: readonly Element[] = [];
  const reader: SceneReader = {
    ...store,
    get rev() {
      return store.rev;
    },
    ordered() {
      if (store.ordered() !== source) {
        source = store.ordered();
        ordered = source.map(watch);
      }
      return ordered;
    },
    get: (id) => {
      const element = store.get(id);
      return element === undefined ? undefined : watch(element);
    },
    queryBox: (box) => {
      queries.box += 1;
      return store.queryBox(box);
    },
  };
  return { reader, reads, queries };
}
