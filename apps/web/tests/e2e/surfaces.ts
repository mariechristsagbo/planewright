import type { Locator, Page } from '@playwright/test';

import { button, elementsToggle } from './a11y.ts';
import { moreButton } from './drawing.ts';
import type { Surface } from './entrance.ts';
import { ENTER, RISE, SHEET, SIDE, settled } from './motion.ts';
import type { Entrance } from './motion.ts';
import { onCanvas, panelButton } from './panel.ts';
import {
  hideNotices,
  refusableWrites,
  refuseStorage,
  saveStatus,
  showFailedNotice,
  showStaleNotice,
} from './storage.ts';
import { canvas } from './support.ts';

// The surfaces of ADR 0012's D2 as the motion tests open, close and open them again (the v0.2
// plan's S12): the menu, More's popover, the selection panel or bar, the storage notices, the two
// dialogs, the Elements drawer or sheet and the Details sheet.

export const escape = (page: Page): Promise<void> => page.keyboard.press('Escape');
export const menuButton = (page: Page): Locator => button(page, 'Planewright menu');
export const detailsButton = (page: Page): Locator => panelButton(page, 'Details');

/** Draws a rectangle from the keyboard, which selects it and so shows the panel or the bar. */
export const rectangle = (page: Page): Promise<void> =>
  onCanvas(page, ['r', 'Enter'], 'Rectangle created. 1 element selected.');

export const MENU: Surface = {
  selector: '#chrome-menu',
  entrance: ENTER,
  open: (page) => menuButton(page).click(),
  close: escape,
};

export const MORE: Surface = {
  selector: '#more-tools',
  entrance: RISE,
  open: (page) => moreButton(page).tap(),
  close: (page) => moreButton(page).tap(),
};

/** The selection panel, or the phone's selection bar, which closes with the selection. */
export const SELECTION: Surface = {
  selector: '[data-island="selection"]',
  entrance: ENTER,
  open: rectangle,
  close: async (page) => {
    await canvas(page).focus();
    await escape(page);
  },
  reopen: async (page) => {
    await canvas(page).focus();
    await page.keyboard.press('Control+a');
  },
};

/** The Elements drawer at its side, or the Elements sheet on a phone in portrait. */
export const elements = (entrance: Entrance): Surface => ({
  selector: '#element-list-drawer',
  entrance,
  open: (page) => elementsToggle(page).click(),
  close: (page) => button(page, 'Close Elements').click(),
});

export const DRAWER = elements(SIDE);
export const ELEMENTS_SHEET = elements(SHEET);

/** A dialog that a button opens. */
export const dialog = (selector: string, opener: string): Surface => ({
  selector,
  entrance: ENTER,
  open: (page) => button(page, opener).click(),
  close: escape,
});

export const ABOUT = dialog('#about-this-build', 'Pre-release');
export const SHORTCUTS = dialog('#keyboard-shortcuts', 'Keyboard shortcuts');

/** Keyboard shortcuts as a phone opens it, from the menu. */
export const SHORTCUTS_FROM_MENU: Surface = {
  ...SHORTCUTS,
  open: async (page) => {
    await menuButton(page).click();
    await page.getByRole('menuitem', { name: /^Keyboard shortcuts/u }).click();
  },
};

/** The storage notices, shown by a failing save, a stale one, or storage refused at load. */
const notices = (open: Surface['open'], before?: Surface['before']): Surface => ({
  selector: '#notices',
  entrance: ENTER,
  ...(before === undefined ? {} : { before }),
  open,
  close: hideNotices,
  reopen: (page) => saveStatus(page).click(),
});

export const FAILED = notices(showFailedNotice, refusableWrites);
export const STALE = notices(showStaleNotice);
export const UNAVAILABLE = notices(() => Promise.resolve(), refuseStorage);

export const DETAILS: Surface = {
  selector: '#details-sheet',
  entrance: SHEET,
  open: async (page) => {
    await rectangle(page);
    await settled(page);
    await detailsButton(page).tap();
  },
  close: (page) => button(page, 'Close Details').click(),
  reopen: (page) => detailsButton(page).tap(),
};

/** A layout of the issue's acceptance criteria, with the surfaces that it shows. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly touch: boolean;
  readonly surfaces: readonly (readonly [name: string, surface: Surface])[];
}

/** Each surface of D2 in each of its layouts (the issue's A2 and A3). */
export const DESKTOPS: readonly Layout[] = [
  {
    width: 1440,
    height: 900,
    touch: false,
    surfaces: [
      ['the menu', MENU],
      ['the failed notice', FAILED],
      ['the stale notice', STALE],
    ],
  },
  {
    width: 1280,
    height: 720,
    touch: false,
    surfaces: [
      ['the selection panel', SELECTION],
      ['About this build from the tag', ABOUT],
      ['Keyboard shortcuts from its button', SHORTCUTS],
      ['the Elements drawer', DRAWER],
    ],
  },
  {
    width: 800,
    height: 720,
    touch: false,
    surfaces: [
      ['the menu', MENU],
      ['the Elements drawer', DRAWER],
    ],
  },
  {
    width: 1024,
    height: 768,
    touch: true,
    surfaces: [
      ['the selection panel', SELECTION],
      ['the storage notice at load', UNAVAILABLE],
    ],
  },
];

export const PHONES: readonly Layout[] = [
  {
    width: 390,
    height: 844,
    touch: true,
    surfaces: [
      ['the menu', MENU],
      ['More’s popover', MORE],
      ['the selection bar', SELECTION],
      ['the failed notice', FAILED],
      ['Keyboard shortcuts from the menu', SHORTCUTS_FROM_MENU],
      ['the Elements sheet', ELEMENTS_SHEET],
      ['the Details sheet', DETAILS],
    ],
  },
  {
    width: 360,
    height: 560,
    touch: true,
    surfaces: [
      ['the Elements sheet', ELEMENTS_SHEET],
      ['the Details sheet', DETAILS],
    ],
  },
  {
    width: 844,
    height: 390,
    touch: true,
    surfaces: [
      ['the selection panel', SELECTION],
      ['the Elements drawer at its side', DRAWER],
    ],
  },
];
