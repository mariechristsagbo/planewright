import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { watchTooltips } from './tooltip-events.ts';

/** The tip's distance from its control, and its least distance from the window's edges, in px. */
const GAP = 8;
const MARGIN = 8;

/** Puts a tip under its control, or over it when the window has no room below, inside the window. */
function place(tip: HTMLElement, control: HTMLElement): void {
  const box = control.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = tip;
  const below = box.bottom + GAP;
  const top = below + height + MARGIN > window.innerHeight ? box.top - GAP - height : below;
  const centred = box.left + box.width / 2 - width / 2;
  const left = Math.max(MARGIN, Math.min(centred, window.innerWidth - width - MARGIN));
  tip.style.top = `${String(Math.round(top))}px`;
  tip.style.left = `${String(Math.round(left))}px`;
}

/**
 * The chrome's one tooltip (ADR 0012 and the v0.2 plan's S3): the name and keys of the control that
 * the pointer rests on or the keyboard focuses, from the control's data-chrome-tip and
 * data-chrome-keys, which repeat its name and the keys that its aria-keyshortcuts and description
 * give. It is a tooltip, a description, but no control points to it, so that each control keeps
 * its own name and description and a screen reader never hears them twice; presses go through it.
 */
export function Tooltip({ root }: { readonly root: RefObject<HTMLElement | null> }) {
  const [control, setControl] = useState<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    return element === null ? undefined : watchTooltips(element, setControl);
  }, [root]);
  useLayoutEffect(() => {
    if (control !== null && tip.current !== null) place(tip.current, control);
  }, [control]);
  const keys = control?.dataset['chromeKeys']?.split(' or ') ?? [];
  return (
    <div ref={tip} id="chrome-tip" role="tooltip" className="chrome-tip" hidden={control === null}>
      <span className="chrome-tip-name">{control?.dataset['chromeTip']}</span>
      {keys.map((key, index) => (
        <Fragment key={key}>
          {index > 0 ? <span>or</span> : null}
          <kbd>{key}</kbd>
        </Fragment>
      ))}
    </div>
  );
}
