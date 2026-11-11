import { expect, test } from '@playwright/test';

import { openPage } from './a11y.ts';
import { toolButton } from './drawing.ts';

// The palette (ADR 0012, decision 3, and the v0.2 plan's S3): tool lock's padlock is closed while
// tool lock is on, as its pressed state says, and toggling it from the keyboard changes both.

test('A4 REQ-Y01 the padlock closes and opens with tool lock from the keyboard, with aria-pressed', async ({
  page,
}) => {
  await openPage(page);
  const lock = toolButton(page, 'Tool lock');
  const padlock = lock.locator('svg[data-glyph]');
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await expect(padlock).toHaveAttribute('data-glyph', 'lock-open');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(toolButton(page, 'Hand')).toBeFocused();
  await page.keyboard.press('End');
  await expect(lock).toBeFocused();
  for (const [key, pressed, glyph] of [
    ['Space', 'true', 'lock-closed'],
    ['Enter', 'false', 'lock-open'],
    ['q', 'true', 'lock-closed'],
    ['q', 'false', 'lock-open'],
  ] as const) {
    await page.keyboard.press(key);
    await expect(lock).toHaveAttribute('aria-pressed', pressed);
    await expect(padlock).toHaveAttribute('data-glyph', glyph);
    await expect(lock).toHaveAccessibleName('Tool lock');
  }
  await expect(lock).toBeFocused();
});
