import { expect, test } from '@playwright/test';

import { button, elementList, openPage, polite, textContrasts } from './a11y.ts';
import { canvas, readout } from './support.ts';

// Colour and motion on a desktop (ENG-14, docs/architecture/engine/quality.md#accessibility,
// REQ-Y06): every interface text meets 4.5:1 against what is behind it in the light theme, the
// only P0 theme, and with reduced motion requested a zoom shows its new view at once.

test('E4 A10 REQ-Y06 every interface text meets 4.5:1 contrast in the light theme', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(elementList(page).getByRole('option')).toHaveCount(2);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  const contrasts = await textContrasts(page);
  expect(contrasts.length).toBeGreaterThan(40);
  expect(contrasts.map(({ text }) => text)).toEqual(
    expect.arrayContaining(['Undo', 'Rectangle', 'Zoom in', 'Elements']),
  );
  expect(contrasts.filter(({ ratio }) => ratio < 4.5)).toEqual([]);
});

test.describe('with reduced motion requested', () => {
  test.use({ reducedMotion: 'reduce' });

  test('E4 A11 REQ-Y06 a zoom changes the view in one step, and nothing animates', async ({
    page,
  }) => {
    await openPage(page);
    expect(await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")).toBe(
      true,
    );
    const frames = await page.evaluate<string[]>(`new Promise((resolve) => {
      const seen = [];
      document.querySelector('[aria-label="Zoom"] button:nth-of-type(3)').click();
      const sample = () => {
        seen.push(document.getElementById('view-readout').textContent);
        if (seen.length < 10) requestAnimationFrame(sample); else resolve(seen);
      };
      requestAnimationFrame(sample);
    })`);
    const [zoomed] = frames;
    expect([new Set(frames).size, zoomed]).toEqual([1, expect.stringMatching(/, zoom 110%$/u)]);
    await button(page, 'Reset zoom').click();
    await expect(readout(page)).toHaveText(/, zoom 100%$/u);
    expect(await page.evaluate('document.getAnimations().length')).toBe(0);
  });
});
