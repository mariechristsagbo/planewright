import { expect, test } from '@playwright/test';

import { button, expectIndicator, openPage } from './a11y.ts';
import { settled } from './motion.ts';
import { canvas } from './support.ts';

// About this build (ADR 0012, D5, issue #55's A6): the persistent Pre-release tag opens a modal
// dialog that holds what P0's page said around the editor. The focus lands on Close and Tab wraps
// inside; Escape and a press on the scrim close it, and the focus goes back to the tag.

const SENTENCE =
  'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.';

test('A6 the Pre-release tag opens About this build, which holds the sentence, both regions, the protocol and MIT line, the independence note and the source link', async ({
  page,
}) => {
  await openPage(page);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await button(page, 'Pre-release').click();
  const about = page.getByRole('dialog', { name: 'About this build' });
  await expect(about).toBeVisible();
  await expect(about.getByText(SENTENCE, { exact: true })).toBeVisible();
  await expect(about.getByRole('region', { name: 'Not implemented yet' })).toContainText(
    'Behavioural investigation comes before feature work.',
  );
  await expect(about.getByRole('region', { name: 'What this build contains' })).toContainText(
    'Saving in this browser',
  );
  await expect(about).toContainText(/Protocol version \d+ \(pre-release\)\. MIT licensed\./u);
  await expect(about).toContainText(
    'Planewright is an independent project and is not affiliated with Excalidraw.',
  );
  await expect(about.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/mariechristsagbo/planewright',
  );
});

test('A6 REQ-Y02 the focus lands on Close and Tab wraps inside; Escape closes About and gives the focus back to the tag', async ({
  page,
}) => {
  await openPage(page);
  const tag = button(page, 'Pre-release');
  await tag.focus();
  await page.keyboard.press('Enter');
  const about = page.getByRole('dialog', { name: 'About this build' });
  const close = about.getByRole('button', { name: 'Close' });
  const link = about.getByRole('link', { name: 'Source on GitHub' });
  await expect(close).toBeFocused();
  await expectIndicator(page);
  for (const stop of [link, close, link]) {
    await page.keyboard.press('Tab');
    await expect(stop).toBeFocused();
  }
  for (const stop of [close, link]) {
    await page.keyboard.press('Shift+Tab');
    await expect(stop).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expect(tag).toBeFocused();
});

test('A6 REQ-Y02 a press on the scrim closes About and gives the focus back to the tag; a press inside keeps it open', async ({
  page,
}) => {
  await openPage(page);
  const tag = button(page, 'Pre-release');
  await tag.click();
  const about = page.getByRole('dialog', { name: 'About this build' });
  await about.getByRole('heading', { name: 'About this build' }).click();
  await expect(about).toBeVisible();
  await settled(page);
  const box = await about.boundingBox();
  if (box === null) throw new Error('About this build is not laid out.');
  await page.mouse.click(box.x + box.width / 2, Math.max(2, box.y / 2));
  await expect(about).toHaveCount(0);
  await expect(tag).toBeFocused();
  await tag.click();
  await about.getByRole('button', { name: 'Close' }).click();
  await expect(about).toHaveCount(0);
  await expect(tag).toBeFocused();
});

test('A6 REQ-Y02 closing About gives the focus to the tag even when the press that opened it did not focus the tag', async ({
  page,
}) => {
  await openPage(page);
  const tag = button(page, 'Pre-release');
  // Some browsers, Safari among them, do not focus a button that a click presses, so the focus can
  // still be on the canvas when About opens.
  await canvas(page).focus();
  await page.evaluate(
    "document.querySelector('[aria-haspopup=\"dialog\"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))",
  );
  const about = page.getByRole('dialog', { name: 'About this build' });
  await expect(about.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expect(tag).toBeFocused();
});
