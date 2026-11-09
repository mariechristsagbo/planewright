import type { Element, ElementId } from '@planewright/engine';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

import { sendKeyDown } from '../editor/attach-input.ts';
import { keyInput } from '../editor/input-adapter.ts';
import { useEditorView, useSurface } from '../editor/surface.ts';
import { elementName } from './element-names.ts';
import { listAction } from './list-keys.ts';

// The element list (docs/architecture/engine/quality.md#accessibility, REQ-Y05): the drawing as a
// list box beside the canvas, one option per drawn element, topmost first. It reads the editor's
// view and selects through `Editor.select`, so the selection is the canvas's, both ways. The list
// box keeps the focus and points at its active option, so a deleted option never takes the focus
// with it; a large drawing renders only the options near the active one.

/** How many options a large drawing renders on each side of the active one. */
export const OPTIONS_AROUND = 50;

/** The element at a position of the list, topmost first. */
const atPosition = (elements: readonly Element[], position: number): Element | undefined =>
  elements[elements.length - 1 - position];

/** Where the active element is now, or, once it is gone, the place it had, kept within the list. */
function positionOf(elements: readonly Element[], active: Active): number {
  const index = elements.findIndex(({ id }) => id === active.id);
  if (index >= 0) return elements.length - 1 - index;
  return Math.max(0, Math.min(elements.length - 1, active.position));
}

interface Active {
  readonly id: ElementId | null;
  readonly position: number;
}

const optionId = (id: ElementId): string => `element-${id}`;

/** The selection with an element added at its end, or taken out. */
const toggled = (selection: readonly ElementId[], id: ElementId): ElementId[] =>
  selection.includes(id) ? selection.filter((each) => each !== id) : [...selection, id];

/** The positions to render: all of them, or for a large drawing those near the active one. */
function shownPositions(count: number, position: number): number[] {
  const most = 2 * OPTIONS_AROUND + 1;
  const first = count > most ? Math.min(count - most, Math.max(0, position - OPTIONS_AROUND)) : 0;
  return Array.from({ length: Math.min(count, most) }, (_, offset) => first + offset);
}

/** The active option and the ways to change it and the selection from the list. */
function useActive(elements: readonly Element[], selection: readonly ElementId[]) {
  const { editor } = useSurface();
  const [active, setActive] = useState<Active>({ id: null, position: 0 });
  const position = positionOf(elements, active);
  const activate = (at: number): void => {
    setActive({ id: atPosition(elements, at)?.id ?? null, position: at });
  };
  const choose = (at: number, toggle: boolean): void => {
    const element = atPosition(elements, at);
    if (element === undefined) return;
    activate(at);
    editor.select(toggle ? toggled(selection, element.id) : [element.id]);
  };
  return { position, current: atPosition(elements, position), activate, choose };
}

interface OptionsProps {
  readonly elements: readonly Element[];
  readonly selection: readonly ElementId[];
  readonly position: number;
  readonly choose: (at: number, toggle: boolean) => void;
}

/** The rendered options, each named, selected or not, with its place in the whole list. */
function Options({ elements, selection, position, choose }: OptionsProps) {
  const selected = new Set(selection);
  return shownPositions(elements.length, position).map((at) => {
    const element = atPosition(elements, at);
    if (element === undefined) return null;
    return (
      <li
        key={element.id}
        id={optionId(element.id)}
        role="option"
        aria-selected={selected.has(element.id)}
        aria-setsize={elements.length}
        aria-posinset={at + 1}
        className={at === position ? 'element-option active' : 'element-option'}
        onClick={(event: MouseEvent) => {
          choose(at, event.shiftKey || event.ctrlKey || event.metaKey);
        }}
      >
        {elementName(element)}
      </li>
    );
  });
}

export function ElementList() {
  const { editor, platform } = useSurface();
  const { elements, selection } = useEditorView();
  const list = useRef<HTMLUListElement>(null);
  const { position, current, activate, choose } = useActive(elements, selection);
  const empty = elements.length === 0;

  useEffect(() => {
    if (current === undefined || document.activeElement !== list.current) return;
    document.getElementById(optionId(current.id))?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    const action = listAction(event, position, elements.length);
    if (action.type === 'forward') {
      sendKeyDown(editor, platform, event);
      return;
    }
    event.preventDefault();
    if (action.type === 'move') activate(action.to);
    else if (action.type === 'toggle' || action.type === 'only') {
      choose(position, action.type === 'toggle');
    }
    // The arrow key without Alt is the canvas's nudge, so a held key's repeats make one undo step.
    else if (action.type === 'nudge')
      sendKeyDown(editor, platform, { ...keyOf(event), altKey: false });
  };

  return (
    <section className="element-list-area" aria-labelledby="element-list-heading">
      <h2 id="element-list-heading" className="element-list-heading">
        Elements
      </h2>
      {empty ? (
        <p id="element-list-empty" className="element-list-help">
          Nothing is drawn yet.
        </p>
      ) : null}
      <p id="element-list-help" className="element-list-help">
        Up and Down move through the elements; Space adds one to the selection or takes it out,
        Enter selects it alone, Delete deletes the selection, and Alt+arrow keys nudge it, by 10
        with Shift.
      </p>
      <ul
        ref={list}
        role="listbox"
        aria-labelledby="element-list-heading"
        aria-describedby={empty ? 'element-list-empty element-list-help' : 'element-list-help'}
        aria-multiselectable="true"
        aria-activedescendant={current === undefined ? undefined : optionId(current.id)}
        tabIndex={0}
        className="element-list"
        onKeyDown={onKeyDown}
        onKeyUp={(event) => {
          editor.input(keyInput('key-up', { ...keyOf(event), altKey: false }, platform));
        }}
      >
        <Options elements={elements} selection={selection} position={position} choose={choose} />
      </ul>
    </section>
  );
}

/** A key press's fields that the input adapter reads, with its own preventDefault. */
function keyOf(event: KeyboardEvent) {
  return {
    key: event.key,
    code: event.code,
    repeat: event.repeat,
    timeStamp: event.timeStamp,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    preventDefault: () => {
      event.preventDefault();
    },
  };
}
