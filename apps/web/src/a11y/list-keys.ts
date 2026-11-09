// What a key press does in the element list (docs/architecture/engine/quality.md#accessibility,
// REQ-Y05): Up and Down move, Home and End go to the ends, Space toggles the active element in the
// selection and Enter selects it alone, with or without Shift; Alt+arrow keys nudge the selection as
// the arrow keys do on the canvas; Left and Right without Alt do nothing; every other key reaches
// the editor's keymap, so that Delete, Escape, Undo and Redo work there too.

/** The parts of a key press that the list reads. */
export interface ListKey {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export type ListAction =
  | { readonly type: 'move'; readonly to: number }
  | { readonly type: 'toggle' | 'only' | 'nudge' | 'forward' | 'none' };

const STEPS: Readonly<Partial<Record<string, number>>> = { ArrowUp: -1, ArrowDown: 1 };

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Whether a key press has no modifier but Shift, which the list's own keys ignore. */
const plain = ({ altKey, ctrlKey, metaKey }: ListKey): boolean => !altKey && !ctrlKey && !metaKey;

/** A move to a position in a list of `count` options, kept within it. */
function moveTo(position: number, count: number): ListAction {
  return count === 0
    ? { type: 'none' }
    : { type: 'move', to: Math.min(count - 1, Math.max(0, position)) };
}

/** What a plain key does at a position, if it is one of the list's own keys. */
function plainAction(key: string, position: number, count: number): ListAction | undefined {
  const step = STEPS[key];
  if (step !== undefined) return moveTo(position + step, count);
  if (key === 'Home') return moveTo(0, count);
  if (key === 'End') return moveTo(count - 1, count);
  if (key === ' ' || key === 'Enter')
    return count === 0 ? { type: 'none' } : { type: key === ' ' ? 'toggle' : 'only' };
  return key === 'ArrowLeft' || key === 'ArrowRight' ? { type: 'none' } : undefined;
}

export function listAction(event: ListKey, position: number, count: number): ListAction {
  if (ARROWS.has(event.key) && event.altKey && !event.ctrlKey && !event.metaKey) {
    return { type: 'nudge' };
  }
  const own = plain(event) ? plainAction(event.key, position, count) : undefined;
  return own ?? { type: 'forward' };
}
