import { expect, test } from '@playwright/test';

// The page states what this pre-release build is and what does not work yet (AGENTS.md: the UI
// stays factual), in About this build, which the Pre-release tag opens (ADR 0012, D5), under a
// visually hidden heading, with named controls in a tool bar that the arrow keys move through.

test('states what the build draws and lists what does not work', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Planewright — pre-release');
  const heading = page.getByRole('heading', { level: 1, name: 'Planewright' });
  await expect(heading).toBeAttached();
  expect(await heading.boundingBox()).toMatchObject({ width: 1, height: 1 });
  expect(await page.evaluate("getComputedStyle(document.querySelector('h1')).clipPath")).toBe(
    'inset(50%)',
  );
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pre-release' }).click();
  const about = page.getByRole('dialog', { name: 'About this build' });
  await expect(about).toContainText(
    'Pre-release — you can draw shapes, lines, freehand strokes and texts, then select and transform them; the drawing is saved in this browser, but there are no files or collaboration yet.',
  );
  const missing = about.getByRole('region', { name: 'Not implemented yet' });
  await expect(missing).toContainText('Text formatting: every text is left-aligned in one font');
  await expect(missing).not.toContainText('the Text tool and text editing');
  await expect(missing).toContainText(
    'Files: opening, saving and exporting drawings as files; a drawing is kept only in this browser',
  );
  await expect(missing).not.toContainText('a reload loses the drawing');
  await expect(missing).not.toContainText('Drawing shapes');
  await expect(about.getByText('not affiliated with Excalidraw')).toBeVisible();
});

test('REQ-Y01 REQ-Y03 REQ-C14 has a named tool bar that the arrow keys move through', async ({
  page,
}) => {
  await page.goto('/');
  const toolbar = page.getByRole('toolbar', { name: 'Tools' });
  const hand = toolbar.getByRole('button', { name: 'Hand', exact: true });
  const selection = toolbar.getByRole('button', { name: 'Selection' });
  await expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
  await expect(selection).toHaveAttribute('aria-keyshortcuts', 'V 1');
  await expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Pre-release' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(hand).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(selection).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(toolbar.getByRole('button', { name: 'Rectangle' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(toolbar.getByRole('button', { name: 'Tool lock' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(hand).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Drawing canvas' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});
