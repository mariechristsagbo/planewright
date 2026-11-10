import { expect, test } from '@playwright/test';

import { openPage } from './a11y.ts';
import { canvas } from './support.ts';
import { textArea } from './text.ts';

// The chrome's type (ADR 0012, decision 8, and the v0.2 plan's S1): 500 is the chrome's only
// emphasis weight, so that no browser synthesises a bold, and the text area keeps the canvas's
// Planewright Sans at 400. Page code is written as strings, since these files compile without the
// DOM library.

/** Each element of the page by its tag and class, with its computed weight and family. */
const FONTS = `[...document.querySelectorAll('body, body *')].map((element) => {
  const kind = element.getAttribute('class');
  const { fontWeight, fontFamily } = getComputedStyle(element);
  const name = element.tagName.toLowerCase() + (kind ? '.' + kind : '');
  return { name, weight: fontWeight, family: fontFamily };
})`;

interface Font {
  readonly name: string;
  readonly weight: string;
  readonly family: string;
}

test('D3 every element computes 400 or 500, and the text area keeps Planewright Sans at 400', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 't', 'Enter']) await page.keyboard.press(key);
  await expect(textArea(page)).toBeFocused();
  const fonts = await page.evaluate<Font[]>(FONTS);
  expect(fonts.length).toBeGreaterThan(40);
  expect(fonts.filter(({ weight }) => weight !== '400' && weight !== '500')).toEqual([]);
  const emphasis = fonts.filter(({ name }) => /^(h1|h2|dt|p\.status)$/u.test(name));
  expect(emphasis.length).toBeGreaterThan(5);
  expect(new Set(emphasis.map(({ weight }) => weight))).toEqual(new Set(['500']));
  expect(fonts.find(({ name }) => name === 'textarea.text-editor')).toEqual({
    name: 'textarea.text-editor',
    weight: '400',
    family: '"Planewright Sans", sans-serif',
  });
});
