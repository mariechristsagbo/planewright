import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { canvas } from './support.ts';

// Readings for the accessibility end-to-end tests (ENG-14, docs/architecture/engine/quality.md):
// the live region, the element list, focus indicators and contrast. Page code is written as
// strings, since these files compile without the DOM library.

/** The polite live region, which says selections, changes, undo and redo (REQ-Y04). */
export const polite = (page: Page): Locator => page.locator('#live-polite');

export const elementList = (page: Page): Locator => page.getByRole('listbox', { name: 'Elements' });

export const button = (page: Page, name: string): Locator =>
  page.getByRole('button', { name, exact: true });

/** Opens the page and waits until the canvas is there. */
export async function openPage(page: Page): Promise<void> {
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
}

/** sRGB channels from a computed colour such as "rgb(42, 98, 208)" or "rgba(0, 0, 0, 0)". */
export function channels(colour: string): number[] {
  const values = /rgba?\(([^)]+)\)/u.exec(colour)?.[1]?.split(',').map(Number);
  if (values === undefined || values.length < 3) throw new Error(`Not a colour: ${colour}`);
  return values;
}

const luminance = (colour: readonly number[]): number => {
  const [r = 0, g = 0, b = 0] = colour.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG contrast ratio of two opaque colours. */
export function contrast(a: readonly number[], b: readonly number[]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** The focused element's outline, and the opaque background around it. */
const INDICATOR = `(() => {
  const element = document.activeElement;
  const style = getComputedStyle(element);
  let behind = element.parentElement;
  const clear = (colour) => colour === 'transparent' || /rgba\\(.*, 0\\)$/.test(colour);
  while (behind !== null && clear(getComputedStyle(behind).backgroundColor)) behind = behind.parentElement;
  const background = getComputedStyle(behind ?? document.documentElement).backgroundColor;
  return { style: style.outlineStyle, width: parseFloat(style.outlineWidth), colour: style.outlineColor, background };
})()`;

interface Indicator {
  readonly style: string;
  readonly width: number;
  readonly colour: string;
  readonly background: string;
}

/** The focused element shows a solid indicator of at least 2 px with 3:1 contrast (REQ-Y02). */
export async function expectIndicator(page: Page): Promise<void> {
  const { style, width, colour, background } = await page.evaluate<Indicator>(INDICATOR);
  expect(style).toBe('solid');
  expect(width).toBeGreaterThanOrEqual(2);
  expect(contrast(channels(colour), channels(background))).toBeGreaterThanOrEqual(3);
}

/**
 * Every visible element that holds text of its own, outside the canvas and the text area, with its
 * text colour blended by its alpha and its ancestors' opacity over the opaque background behind it.
 */
const TEXTS = `(() => {
  const parse = (colour) => (colour.match(/[\\d.]+/g) || []).map(Number);
  const clear = (colour) => { const v = parse(colour); return v.length === 4 && v[3] === 0; };
  const backgroundOf = (element) => {
    for (let at = element; at !== null; at = at.parentElement) {
      const colour = getComputedStyle(at).backgroundColor;
      if (!clear(colour)) return parse(colour).slice(0, 3);
    }
    return [255, 255, 255];
  };
  const opacityOf = (element) => {
    let opacity = 1;
    for (let at = element; at !== null; at = at.parentElement) opacity *= Number(getComputedStyle(at).opacity);
    return opacity;
  };
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 1 && box.height > 1 && getComputedStyle(element).visibility !== 'hidden';
  };
  const texts = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS'].includes(element.tagName)) continue;
    const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim() !== '');
    if (!own || !shown(element)) continue;
    const [r, g, b, a = 1] = parse(getComputedStyle(element).color);
    const alpha = a * opacityOf(element);
    const background = backgroundOf(element);
    const text = [r, g, b].map((channel, index) => channel * alpha + background[index] * (1 - alpha));
    const words = [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join('');
    texts.push({ text: words.trim().slice(0, 40), colour: text, background });
  }
  return texts;
})()`;

interface Text {
  readonly text: string;
  readonly colour: number[];
  readonly background: number[];
}

/** The page's visible interface texts with their contrast against what is behind them. */
export async function textContrasts(page: Page): Promise<{ text: string; ratio: number }[]> {
  const texts = await page.evaluate<Text[]>(TEXTS);
  return texts.map(({ text, colour, background }) => ({
    text,
    ratio: Math.round(contrast(colour, background) * 100) / 100,
  }));
}

/** The boxes of every control that a finger can press, by role and name. */
const TARGETS = `(() => {
  const selector = 'button, a[href], [role="option"], [role="listbox"], [tabindex="0"], textarea';
  return [...document.querySelectorAll(selector)]
    .filter((element) => element.getBoundingClientRect().width > 0)
    .map((element) => {
      const box = element.getBoundingClientRect();
      const name = element.getAttribute('aria-label') ?? element.textContent.trim().slice(0, 30);
      return { name: element.tagName.toLowerCase() + ' ' + name, width: box.width, height: box.height };
    });
})()`;

export interface Target {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export const targets = (page: Page): Promise<Target[]> => page.evaluate<Target[]>(TARGETS);
