import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
  button,
  elementList,
  elementsToggle,
  expectIndicator,
  openElements,
  openPage,
  polite,
} from './a11y.ts';
import { canvas } from './support.ts';

// The Elements drawer (ADR 0012, D4 and decisions 13 and 14, issues #55 and #66): the Elements
// toggle, which shows the count, opens and closes it, it is closed at every load, since the shell's
// state is never stored, it mounts no list while it is closed, and P0's element list keeps its keys
// inside it (REQ-Y05).

/** How many list boxes and options the page holds, hidden or not. */
const mountedList = (page: Page): Locator => page.locator('[role="listbox"], [role="option"]');

/** The drawer's element, which the toggle controls. */
const drawer = (page: Page): Locator => page.locator('#element-list-drawer');

/** What the page keeps in its storage entries, which must never hold the drawer's state (D4). */
const STORED = `(() => ({
  local: Object.fromEntries(Object.entries(localStorage)),
  session: Object.fromEntries(Object.entries(sessionStorage)),
}))()`;

/** Chromium's own accessible name and description of each node of a role, from its tree. */
async function chromiumNodes(page: Page, role: string) {
  const session = await page.context().newCDPSession(page);
  const { nodes } = (await session.send('Accessibility.getFullAXTree')) as {
    nodes: {
      role?: { value?: string };
      name?: { value?: string };
      description?: { value?: string };
    }[];
  };
  await session.detach();
  return nodes
    .filter((node) => node.role?.value === role)
    .map((node) => ({ name: node.name?.value, description: node.description?.value }));
}

const KEYS =
  'Up and Down move through the elements; Space adds one to the selection or takes it out, Enter selects it alone, Delete deletes the selection, and Alt+arrow keys nudge it, by 10 with Shift.';

test('D2 A7 the keys, folded under their summary, still describe the list box in Chromium’s own tree', async ({
  page,
}) => {
  await openPage(page);
  const list = await openElements(page);
  const summary = page.locator('#element-list-drawer summary');
  const shown = page.locator('#element-list-drawer details').getByText(KEYS);
  await expect(summary).toHaveText('Keys');
  await expect(shown).toBeHidden();
  const described = { name: 'Elements', description: `Nothing is drawn yet. ${KEYS}` };
  expect(await chromiumNodes(page, 'listbox')).toEqual([described]);
  await summary.click();
  await expect(shown).toBeVisible();
  expect(await chromiumNodes(page, 'listbox')).toEqual([described]);
  await expect(list).toHaveAccessibleDescription(described.description);
});

for (const [width, height, drawerWidth] of [
  [1280, 720, 300],
  [1024, 768, 280],
] as const) {
  test.describe(`at ${String(width)} × ${String(height)}`, () => {
    test.use({ viewport: { width, height } });

    test(`D2 A3 the toggle opens a ${String(drawerWidth)} px drawer with the focus on its list box, and closing it, by the toggle or Close, focuses the toggle`, async ({
      page,
    }) => {
      await openPage(page);
      const toggle = elementsToggle(page);
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(elementList(page)).toBeFocused();
      await expectIndicator(page);
      expect((await drawer(page).boundingBox())?.width).toBe(drawerWidth);
      await button(page, 'Close Elements').click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
      await toggle.click();
      await expect(elementList(page)).toBeFocused();
      await toggle.click();
      await expect(toggle).toBeFocused();
      await expect(mountedList(page)).toHaveCount(0);
    });
  });
}

test('A9 D4 A4 the Elements toggle opens and closes the drawer, which is closed after every reload and stored nowhere', async ({
  page,
}) => {
  await openPage(page);
  const toggle = elementsToggle(page);
  await expect(toggle).toHaveAccessibleName('Elements');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await expect(mountedList(page)).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(elementList(page)).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await expect(mountedList(page)).toHaveCount(0);
  await toggle.click();
  await expect(elementList(page)).toBeVisible();
  // The preferences entry, if the page writes one, holds the theme alone (ADR 0012, D4).
  const stored = await page.evaluate<{ local: object; session: object }>(STORED);
  expect(stored.session).toEqual({});
  expect(Object.keys(stored.local).filter((key) => key !== 'planewright:preferences')).toEqual([]);
  expect(JSON.stringify(stored)).not.toMatch(/drawer|element-list|open|expanded/iu);
  await page.reload();
  await expect(canvas(page)).toBeVisible();
  await expect(elementsToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(elementList(page)).toBeHidden();
  await expect(mountedList(page)).toHaveCount(0);
});

/** The toggle's count's text, whether it is hidden, and its face and figures. */
const COUNT = `(() => {
  const count = document.querySelector('[aria-controls="element-list-drawer"] .toggle-count');
  const style = getComputedStyle(count);
  return { text: count.textContent, hidden: count.getAttribute('aria-hidden'), family: style.fontFamily, figures: style.fontVariantNumeric };
})()`;

test('D1 A2 the toggle shows the count in Inter’s tabular figures, following the elements, and keeps its name', async ({
  page,
}) => {
  await openPage(page);
  const toggle = elementsToggle(page);
  const count = { hidden: 'true', family: expect.stringMatching(/^"Planewright UI"/u) };
  expect(await page.evaluate(COUNT)).toEqual({ ...count, text: '0', figures: 'tabular-nums' });
  await canvas(page).focus();
  for (const key of ['r', 'Enter', 'o', 'Enter']) await page.keyboard.press(key);
  await expect(polite(page)).toHaveText('Ellipse created. 1 element selected.');
  await expect.poll(() => page.evaluate(COUNT)).toMatchObject({ ...count, text: '2' });
  await page.keyboard.press('Delete');
  await expect(polite(page)).toHaveText('Deleted 1 ellipse. Nothing selected.');
  await expect.poll(() => page.evaluate(COUNT)).toMatchObject({ text: '1' });
  await expect(toggle).toHaveAccessibleName('Elements');
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
