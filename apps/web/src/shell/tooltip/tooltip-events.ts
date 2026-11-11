// The chrome's tooltips' events (ADR 0012 and the v0.2 plan's S3), delegated rather than one
// listener per control: the shell's root follows the pointer and the focus for every control that
// names a tip, and its document follows the keys, so that Escape closes a tip wherever the focus
// is. A tip opens after the hover delay, at once on keyboard focus and never on touch, and closes
// on Escape, on a press and when the pointer or the focus leaves its control. The Escape that
// closes a tip does nothing else.

/** The delay without the --pw-delay-tooltip token, as in a page without its style sheets. */
const DELAY_MS = 500;

/** The control whose tip an event's target is in: the element that names a tip. */
export const tipControlOf = (node: EventTarget | null): HTMLElement | null =>
  node instanceof Element ? node.closest<HTMLElement>('[data-chrome-tip]') : null;

/**
 * How long the pointer rests on a control before its tip opens, from tokens.css, in milliseconds or
 * seconds, as the built style sheet may write it, such as ".5s".
 */
export function hoverDelay(root: HTMLElement): number {
  const value = getComputedStyle(root).getPropertyValue('--pw-delay-tooltip').trim();
  const match = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/u.exec(value);
  if (match === null) return DELAY_MS;
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

/**
 * Keeps the Escape that closes a showing tip from doing anything else, as in the APG's tooltip
 * pattern: the editor's keymap, where Escape cancels, hears only the next one.
 */
const stop = (event: KeyboardEvent): void => {
  event.stopPropagation();
  event.preventDefault();
};

interface Tips {
  /** The control whose tip shows. */
  shown: HTMLElement | null;
  /** The control the pointer rests on, before its tip opens. */
  waiting: HTMLElement | null;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** Whether the last input was a press, whose focus opens no tip. */
  pressed: boolean;
  /** The control under the mouse or pen, if it names a tip. */
  under: HTMLElement | null;
  /** The control under the pointer whose tip a press or Escape closed, until the pointer leaves. */
  dismissed: HTMLElement | null;
}

/** The tips' state, and what opens a control's tip, or none, at once, giving it to show. */
function tipsOf(show: (control: HTMLElement | null) => void) {
  const tips: Tips = {
    shown: null,
    waiting: null,
    timer: undefined,
    pressed: false,
    under: null,
    dismissed: null,
  };
  const stopWaiting = (): void => {
    clearTimeout(tips.timer);
    tips.timer = undefined;
    tips.waiting = null;
  };
  const open = (control: HTMLElement | null): void => {
    stopWaiting();
    if (tips.shown === control) return;
    tips.shown = control;
    show(control);
  };
  return { tips, stopWaiting, open };
}

type TipsState = ReturnType<typeof tipsOf>;

/** The pointer's handlers: resting on a control, leaving it and pressing. */
function pointerHandlers(root: HTMLElement, { tips, stopWaiting, open }: TipsState) {
  const hover = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    const control = tipControlOf(event.target);
    tips.under = control;
    if (control === null || [tips.shown, tips.waiting, tips.dismissed].includes(control)) return;
    stopWaiting();
    tips.waiting = control;
    tips.timer = setTimeout(() => {
      open(control);
    }, hoverDelay(root));
  };
  const leave = (event: PointerEvent): void => {
    const control = tipControlOf(event.target);
    const to = event.relatedTarget;
    if (control === null || (to instanceof Node && control.contains(to))) return;
    if (tips.under === control) tips.under = null;
    if (tips.dismissed === control) tips.dismissed = null;
    if (tips.waiting === control) stopWaiting();
    if (tips.shown === control) open(null);
  };
  const press = (event: PointerEvent): void => {
    tips.pressed = true;
    tips.dismissed = tipControlOf(event.target);
    open(null);
  };
  return { hover, leave, press };
}

/**
 * The focus's and the keys' handlers. Escape keeps closed only the tip of the control under the
 * pointer, whose next hover would open it again, and never a focus tip's control elsewhere.
 */
function keyHandlers({ tips, open }: TipsState) {
  const focus = (event: FocusEvent): void => {
    const control = tipControlOf(event.target);
    if (!tips.pressed && control !== null) open(control);
  };
  const blur = (event: FocusEvent): void => {
    if (tipControlOf(event.target) === tips.shown) open(null);
  };
  const key = (event: KeyboardEvent): void => {
    tips.pressed = false;
    if (event.key !== 'Escape') return;
    if (tips.shown !== null) stop(event);
    tips.dismissed = tips.under;
    open(null);
  };
  return { focus, blur, key };
}

/**
 * Follows the events that open and close tips: one listener of each kind on the shell's root, and
 * one for the keys on its document, ahead of the controls' own, so that a key that moves the focus
 * counts before the focus moves. Gives a function that removes them.
 */
export function watchTooltips(
  root: HTMLElement,
  show: (control: HTMLElement | null) => void,
): () => void {
  const state = tipsOf(show);
  const { hover, leave, press } = pointerHandlers(root, state);
  const { focus, blur, key } = keyHandlers(state);
  const document = root.ownerDocument;
  root.addEventListener('pointerover', hover);
  root.addEventListener('pointerout', leave);
  root.addEventListener('pointerdown', press, true);
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  document.addEventListener('keydown', key, true);
  return () => {
    state.stopWaiting();
    root.removeEventListener('pointerover', hover);
    root.removeEventListener('pointerout', leave);
    root.removeEventListener('pointerdown', press, true);
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', blur);
    document.removeEventListener('keydown', key, true);
  };
}
