import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openPage } from './a11y.ts';
import { canvas } from './support.ts';
import { textArea } from './text.ts';

// The chrome's type (ADR 0012, decision 8, and the v0.2 plan's S1): the chrome is set in Planewright
// UI, Inter at 400 and 500, whose 400 face shares the canvas's file, so that file is downloaded
// once; 500 is the only emphasis weight, so that no browser synthesises a bold; and the text area
// keeps the canvas's Planewright Sans at 400. Page code is written as strings, since these files
// compile without the DOM library.

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
  expect(fonts.find(({ name }) => name === 'textarea.text-editor')).toEqual({
    name: 'textarea.text-editor',
    weight: '400',
    family: '"Planewright Sans", sans-serif',
  });
  // The headings and terms that P0's page showed are in About this build now (ADR 0012, D5).
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pre-release' }).click();
  await expect(page.getByRole('dialog', { name: 'About this build' })).toBeVisible();
  const opened = await page.evaluate<Font[]>(FONTS);
  expect(opened.filter(({ weight }) => weight !== '400' && weight !== '500')).toEqual([]);
  const emphasis = opened.filter(({ name }) => /^(h1|h2|h3|dt)(\.|$)/u.test(name));
  expect(emphasis.length).toBeGreaterThan(5);
  expect(new Set(emphasis.map(({ weight }) => weight))).toEqual(new Set(['500']));
});

/** The faces that have loaded, as their family and weight. */
const LOADED = `[...document.fonts]
  .filter((face) => face.status === 'loaded')
  .map((face) => face.family.replaceAll('"', '') + ' ' + face.weight)`;

/** The fonts that Chromium draws an element's own text with, as their files name them. */
async function renderedFonts(page: Page, selector: string) {
  const client = await page.context().newCDPSession(page);
  await client.send('DOM.enable');
  await client.send('CSS.enable');
  const { root } = await client.send('DOM.getDocument');
  const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await client.send('CSS.getPlatformFontsForNode', { nodeId });
  await client.detach();
  return fonts.map(({ familyName, isCustomFont }) => ({ familyName, isCustomFont }));
}

test('D3 the chrome computes Planewright UI first and is drawn in Inter at 400 and 500', async ({
  page,
}) => {
  await openPage(page);
  const family = await page.evaluate<string>(
    'getComputedStyle(document.querySelector(\'[role="toolbar"] button\')).fontFamily',
  );
  expect(family).toMatch(/^"Planewright UI", /u);
  await expect
    .poll(() => page.evaluate<string[]>(LOADED))
    .toEqual(expect.arrayContaining(['Planewright UI 400', 'Planewright UI 500']));
  // The islands set their buttons in the text buttons' 500 and the view readout in 400 (ADR 0012).
  expect(await renderedFonts(page, '#view-readout')).toEqual([
    { familyName: 'Inter', isCustomFont: true },
  ]);
  expect(await renderedFonts(page, '[role="toolbar"] button')).toEqual([
    { familyName: 'Inter Medium', isCustomFont: true },
  ]);
  expect(await renderedFonts(page, 'h1')).toEqual([
    { familyName: 'Inter Medium', isCustomFont: true },
  ]);
});

test('D3 Chromium requests the Inter 400 file once, for the canvas and the chrome alike', async ({
  page,
}) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/fonts/')) requested.push(pathname);
  });
  await openPage(page);
  await expect
    .poll(() => page.evaluate<string[]>(LOADED))
    .toEqual(
      expect.arrayContaining(['Planewright Sans 400', 'Planewright UI 400', 'Planewright UI 500']),
    );
  expect(requested.sort()).toEqual([
    '/fonts/inter-latin-400-normal.woff2',
    '/fonts/inter-latin-500-normal.woff2',
    '/fonts/jetbrains-mono-latin-400-normal.woff2',
    '/fonts/patrick-hand-latin-400-normal.woff2',
  ]);
});
