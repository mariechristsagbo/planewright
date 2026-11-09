import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { expectInk, mouseClick, mouseDrag, overlayInk, toolButton } from './drawing.ts';
import type { Point } from './drawing.ts';
import {
  expectSaved,
  putDocumentRecord,
  refusableWrites,
  refuseStorage,
  saveStatus,
  setRefuseWrites,
  storageNotices,
  storedRecords,
  urgentAnnouncement,
} from './storage.ts';
import { canvas, cameraOf, expectHistoryDisabled, readout } from './support.ts';
import type { Camera } from './support.ts';

// Saving in this browser end to end (ENG-13, docs/architecture/engine/persistence.md): a reload
// restores the drawing, the camera and the selection with the Selection tool and no history; a
// second tab's newer save raises the stale notice; invalid or unavailable storage opens a new
// drawing with a notice. The IndexedDB repository is tested here, in Chromium, and nowhere else.

const pressed = (page: Page, name: string) =>
  expect(toolButton(page, name)).toHaveAttribute('aria-pressed', 'true');

/** The screen point of a scene point under a camera. */
const screenOf = ([x, y]: Point, { x: cx, y: cy, zoom }: Camera): Point => [
  (x - cx) * zoom,
  (y - cy) * zoom,
];

/** Draws a rectangle with the Rectangle tool from one canvas point to another. */
async function rectangle(page: Page, from: Point, to: Point): Promise<void> {
  await toolButton(page, 'Rectangle').click();
  await mouseDrag(page, from, to);
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await canvas(page).focus();
  await expectSaved(page);
}

test('E1 A11 REQ-P02 REQ-P03 REQ-H03 REQ-V11 a reload brings back the drawing, the camera and the selection, with the Selection tool and no history', async ({
  page,
}) => {
  await open(page);
  await rectangle(page, [100, 100], [250, 200]);
  await rectangle(page, [400, 100], [550, 200]);
  await expect.poll(async () => (await storedRecords(page)).elements.length).toBe(2);
  await page.keyboard.press('Delete');
  await expectInk(page, [[400, 150]], false);
  await page.keyboard.press('Control+Equal');
  const camera = await cameraOf(page);
  expect(camera.zoom).toBeCloseTo(1.1, 5);
  await mouseClick(page, screenOf([100, 150], camera));
  await page.keyboard.press('h');
  await expect
    .poll(async () => {
      const { documents, elements } = await storedRecords(page);
      const session = documents[0]?.['session'] as
        { camera: Camera; selection: string[] } | undefined;
      return [documents.length, elements.length, session?.camera.zoom, session?.selection.length];
    })
    .toEqual([1, 1, camera.zoom, 1]);
  const view = await readout(page).textContent();

  await page.reload();
  await expectSaved(page);
  await expect(readout(page)).toHaveText(view ?? '');
  await expectInk(page, [screenOf([100, 150], camera), screenOf([250, 150], camera)]);
  await expectInk(page, [screenOf([400, 150], camera), screenOf([550, 150], camera)], false);
  await expect.poll(() => overlayInk(page)).toBeGreaterThan(0);
  await pressed(page, 'Selection');
  await expectHistoryDisabled(page);
  expect((await storedRecords(page)).elements).toHaveLength(1);
});

test('E2 A12 REQ-P06 a second tab’s newer save raises the notice, and each choice does what it says', async ({
  page,
  context,
}) => {
  await open(page);
  await rectangle(page, [100, 100], [200, 180]);
  await expectSaved(page);

  const second = await context.newPage();
  await open(second);
  await expectInk(second, [[100, 140]]);
  await rectangle(second, [300, 100], [400, 180]);
  await expectSaved(second);

  await page.bringToFront();
  await rectangle(page, [500, 100], [600, 180]);
  const notice = storageNotices(page);
  await expect(notice).toContainText('Another tab saved a newer version of this drawing');
  await expect(urgentAnnouncement(page)).toContainText('Another tab saved a newer version');
  await expect(saveStatus(page)).toHaveText('Not saved');
  await notice.getByRole('button', { name: 'Keep this version' }).click();
  await expectSaved(page);
  await expect(storageNotices(page)).toHaveCount(0);

  await second.bringToFront();
  await rectangle(second, [700, 100], [800, 180]);
  const secondNotice = storageNotices(second);
  await expect(secondNotice).toContainText('Another tab saved a newer version of this drawing');
  await secondNotice.getByRole('button', { name: 'Load the newer version' }).click();
  await expectSaved(second);
  await expectInk(second, [
    [100, 140],
    [500, 140],
  ]);
  await expectInk(
    second,
    [
      [300, 140],
      [700, 140],
    ],
    false,
  );
  await pressed(second, 'Selection');
  await expectHistoryDisabled(second);
  const { documents, elements } = await storedRecords(second);
  expect([documents.length, documents[0]?.['rev'], elements.length]).toEqual([1, 3, 2]);
});

test('E3 A13 REQ-P07 invalid stored data is left unchanged, and a new drawing opens beside it with a notice', async ({
  page,
}) => {
  await open(page);
  const invalid = {
    id: 'Invalid0Drawing0Record',
    schema: 1,
    rev: 'seven',
    canvas: { background: '#ffffff' },
    groups: [],
    session: {},
  };
  await putDocumentRecord(page, invalid);
  const [written] = (await storedRecords(page)).documents;

  await page.reload();
  const invalidText =
    'The drawing saved in this browser could not be read, so a new drawing was opened. The saved data is left unchanged.';
  await expect(storageNotices(page)).toHaveText(invalidText);
  await expect(urgentAnnouncement(page)).toHaveText(invalidText);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await canvas(page).focus();
  await rectangle(page, [100, 100], [200, 180]);
  await expectSaved(page);
  const { documents } = await storedRecords(page);
  expect(documents).toHaveLength(2);
  expect(documents.find(({ id }) => id === invalid.id)).toEqual(written);

  await page.reload();
  await expectSaved(page);
  await expect(storageNotices(page)).toHaveCount(0);
  await expect(urgentAnnouncement(page)).toHaveText('');
  await expectInk(page, [[100, 140]]);
});

test('E4 storage that cannot be opened shows a notice, and drawing still works', async ({
  page,
}) => {
  await refuseStorage(page);
  await page.goto('/');
  await canvas(page).focus();
  const unavailableText =
    'Saving is unavailable in this browser: the drawing stays in this tab only and is lost when the tab closes.';
  await expect(storageNotices(page)).toHaveText(unavailableText);
  await expect(urgentAnnouncement(page)).toHaveText(unavailableText);
  await expect(saveStatus(page)).toHaveText('Not saved');
  await rectangle(page, [100, 100], [200, 180]);
  await expectInk(page, [[100, 140]]);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
});

test('REQ-P05 a failed save is reported, retried, and saved once storage takes it again', async ({
  page,
}) => {
  await refusableWrites(page);
  await open(page);
  await rectangle(page, [100, 100], [200, 180]);
  await expectSaved(page);
  await setRefuseWrites(page, true);
  await rectangle(page, [300, 100], [400, 180]);
  const failedText =
    'Saving failed: the browser’s storage did not take the change. Your changes are kept in this tab, and saving is tried again.';
  await expect(storageNotices(page)).toHaveText(failedText);
  await expect(urgentAnnouncement(page)).toHaveText(failedText);
  await setRefuseWrites(page, false);
  await expectSaved(page);
  await expect(storageNotices(page)).toHaveCount(0);
  await page.reload();
  await expectInk(page, [
    [100, 140],
    [300, 140],
  ]);
});
