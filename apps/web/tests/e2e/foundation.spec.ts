import { expect, test } from '@playwright/test';

// The page states what this pre-release build is and what does not work yet (AGENTS.md: the UI
// stays factual), with named controls in a tool bar that the arrow keys move through.

test('states that the build is navigation only and lists what does not work', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Planewright — pre-release, navigation only');
  await expect(page.getByRole('heading', { level: 1, name: 'Planewright' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(
    'Pre-release — navigation only: you can pan and zoom an empty canvas, but nothing can be drawn yet.',
  );
  const missing = page.getByRole('region', { name: 'Not implemented yet' });
  await expect(missing).toContainText('Drawing shapes, lines, freehand strokes and text');
  await expect(missing).toContainText('Moving, resizing, rotating and editing elements');
  await expect(missing).not.toContainText('the Selection tool does nothing');
  await expect(page.getByText('not affiliated with Excalidraw')).toBeVisible();
});

test('REQ-Y01 REQ-Y03 REQ-C14 has a named tool bar that the arrow keys move through', async ({
  page,
}) => {
  await page.goto('/');
  const toolbar = page.getByRole('toolbar', { name: 'Tools' });
  const hand = toolbar.getByRole('button', { name: 'Hand' });
  const selection = toolbar.getByRole('button', { name: 'Selection' });
  await expect(hand).toHaveAttribute('aria-keyshortcuts', 'H');
  await expect(selection).toHaveAttribute('aria-keyshortcuts', 'V 1');
  await expect(hand).toHaveAccessibleDescription('Shortcut H. Drag to pan the canvas.');
  await page.keyboard.press('Tab');
  await expect(hand).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(selection).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(hand).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('region', { name: 'Drawing canvas' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});
