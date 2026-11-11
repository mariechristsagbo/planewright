import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { openPage, polite } from './a11y.ts';
import {
  expectSaved,
  hideNotices,
  putDocumentRecord,
  refusableWrites,
  refuseStorage,
  saveState,
  saveStatus,
  setRefuseWrites,
  showFailedNotice,
  showStaleNotice,
  storageNotices,
  storedRecords,
} from './storage.ts';
import { canvas } from './support.ts';

// Saving's chrome end to end (ADR 0012, decisions 12 and 14, D7; the v0.2 plan's S7): nothing
// shows or is said while saving works; a failed, stale or unavailable save shows the "Not saved"
// chip in its tone with P0's notices, which Hide folds into the chip's button; a failed save that
// succeeds again is said once, politely; and the tab order puts the notices' buttons, or the
// chip's button, between the canvas and Elements. Page code is written as strings.

/** Records from the page's start every text it writes, every live message and every save state. */
const RECORDER = `(() => {
  const record = { texts: [], live: [], states: [] };
  window.savingRecord = record;
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        record.states.push(mutation.target.getAttribute('data-save-state'));
        continue;
      }
      const nodes = mutation.type === 'characterData' ? [mutation.target] : [...mutation.addedNodes];
      for (const node of nodes) {
        const text = (node.textContent || '').trim();
        if (text !== '') record.texts.push(text);
      }
      const at = mutation.target.nodeType === 3 ? mutation.target.parentElement : mutation.target;
      const region = at && at.closest ? at.closest('#live-polite, #live-assertive') : null;
      if (region !== null && region.textContent !== '') record.live.push(region.id + ' ' + region.textContent);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-save-state'] });
})()`;

interface SavingRecord {
  readonly texts: readonly string[];
  readonly live: readonly string[];
  readonly states: readonly string[];
}

const recorded = (page: Page): Promise<SavingRecord> =>
  page.evaluate<SavingRecord>('window.savingRecord');

const RECOVERY = 'live-polite The drawing is saved again.';

/** The chip's words, tone class, glyphs, and text and background colours. */
const CHIP = `(() => {
  const chip = document.getElementById('save-status');
  const style = getComputedStyle(chip);
  return {
    text: chip.textContent,
    tone: [...chip.classList].find((name) => name.startsWith('tone-')),
    glyphs: [...chip.querySelectorAll('svg')].map((svg) => svg.dataset.glyph),
    colours: [style.color, style.backgroundColor],
  };
})()`;

const chipLook = (page: Page): Promise<unknown> => page.evaluate(CHIP);

const ERROR_COLOURS = ['rgb(144, 30, 28)', 'rgb(255, 241, 239)'];
const WARNING_COLOURS = ['rgb(131, 75, 20)', 'rgb(255, 246, 221)'];

test('A2 D1 nothing about saving shows or is said from load through three saves', async ({
  page,
}) => {
  await page.addInitScript(RECORDER);
  await openPage(page);
  await expectSaved(page);
  await canvas(page).focus();
  for (const [index, key] of ['r', 'o', 'd'].entries()) {
    await page.keyboard.press(key);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await storedRecords(page)).elements.length).toBe(index + 1);
    await expectSaved(page);
  }
  const { texts, live, states } = await recorded(page);
  expect(texts.filter((text) => /Saved in this browser|Saving…|\bSaved\b/u.test(text))).toEqual([]);
  expect(live.filter((message) => /sav/iu.test(message))).toEqual([]);
  expect(states.filter((state) => state === 'saved').length).toBeGreaterThanOrEqual(3);
  expect(states.filter((state) => !['saved', 'pending'].includes(state))).toEqual([]);
  await expect(saveStatus(page)).toHaveCount(0);
  const topRight = page.locator('[data-island="top-right"]');
  await expect(topRight.getByRole('button')).toHaveText([/^Elements/u]);
  await expect(page.locator('svg[data-glyph^="status"]')).toHaveCount(0);
});

test('A4 A6 A7 a failed save shows the error chip and its notice, Hide folds them, recovery is said once, and a new failure shows them again', async ({
  page,
}) => {
  await page.addInitScript(RECORDER);
  await refusableWrites(page);
  await openPage(page);
  await showFailedNotice(page);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'failed');
  expect(await chipLook(page)).toEqual({
    text: 'Not saved',
    tone: 'tone-error',
    glyphs: ['status-problem'],
    colours: ERROR_COLOURS,
  });
  await hideNotices(page);
  await expect(storageNotices(page)).toHaveCount(0);
  const folded = page.getByRole('button', { name: 'Not saved' });
  await expect(folded).toHaveAttribute('aria-expanded', 'false');
  await expect(folded).toHaveAttribute('aria-controls', 'notices');
  await expect(folded).toBeFocused();
  await folded.click();
  const hide = storageNotices(page).getByRole('button', { name: 'Hide storage notices' });
  await expect(hide).toBeFocused();

  await setRefuseWrites(page, false);
  await expectSaved(page);
  await expect(saveStatus(page)).toHaveCount(0);
  await expect(polite(page)).toHaveText('The drawing is saved again.');
  await expect(canvas(page)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await recorded(page)).states.at(-1)).toBe('pending');
  await expectSaved(page);
  expect((await recorded(page)).live.filter((message) => message === RECOVERY)).toHaveLength(1);

  await setRefuseWrites(page, true);
  await page.keyboard.press('ArrowRight');
  await expect(storageNotices(page)).toContainText('Saving failed:');
  await hideNotices(page);
  await expect(storageNotices(page)).toHaveCount(0);
  await setRefuseWrites(page, false);
  await expectSaved(page);
  await setRefuseWrites(page, true);
  await canvas(page).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(storageNotices(page)).toContainText('Saving failed:');
});

test('A4 a stale save shows the warning chip with the two tabs, and Keep or Load clears it with no recovery sentence', async ({
  page,
  context,
}) => {
  await context.addInitScript(RECORDER);
  await openPage(page);
  await showStaleNotice(page);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'stale');
  expect(await chipLook(page)).toEqual({
    text: 'Not saved',
    tone: 'tone-warning',
    glyphs: ['status-tabs'],
    colours: WARNING_COLOURS,
  });
  await storageNotices(page).getByRole('button', { name: 'Keep this version' }).click();
  await expectSaved(page);
  await expect(saveStatus(page)).toHaveCount(0);

  const second = context.pages()[1] ?? page;
  await second.bringToFront();
  await canvas(second).focus();
  await second.keyboard.press('ArrowRight');
  await expect(saveState(second)).toHaveAttribute('data-save-state', 'stale');
  await storageNotices(second).getByRole('button', { name: 'Load the newer version' }).click();
  await expectSaved(second);
  await expect(saveStatus(second)).toHaveCount(0);
  for (const tab of [page, second]) {
    const { live } = await recorded(tab);
    expect(
      live.filter((message) => message.startsWith('live-polite') && /sav/iu.test(message)),
    ).toEqual([]);
  }
});

test('A4 A6 storage unavailable at start-up shows the warning chip, and the notices show again after Hide and a reload', async ({
  page,
}) => {
  await refuseStorage(page);
  await openPage(page);
  await expect(saveState(page)).toHaveAttribute('data-save-state', 'none');
  expect(await chipLook(page)).toEqual({
    text: 'Not saved',
    tone: 'tone-warning',
    glyphs: ['status-problem'],
    colours: WARNING_COLOURS,
  });
  await hideNotices(page);
  await expect(page.getByRole('button', { name: 'Not saved' })).toBeFocused();
  await expect(storageNotices(page)).toHaveCount(0);
  await page.reload();
  await expect(storageNotices(page)).toContainText('Saving is unavailable in this browser');
  await expect(saveStatus(page)).toHaveJSProperty('tagName', 'P');
});

test('A4 unreadable stored data shows no chip while its notice shows, and once hidden a Storage notice button reopens it', async ({
  page,
}) => {
  await openPage(page);
  await expectSaved(page);
  await putDocumentRecord(page, {
    id: 'Invalid0Drawing0Record',
    schema: 1,
    rev: 'seven',
    canvas: { background: '#ffffff' },
    groups: [],
    session: {},
  });
  await page.reload();
  await expect(storageNotices(page)).toContainText('could not be read');
  await expect(saveStatus(page)).toHaveCount(0);
  await hideNotices(page);
  const reopen = page.getByRole('button', { name: 'Storage notice' });
  await expect(reopen).toBeFocused();
  await expect(reopen).toHaveClass(/tone-warning/u);
  await reopen.click();
  await expect(storageNotices(page)).toContainText('could not be read');
  await expect(
    storageNotices(page).getByRole('button', { name: 'Hide storage notices' }),
  ).toBeFocused();
});
