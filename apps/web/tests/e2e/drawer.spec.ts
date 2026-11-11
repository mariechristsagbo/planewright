import { expect, test } from '@playwright/test';

import { elementList, elementsToggle, openElements, openPage, polite } from './a11y.ts';
import { canvas } from './support.ts';

// The Elements drawer (ADR 0012, D4 and decision 13, issue #55's A9): the plain Elements toggle
// opens and closes it, it is closed at every load, since the shell's state is never stored, and
// P0's element list keeps its keys inside it (REQ-Y05).

test('A9 D4 the Elements toggle opens and closes the drawer, which is closed after every reload', async ({
  page,
}) => {
  await openPage(page);
  const toggle = elementsToggle(page);
  await expect(toggle).toHaveAccessibleName('Elements');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(elementList(page)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await toggle.click();
  await expect(elementList(page)).toBeVisible();
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
});

test('A9 REQ-Y05 P0’s list keys move, select, nudge and delete inside the open drawer', async ({
  page,
}) => {
  await openPage(page);
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  const list = await openElements(page);
  const options = list.getByRole('option');
  await expect(options).toHaveText([/^Ellipse, /u, /^Rectangle, /u]);
  await list.focus();
  const said = async (key: string, message: string) => {
    await page.keyboard.press(key);
    await expect(polite(page)).toHaveText(message);
  };
  await page.keyboard.press('End');
  await said('Enter', '1 element selected.');
  await expect(options.last()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await said(' ', '2 elements selected.');
  await said('Alt+ArrowRight', 'Nudged 2 elements. 2 elements selected.');
  await said('Delete', 'Deleted 2 elements. Nothing selected.');
  await expect(options).toHaveCount(0);
  await expect(list).toBeFocused();
});
