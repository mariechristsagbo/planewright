// Checks the mobile scenarios 56-59, written from what s59 and s61 saved: keyboard focus from a
// clicked control, in the main menu and in the Help dialog (R-27), the refined resize ladder
// (R-23), adding a selection to the library and placing the item (R-15), and a typed canvas
// background (R-05). They name only driver steps, never navigate, reload or reach the clipboard,
// files or a link, and are not runLast. No browser is started.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probes } from '../../lib/probes.mjs';
import { handlers } from '../../lib/steps.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scenarios');
const scenario = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));
const stepsOf = (name) => scenario(name).steps;
const kindsOf = (name) => stepsOf(name).map((step) => step.do);

const FOCUS = '56-keyboard-controls-mobile';
const REFINE = '57-responsive-refine-mobile';
const ADD = '58-library-add-place-mobile';
const BACKGROUND = '59-canvas-background-mobile';
const ALL = [FOCUS, REFINE, ADD, BACKGROUND];
const ASSERT = {
  do: 'assertMetrics',
  expect: {
    innerWidth: 390,
    innerHeight: 844,
    devicePixelRatio: 3,
    screenWidth: 390,
    screenHeight: 844,
    orientationType: 'portrait-primary',
    orientationAngle: 0,
    maxTouchPoints: 5,
    coarsePointer: true,
    canvasBacking: true,
  },
};
const INPUT = ['tap', 'touchDrag', 'touchPath', 'type', 'key', 'role', 'selectOption'];
const names = (name) =>
  stepsOf(name)
    .filter((step) => step.do === 'role')
    .map((step) => `${step.role}:${String(step.name)}`);
const taps = (name) =>
  stepsOf(name)
    .filter((step) => step.do === 'tap')
    .map((step) => step.at.join(','));

describe('scenarios 56-59', () => {
  it.each(ALL)('%s names only driver steps, is not runLast and asserts first and last', (name) => {
    const known = new Set([...Object.keys(handlers), ...Object.keys(probes)]);
    for (const step of stepsOf(name)) expect(known.has(step.do), step.do).toBe(true);
    expect(scenario(name).runLast).toBeUndefined();
    expect(stepsOf(name)[0]).toEqual(ASSERT);
    expect(stepsOf(name).at(-1)).toEqual(ASSERT);
  });

  it.each(ALL)('%s never navigates, reloads or reaches the clipboard, files or a link', (name) => {
    const refused = ['goto', 'fixture', 'reload', 'download', 'selector', 'offline', 'colorScheme'];
    refused.push('grantClipboard', 'clipboard', 'fileChooser', 'dropFile', 'acceptDialog');
    refused.push('click', 'move', 'drag', 'path', 'wheel');
    for (const kind of refused) expect(kindsOf(name)).not.toContain(kind);
    for (const step of stepsOf(name)) expect(step.role === 'link').toBe(false);
    for (const step of stepsOf(name).filter((s) => s.do === 'role')) expect(step.exact).toBe(true);
  });

  it.each([FOCUS, ADD, BACKGROUND])('%s does not emulate', (name) => {
    expect(kindsOf(name)).not.toContain('emulate');
  });
});

describe('keyboard focus from controls (56)', () => {
  const steps = stepsOf(FOCUS);
  const keys = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'key');

  it('presses Enter and Space only on the clicked Library button, before any Tab', () => {
    const activating = keys.filter(([step]) => ['Enter', ' ', 'Space'].includes(step.key));
    expect(activating.map(([step]) => step.key)).toEqual(['Enter', 'Space']);
    const firstTab = keys.find(([step]) => step.key.includes('Tab'))[1];
    const library = steps.findIndex((step) => step.role === 'button' && step.name === 'Library');
    for (const [, i] of activating) {
      expect(i).toBeGreaterThan(library);
      expect(i).toBeLessThan(firstTab);
      const between = steps.slice(library + 1, i).map((step) => step.do);
      expect(between.filter((kind) => INPUT.includes(kind) && kind !== 'key')).toEqual([]);
    }
  });

  it('reads the focus after every key press, and clicks and taps only known controls', () => {
    for (const [step, i] of keys) {
      const next = steps.slice(i + 1).find((s) => s.do !== 'wait');
      expect(next.do, `after ${step.key} at ${String(i)}`).toBe('focus');
    }
    expect(new Set(names(FOCUS))).toEqual(
      new Set(['button:Library', 'button:Close', 'button:Selection', 'menuitem:Help']),
    );
    expect(new Set(taps(FOCUS))).toEqual(new Set(['28,28']));
    const labels = steps.filter((step) => step.do === 'focus').map((step) => step.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the refined ladder (57)', () => {
  const steps = stepsOf(REFINE);
  const changes = steps.map((step, i) => [step, i]).filter(([step]) => step.do === 'emulate');

  it('sends no input and no user agent, and asserts each viewport after a wait and a read', () => {
    for (const kind of INPUT) expect(kindsOf(REFINE)).not.toContain(kind);
    expect(changes).toHaveLength(10);
    const kind = { portraitPrimary: 'portrait-primary', landscapePrimary: 'landscape-primary' };
    for (const [step, i] of changes) {
      expect('userAgent' in step).toBe(false);
      expect(step).toMatchObject({ deviceScaleFactor: 3, mobile: true, hasTouch: true });
      const { type, angle } = step.screenOrientation;
      expect(angle).toBe(step.width > step.height ? 90 : 0);
      expect(steps.slice(i + 1, i + 3)).toEqual([{ do: 'wait', ms: 1000 }, { do: 'metrics' }]);
      expect(steps[i + 3].expect).toMatchObject({
        innerWidth: step.width,
        innerHeight: step.height,
        orientationType: kind[type],
        orientationAngle: angle,
      });
      expect(steps[i + 4].do).toBe('layout');
    }
    expect(changes.at(-1)[0]).toMatchObject({ width: 390, height: 844 });
  });
});

describe('the library item (58) and the canvas background (59)', () => {
  it('58 clicks only Library and Close, taps the add tile or the canvas, and types nothing', () => {
    expect(new Set(names(ADD))).toEqual(new Set(['button:Library', 'button:Close']));
    expect(kindsOf(ADD)).not.toContain('type');
    expect(kindsOf(ADD)).not.toContain('key');
    expect(taps(ADD).filter((at) => at === '136,214')).toHaveLength(2);
  });

  it('59 stops at its first failure and types one hex code only after its named textbox', () => {
    expect(scenario(BACKGROUND).continueOnError).toBe(false);
    const steps = stepsOf(BACKGROUND);
    const typed = steps.filter((step) => step.do === 'type');
    expect(typed.map((step) => step.text)).toEqual(['ffc9c9']);
    const box = steps.findIndex((s) => s.role === 'textbox' && s.name === 'Canvas background');
    expect(box).toBeGreaterThan(0);
    expect(steps.indexOf(typed[0])).toBe(box + 3);
    expect(names(BACKGROUND)).toEqual([
      'button:Canvas background',
      'textbox:Canvas background',
      'button:Undo',
      'button:Redo',
    ]);
  });
});
